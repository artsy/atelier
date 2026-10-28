import type { Readable } from "node:stream";
import archiver from "archiver";
import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getS3Client } from "../../../../lib/deps";
import { getObjectStream, listPrefix } from "../../../../lib/s3";
import { validateSlug } from "../../../../lib/slug";
import { withErrorHandler } from "../../../../middleware/withErrorHandler";

export const config = {
  api: { responseLimit: false },
};

function appendAndWait(
  archive: archiver.Archiver,
  body: Readable,
  name: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onFailure);
      body.off("error", onFailure);
      signal.removeEventListener("abort", onAbort);
    };
    const onEntry = () => {
      cleanup();
      resolve();
    };
    // Archiver doesn't forward errors from its input streams, so the body is
    // watched directly. Destroying it releases the S3 socket.
    const onFailure = (err: Error) => {
      cleanup();
      body.destroy();
      reject(err);
    };
    const onAbort = () => onFailure(new Error("Download cancelled"));

    if (signal.aborted) {
      onAbort();
      return;
    }
    archive.on("entry", onEntry);
    archive.on("error", onFailure);
    body.on("error", onFailure);
    signal.addEventListener("abort", onAbort);
    archive.append(body, { name });
  });
}

export default withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  const validation = validateSlug(slug);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const client = getS3Client();
  const bucket = getConfig().s3Bucket;

  const keys = await listPrefix(client, bucket, slug);
  if (keys.length === 0) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}.zip"`);
  res.setHeader("Cache-Control", "no-store");

  const archive = archiver("zip");
  const cancellation = new AbortController();
  archive.pipe(res);
  res.once("close", () => {
    if (!res.writableEnded) {
      cancellation.abort();
      archive.abort();
    }
  });

  try {
    // One S3 request at a time, so a large site can't exhaust the SDK's sockets.
    for (const key of keys) {
      const body = await getObjectStream(client, bucket, key, cancellation.signal);
      await appendAndWait(archive, body, key.slice(`${slug}/`.length), cancellation.signal);
    }
    await archive.finalize();
    console.log(JSON.stringify({ event: "site_download", slug, files: keys.length }));
  } catch (err) {
    // Unpipe first: aborting would otherwise end the response cleanly and the
    // browser would save a truncated zip as if it were complete.
    archive.unpipe(res);
    archive.abort();
    if (cancellation.signal.aborted) {
      return;
    }
    if (!res.headersSent) {
      throw err;
    }
    console.error(`GET ${req.url} failed mid-stream:`, err);
    res.destroy();
  }
});
