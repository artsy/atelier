import type { S3Client } from "@aws-sdk/client-s3";
import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { getConfig, getS3Client, resetDeps } from "../../../lib/deps";
import { getThumbnail } from "../../../lib/s3";
import handler from "./[slug].page";

jest.mock("../../../lib/s3");
jest.mock("../../../lib/deps", () => ({
  ...jest.requireActual("../../../lib/deps"),
  getS3Client: jest.fn(),
  getConfig: jest.fn(),
}));

const mockGetThumbnail = getThumbnail as jest.MockedFunction<typeof getThumbnail>;
const mockGetS3Client = getS3Client as jest.MockedFunction<typeof getS3Client>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const client = {} as S3Client;
const bucket = "artsy-atelier";

beforeEach(() => {
  mockGetThumbnail.mockReset();
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

function get(query: Record<string, string | string[]>, method: "GET" | "POST" = "GET") {
  return createMocks<NextApiRequest, NextApiResponse>({ method, query });
}

describe("GET /api/thumbnails/[slug]", () => {
  it("serves the stored image with long-lived immutable caching", async () => {
    mockGetThumbnail.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const { req, res } = get({ slug: "gallery" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Content-Type")).toBe("image/jpeg");
    expect(res.getHeader("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(Array.from(res._getData() as Buffer)).toEqual([1, 2, 3]);
    expect(mockGetThumbnail).toHaveBeenCalledWith(client, bucket, "gallery");
  });

  it("returns 404 without long-lived caching when there is no thumbnail", async () => {
    mockGetThumbnail.mockResolvedValue(undefined);
    const { req, res } = get({ slug: "gallery" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(res.getHeader("Cache-Control")).toBe("no-store");
  });

  it("rejects an invalid slug with a 400 before touching S3", async () => {
    const { req, res } = get({ slug: "Not_Valid" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(mockGetThumbnail).not.toHaveBeenCalled();
  });

  it("treats a repeated slug param as invalid, not a crash", async () => {
    const { req, res } = get({ slug: ["one", "two"] });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });

  it("rejects a non-GET method with a 405", async () => {
    const { req, res } = get({ slug: "gallery" }, "POST");

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(mockGetThumbnail).not.toHaveBeenCalled();
  });
});
