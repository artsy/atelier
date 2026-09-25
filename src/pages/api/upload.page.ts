import type { NextApiRequest, NextApiResponse } from "next";
import { invalidateSlug } from "../../lib/cloudfront";
import { getCloudFrontClient, getConfig, getS3Client } from "../../lib/deps";
import { getHeader } from "../../lib/getHeader";
import { resolveContentType } from "../../lib/mime";
import { parseUpload, type UploadContext } from "../../lib/parseUpload";
import { deletePrefix, headIndex, putFile } from "../../lib/s3";
import { validateSlug } from "../../lib/slug";
import { sanitizeUploader } from "../../lib/uploader";
import { normalizeZipEntries, ZipValidationError } from "../../lib/zip";
import { withErrorHandler } from "../../middleware/withErrorHandler";

// Next consumes the request body itself unless bodyParser is disabled here
// — without this, req.pipe(bb) in parseUpload hangs forever with no error,
// since there's nothing left in the stream for busboy to read.
export const config = {
  api: {
    bodyParser: false,
  },
};

type UploadStatus = "upload" | "overwrite" | "conflict" | "reject";

function logUpload(fields: {
  slug: string;
  bytes: number;
  status: UploadStatus;
  files?: number;
  reason?: string;
  uploadedBy?: string;
}): void {
  console.log(JSON.stringify({ event: "upload", ...fields }));
}

export default withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const {
    s3Bucket: bucket,
    cloudfrontDistributionId: distributionId,
    publicDomain,
    maxUploadBytes,
  } = getConfig();
  const s3Client = getS3Client();
  const cloudFrontClient = getCloudFrontClient();

  try {
    const parsed = await parseUpload(req, maxUploadBytes);

    const validation = validateSlug(parsed.slug);
    if (!validation.valid) {
      logUpload({
        slug: parsed.slug,
        bytes: parsed.zipBytes,
        status: "reject",
        ...(validation.error !== undefined && { reason: validation.error }),
      });
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!parsed.entries) {
      logUpload({
        slug: parsed.slug,
        bytes: parsed.zipBytes,
        status: "reject",
        reason: "Missing zip file",
      });
      res.status(400).json({ error: "Missing zip file" });
      return;
    }

    const { entries, aliasedIndexFrom } = normalizeZipEntries(parsed.entries);
    if (entries.length === 0) {
      logUpload({
        slug: parsed.slug,
        bytes: parsed.zipBytes,
        status: "reject",
        files: entries.length,
        reason: "Zip contains no usable files",
      });
      res.status(400).json({ error: "Zip contains no usable files" });
      return;
    }

    // Both headIndex and the serving layer key off <slug>/index.html.
    // normalizeZipEntries already aliases a sole root .html file as
    // index.html (common for LLM-generated single-page output), so this
    // only rejects the genuinely ambiguous cases: several root .html files
    // with no index.html among them, or none at all.
    if (!entries.some((entry) => entry.path === "index.html")) {
      const reason =
        "Zip must contain an index.html at the root, or exactly one root-level .html file to use as one";
      logUpload({
        slug: parsed.slug,
        bytes: parsed.zipBytes,
        status: "reject",
        files: entries.length,
        reason,
      });
      res.status(400).json({ error: reason });
      return;
    }

    const existing = await headIndex(s3Client, bucket, parsed.slug);
    if (existing.exists && !parsed.confirm) {
      logUpload({
        slug: parsed.slug,
        bytes: parsed.zipBytes,
        status: "conflict",
        files: entries.length,
      });
      res.status(409).json({
        error: `Slug "${parsed.slug}" already exists`,
        url: `https://${parsed.slug}.${publicDomain}`,
        ...(existing.uploadedBy !== undefined && { uploadedBy: existing.uploadedBy }),
        ...(existing.uploadedAt !== undefined && { uploadedAt: existing.uploadedAt }),
      });
      return;
    }

    // Cloudflare Access sits in front of this origin and sets this header
    // itself for real, interactive human logins (#52) — trusted. The
    // atelier-mcp connector authenticates with a CF Access service token
    // instead, so that header is never set for its requests; it forwards
    // its own OAuth-verified identity via X-Requested-By. Both that header
    // and the form field are untrusted, connector- or client-supplied
    // provenance metadata — never used for authz, only for attribution.
    const uploadedBy =
      sanitizeUploader(getHeader(req.headers, "Cf-Access-Authenticated-User-Email")) ||
      sanitizeUploader(getHeader(req.headers, "X-Requested-By")) ||
      sanitizeUploader(parsed.uploadedBy) ||
      "anonymous";

    logUpload({
      slug: parsed.slug,
      bytes: parsed.zipBytes,
      status: existing.exists ? "overwrite" : "upload",
      files: entries.length,
      uploadedBy,
    });

    // Delete-then-put per docs/PLAN.md's "replace, not merge" design. A
    // putFile failure mid-loop leaves the old content already gone and the
    // new content partially written — accepted as a PoC-scale tradeoff
    // rather than the more complex put-all-then-delete-orphans ordering.
    await deletePrefix(s3Client, bucket, parsed.slug);

    for (const entry of entries) {
      const isAliasedIndex = entry.path === "index.html" && aliasedIndexFrom !== undefined;
      await putFile(
        s3Client,
        bucket,
        parsed.slug,
        entry.path,
        entry.content,
        resolveContentType(entry.path),
        uploadedBy,
        isAliasedIndex ? { "aliased-from": aliasedIndexFrom } : undefined,
      );
    }

    try {
      await invalidateSlug(cloudFrontClient, distributionId, parsed.slug);
    } catch (err) {
      console.error(`CloudFront invalidation failed for slug "${parsed.slug}":`, err);
    }

    res.status(200).json({
      ok: true,
      url: `https://${parsed.slug}.${publicDomain}`,
      fileCount: entries.length,
      ...(aliasedIndexFrom !== undefined && {
        notes: [`Used ${aliasedIndexFrom} as the homepage since no index.html was found`],
      }),
    });
  } catch (err) {
    if (err instanceof ZipValidationError) {
      const context = (err as ZipValidationError & { uploadContext?: UploadContext }).uploadContext;
      logUpload({
        slug: context?.slug ?? "",
        bytes: context?.zipBytes ?? 0,
        status: "reject",
        reason: err.message,
      });
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
