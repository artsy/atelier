import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import handler from "./status.page";

describe("GET /api/status", () => {
  it("returns status OK", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ status: "OK" });
  });

  it("rejects a non-GET method with a 405", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });
});
