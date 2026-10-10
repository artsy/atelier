import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getS3Client } from "../../lib/deps";
import { parseSiteSort, toSiteListing } from "../../lib/siteListing";
import { listSites } from "../../lib/sites";
import { withErrorHandler } from "../../middleware/withErrorHandler";

export default withErrorHandler(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sort = parseSiteSort(req.query.sort);
  if (!sort) {
    res
      .status(400)
      .json({ error: 'Invalid sort: expected "name", "oldest", "newest" or "uploader"' });
    return;
  }

  const { s3Bucket, publicDomain } = getConfig();
  const sites = await listSites(getS3Client(), s3Bucket, sort);
  res.status(200).json({ sites: sites.map((site) => toSiteListing(site, publicDomain)) });
});
