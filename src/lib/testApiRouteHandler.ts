import { createServer, type Server } from "node:http";
import { parse } from "node:url";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

// next-test-api-route-handler's own request stream doesn't survive a real
// multipart body under Pages Router + bodyParser:false (confirmed by
// probing: busboy sees "Unexpected end of form" against it, or the request
// hangs outright) — this is the ticket's documented fallback. A real
// http.Server keeps the raw req/res streaming exactly as production does;
// only req.query and res.status/json need patching on to match what a
// NextApiRequest/NextApiResponse actually offer at runtime.
export function createTestServer(handler: NextApiHandler): Server {
  return createServer((req, res) => {
    const apiReq = req as NextApiRequest;
    const apiRes = res as NextApiResponse;

    apiReq.query = parse(req.url ?? "", true).query;

    apiRes.status = (code: number) => {
      apiRes.statusCode = code;
      return apiRes;
    };
    apiRes.json = (body: unknown) => {
      apiRes.setHeader("Content-Type", "application/json; charset=utf-8");
      apiRes.end(JSON.stringify(body));
      return apiRes;
    };

    Promise.resolve(handler(apiReq, apiRes)).catch((err) => {
      // A handler that fails outside its own error handling — shouldn't
      // happen once withErrorHandler is in place, but a bare 500 here beats
      // an unhandled rejection hanging the test.
      if (!apiRes.headersSent) {
        apiRes.statusCode = 500;
        apiRes.end(JSON.stringify({ error: "Internal server error" }));
      }
      console.error("Unhandled error in test server:", err);
    });
  });
}
