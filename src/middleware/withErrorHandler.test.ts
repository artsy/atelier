import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { withErrorHandler } from "./withErrorHandler";

describe("withErrorHandler", () => {
  it("returns a JSON 500 for a synchronously thrown error", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/throws",
    });

    const handler = withErrorHandler(() => {
      throw new Error("boom");
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal server error" });
    consoleError.mockRestore();
  });

  it("returns a JSON 500 for a rejected async handler", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/rejects",
    });

    const handler = withErrorHandler(async () => {
      throw new Error("async boom");
    });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal server error" });
    consoleError.mockRestore();
  });

  it("logs the underlying error server-side using req.url, not originalUrl", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/throws",
    });

    const handler = withErrorHandler(() => {
      throw new Error("boom");
    });
    await handler(req, res);

    expect(consoleError).toHaveBeenCalledWith(
      "GET /api/throws failed:",
      expect.objectContaining({ message: "boom" }),
    );
    consoleError.mockRestore();
  });

  it("ends the response without writing a body if headers were already sent", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/throws",
    });
    const endSpy = jest.spyOn(res, "end");

    const handler = withErrorHandler(() => {
      res.status(200).json({ ok: true });
      throw new Error("too late");
    });
    await handler(req, res);

    expect(endSpy).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
  });
});
