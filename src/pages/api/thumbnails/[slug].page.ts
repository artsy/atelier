import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getS3Client } from "../../../lib/deps";
import { getThumbnail } from "../../../lib/s3";
import { validateSlug } from "../../../lib/slug";
import { withErrorHandler } from "../../../middleware/withErrorHandler";

// The page links here with ?v=<uploadedAt>, so a re-upload changes the URL
// and the image can be cached forever.
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

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

  const image = await getThumbnail(getS3Client(), getConfig().s3Bucket, slug);
  if (!image) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({ error: "No thumbnail" });
    return;
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", IMMUTABLE_CACHE);
  res.status(200).send(Buffer.from(image));
});
