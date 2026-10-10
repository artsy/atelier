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

  it("sorts oldest first, with missing timestamps last", () => {
    expect(sortSites(sites, "oldest").map((s) => s.slug)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("sorts newest first, with missing timestamps still last", () => {
    expect(sortSites(sites, "newest").map((s) => s.slug)).toEqual(["alpha", "beta", "gamma"]);
  });

  describe("by uploader", () => {
    const uploaded = [
      { slug: "a", uploadedBy: "zoe@artsymail.com", uploadedAt: "2026-07-01T12:00:00.000Z" },
      { slug: "b", uploadedBy: "Anna@artsymail.com", uploadedAt: "2026-07-02T12:00:00.000Z" },
      { slug: "c", uploadedBy: "anna@artsymail.com", uploadedAt: "2026-07-09T12:00:00.000Z" },
      { slug: "d", uploadedBy: "anonymous", uploadedAt: "2026-07-30T12:00:00.000Z" },
      { slug: "e" },
    ];

    it("sorts uploaders alphabetically without regard to case", () => {
      const order = sortSites(uploaded, "uploader").map((s) => s.slug);

      expect(order.slice(0, 3)).toEqual(["c", "b", "a"]);
    });

    it("puts anonymous and unknown uploaders last", () => {
      const order = sortSites(uploaded, "uploader").map((s) => s.slug);

      expect(order.slice(3)).toEqual(["d", "e"]);
    });

    it("lists an uploader's sites newest first", () => {
      const order = sortSites(uploaded, "uploader").map((s) => s.slug);

      expect(order.indexOf("c")).toBeLessThan(order.indexOf("b"));
    });
  });

  it("does not mutate the input array", () => {
    const copy = [...sites];
    sortSites(sites, "name");
    expect(sites).toEqual(copy);
  });
});
