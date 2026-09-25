import type { NextApiRequest, NextApiResponse } from "next";

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>;

export function withErrorHandler(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      console.error(`${req.method} ${req.url} failed:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
