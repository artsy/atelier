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

function appendAndWait(archive: archiver.Archiver, body: Readable, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEntry = () => {
      archive.off("error", onError);
      resolve();
    };
    const onError = (err: Error) => {
      archive.off("entry", onEntry);
      reject(err);
    };
    archive.once("entry", onEntry);
    archive.once("error", onError);
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
  archive.pipe(res);
  res.once("close", () => {
    if (!res.writableEnded) {
      archive.abort();
    }
  });

  try {
    // One S3 request at a time, so a large site can't exhaust the SDK's sockets.
    for (const key of keys) {
      const body = await getObjectStream(client, bucket, key);
      await appendAndWait(archive, body, key.slice(`${slug}/`.length));
    }
    await archive.finalize();
    console.log(JSON.stringify({ event: "site_download", slug, files: keys.length }));
  } catch (err) {
    // Unpipe first: aborting would otherwise end the response cleanly and the
    // browser would save a truncated zip as if it were complete.
    archive.unpipe(res);
    archive.abort();
    if (!res.headersSent) {
      throw err;
    }
    console.error(`GET ${req.url} failed mid-stream:`, err);
    res.destroy();
  }
});
