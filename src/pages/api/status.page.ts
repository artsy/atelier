import type { NextApiRequest, NextApiResponse } from "next";
import { withErrorHandler } from "../../middleware/withErrorHandler";

export default withErrorHandler((req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.status(200).json({ status: "OK" });
});
