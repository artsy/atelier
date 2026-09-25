import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getS3Client } from "../../lib/deps";
import { headIndex } from "../../lib/s3";
import { validateSlug } from "../../lib/slug";
import { withErrorHandler } from "../../middleware/withErrorHandler";

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

  const result = await headIndex(getS3Client(), getConfig().s3Bucket, slug);
  res.status(200).json(result);
});
