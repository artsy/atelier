import type { S3Client } from "@aws-sdk/client-s3";
import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { getConfig, getS3Client, resetDeps } from "../../lib/deps";
import { headIndex } from "../../lib/s3";
import handler from "./check.page";

jest.mock("../../lib/s3");
jest.mock("../../lib/deps", () => ({
  ...jest.requireActual("../../lib/deps"),
  getS3Client: jest.fn(),
  getConfig: jest.fn(),
}));

const mockHeadIndex = headIndex as jest.MockedFunction<typeof headIndex>;
const mockGetS3Client = getS3Client as jest.MockedFunction<typeof getS3Client>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const client = {} as S3Client;
const bucket = "artsy-atelier";

beforeEach(() => {
  mockHeadIndex.mockReset();
  mockGetS3Client.mockReturnValue(client);
  mockGetConfig.mockReturnValue({
    s3Bucket: bucket,
    s3Region: "us-east-1",
    cloudfrontDistributionId: "E123",
    publicDomain: "artsy.dev",
    maxUploadBytes: 52428800,
    port: 8080,
  });
});

afterEach(() => {
  resetDeps();
});

describe("GET /api/check", () => {
  it("returns exists: false for a non-existent slug", async () => {
    mockHeadIndex.mockResolvedValue({ exists: false });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: "new-site" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ exists: false });
    expect(mockHeadIndex).toHaveBeenCalledWith(client, bucket, "new-site");
  });

  it("returns the prior uploader and timestamp for an existing slug", async () => {
    mockHeadIndex.mockResolvedValue({
      exists: true,
      uploadedBy: "roop@artsymail.com",
      uploadedAt: "2026-07-16T12:00:00.000Z",
    });
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: "marketing-dashboard" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      exists: true,
      uploadedBy: "roop@artsymail.com",
      uploadedAt: "2026-07-16T12:00:00.000Z",
    });
  });

  it("rejects an invalid slug with a 4xx and clear message", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: "Not_Valid" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toMatch(/lowercase/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("rejects a reserved slug with a 4xx and clear message", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: "admin" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toMatch(/reserved/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("returns a JSON 500 when the S3 lookup fails unexpectedly", async () => {
    mockHeadIndex.mockRejectedValue(new Error("Forbidden"));
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: "marketing-dashboard" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({ error: "Internal server error" });
    consoleError.mockRestore();
  });

  it("rejects a missing slug param with a 4xx", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("treats an array-valued slug param (repeated query key) as invalid, not a crash", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { slug: ["one", "two"] },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("rejects a non-GET method with a 405", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { slug: "marketing-dashboard" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });
});
