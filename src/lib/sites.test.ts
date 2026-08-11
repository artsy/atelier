import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { listSites, sortSites } from "./sites";

const s3Mock = mockClient(S3Client);
const client = new S3Client({ region: "us-east-1" });
const bucket = "artsy-atelier";

beforeEach(() => {
  s3Mock.reset();
});

describe("listSites", () => {
  it("enriches each slug with its index.html upload metadata", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [{ Prefix: "gallery/" }, { Prefix: "hammer-price/" }],
      IsTruncated: false,
    });
    s3Mock.on(HeadObjectCommand, { Bucket: bucket, Key: "gallery/index.html" }).resolves({
      Metadata: { "uploaded-by": "roop@artsymail.com", "uploaded-at": "2026-07-20T12:00:00.000Z" },
    });
    s3Mock.on(HeadObjectCommand, { Bucket: bucket, Key: "hammer-price/index.html" }).resolves({
      Metadata: { "uploaded-by": "anonymous", "uploaded-at": "2026-07-25T12:00:00.000Z" },
    });

    const sites = await listSites(client, bucket, "name");
    expect(sites).toEqual([
      { slug: "gallery", uploadedBy: "roop@artsymail.com", uploadedAt: "2026-07-20T12:00:00.000Z" },
      { slug: "hammer-price", uploadedBy: "anonymous", uploadedAt: "2026-07-25T12:00:00.000Z" },
    ]);
  });

  it("tolerates slugs missing an index.html", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [{ Prefix: "no-index/" }],
      IsTruncated: false,
    });
    s3Mock
      .on(HeadObjectCommand)
      .rejects(Object.assign(new Error("Not Found"), { name: "NotFound" }));

    const sites = await listSites(client, bucket, "name");
    expect(sites).toEqual([{ slug: "no-index" }]);
  });
});

describe("sortSites", () => {
  const sites = [
    { slug: "beta", uploadedAt: "2026-07-20T12:00:00.000Z" },
    { slug: "alpha", uploadedAt: "2026-07-25T12:00:00.000Z" },
    { slug: "gamma" },
  ];

  it("sorts by slug name ascending", () => {
    expect(sortSites(sites, "name").map((s) => s.slug)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("sorts chronologically (oldest first), with missing timestamps last", () => {
    expect(sortSites(sites, "recent").map((s) => s.slug)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...sites];
    sortSites(sites, "name");
    expect(sites).toEqual(copy);
  });
});
