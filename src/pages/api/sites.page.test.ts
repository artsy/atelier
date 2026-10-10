import type { S3Client } from "@aws-sdk/client-s3";
import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { getConfig, getS3Client, resetDeps } from "../../lib/deps";
import { listSites } from "../../lib/sites";
import handler from "./sites.page";

jest.mock("../../lib/sites");
jest.mock("../../lib/deps", () => ({
  ...jest.requireActual("../../lib/deps"),
  getS3Client: jest.fn(),
  getConfig: jest.fn(),
}));

const mockListSites = listSites as jest.MockedFunction<typeof listSites>;
const mockGetS3Client = getS3Client as jest.MockedFunction<typeof getS3Client>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const client = {} as S3Client;
const bucket = "artsy-atelier";

beforeEach(() => {
  mockListSites.mockReset();
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

function get(query: Record<string, string | string[]> = {}) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET", query });
  return { req, res };
}

describe("GET /api/sites", () => {
  it("returns sites with their public url, newest first by default", async () => {
    mockListSites.mockResolvedValue([
      {
        slug: "gallery",
        uploadedBy: "somebody@artsymail.com",
        uploadedAt: "2026-07-20T12:00:00.000Z",
      },
      { slug: "no-meta" },
    ]);
    const { req, res } = get();

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      sites: [
        {
          slug: "gallery",
          url: "https://gallery.artsy.dev",
          thumbnailUrl: "/api/thumbnails/gallery?v=2026-07-20T12%3A00%3A00.000Z",
          uploadedBy: "somebody@artsymail.com",
          uploadedAt: "2026-07-20T12:00:00.000Z",
        },
        {
          slug: "no-meta",
          url: "https://no-meta.artsy.dev",
          thumbnailUrl: "/api/thumbnails/no-meta",
        },
      ],
    });
    expect(mockListSites).toHaveBeenCalledWith(client, bucket, "newest");
  });

  it.each(["name", "oldest", "newest", "uploader"])(
    "passes an explicit sort of %s through",
    async (sort) => {
      mockListSites.mockResolvedValue([]);
      const { req, res } = get({ sort });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockListSites).toHaveBeenCalledWith(client, bucket, sort);
    },
  );

  it.each([["bogus"], [["name", "oldest"]]])(
    "rejects an invalid sort (%p) with a 400",
    async (sort) => {
      const { req, res } = get({ sort });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().error).toMatch(/sort/i);
      expect(mockListSites).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-GET method with a 405", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(mockListSites).not.toHaveBeenCalled();
  });
});
