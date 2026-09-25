import type { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import type { S3Client } from "@aws-sdk/client-s3";
import request from "supertest";
import { invalidateSlug } from "../../lib/cloudfront";
import { getCloudFrontClient, getConfig, getS3Client, resetDeps } from "../../lib/deps";
import { deletePrefix, headIndex, putFile } from "../../lib/s3";
import { createTestServer } from "../../lib/testApiRouteHandler";
import { extractZip, ZipValidationError } from "../../lib/zip";
import handler from "./upload.page";

// bodyParser: false is what makes streaming multipart work at all under
// Pages Router — a mistake here manifests as a Jest *timeout*, not a
// failure, since req.pipe(bb) hangs rather than errors. Fail fast and
// legibly instead of waiting out Jest's default 5s per test.
jest.setTimeout(3000);

jest.mock("../../lib/s3");
// Keep the real ZipValidationError class — a plain jest.mock() automocks it
// too, which drops its constructor logic and leaves err.message empty.
jest.mock("../../lib/zip", () => ({
  ...jest.requireActual("../../lib/zip"),
  extractZip: jest.fn(),
}));
jest.mock("../../lib/cloudfront");
jest.mock("../../lib/deps", () => ({
  ...jest.requireActual("../../lib/deps"),
  getS3Client: jest.fn(),
  getCloudFrontClient: jest.fn(),
  getConfig: jest.fn(),
}));

const mockHeadIndex = headIndex as jest.MockedFunction<typeof headIndex>;
const mockDeletePrefix = deletePrefix as jest.MockedFunction<typeof deletePrefix>;
const mockPutFile = putFile as jest.MockedFunction<typeof putFile>;
const mockExtractZip = extractZip as jest.MockedFunction<typeof extractZip>;
const mockInvalidateSlug = invalidateSlug as jest.MockedFunction<typeof invalidateSlug>;
const mockGetS3Client = getS3Client as jest.MockedFunction<typeof getS3Client>;
const mockGetCloudFrontClient = getCloudFrontClient as jest.MockedFunction<
  typeof getCloudFrontClient
>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

const s3Client = {} as S3Client;
const cloudFrontClient = {} as CloudFrontClient;
const bucket = "artsy-atelier";
const distributionId = "E123EXAMPLE";
const publicDomain = "artsy.dev";
const maxUploadBytes = 52428800;

const ZIP_ENTRIES = [
  { path: "index.html", content: Buffer.from("<html></html>") },
  { path: "assets/app.js", content: Buffer.from("console.log(1)") },
];

// extractZip is mocked below, so it never actually reads the busboy file
// stream it's handed. Without draining it here, busboy's internal parser
// never finishes consuming that part and its "close" event never fires —
// the request hangs. Every mock implementation must resume() the stream,
// whether it goes on to resolve or reject.
function resolvingExtractZip(entries: typeof ZIP_ENTRIES) {
  return (stream: NodeJS.ReadableStream) => {
    stream.resume();
    return Promise.resolve(entries);
  };
}

function rejectingExtractZip(err: Error) {
  return (stream: NodeJS.ReadableStream) => {
    stream.resume();
    return Promise.reject(err);
  };
}

function buildServer(overrides: { maxUploadBytes?: number } = {}) {
  mockGetConfig.mockReturnValue({
    s3Bucket: bucket,
    s3Region: "us-east-1",
    cloudfrontDistributionId: distributionId,
    publicDomain,
    maxUploadBytes,
    port: 8080,
    ...overrides,
  });
  return createTestServer(handler);
}

const DEFAULT_ZIP_BUFFER = Buffer.from("PK\x03\x04fake");

// `null` (not the default `undefined`) means "send no zip file" — a default
// parameter value is substituted even when a caller explicitly passes
// `undefined`, so `undefined` can't be used as the "omit it" signal here.
function postUpload(
  fields: Record<string, string> = {},
  zipBuffer: Buffer | null = DEFAULT_ZIP_BUFFER,
  overrides: { maxUploadBytes?: number } = {},
) {
  let req = request(buildServer(overrides)).post("/api/upload");
  for (const [key, value] of Object.entries(fields)) {
    req = req.field(key, value);
  }
  if (zipBuffer) {
    req = req.attach("zip", zipBuffer, "site.zip");
  }
  return req;
}

let consoleLog: jest.SpiedFunction<typeof console.log>;

beforeEach(() => {
  mockHeadIndex.mockReset().mockResolvedValue({ exists: false });
  mockDeletePrefix.mockReset().mockResolvedValue(0);
  mockPutFile.mockReset().mockResolvedValue(undefined);
  mockExtractZip.mockReset().mockImplementation(resolvingExtractZip(ZIP_ENTRIES));
  mockInvalidateSlug.mockReset().mockResolvedValue(undefined);
  mockGetS3Client.mockReturnValue(s3Client);
  mockGetCloudFrontClient.mockReturnValue(cloudFrontClient);
  consoleLog = jest.spyOn(console, "log").mockImplementation();
});

afterEach(() => {
  consoleLog.mockRestore();
  resetDeps();
});

// Every upload attempt logs one JSON line; grab and parse the most recent one.
function lastUploadLog() {
  const call = consoleLog.mock.calls.at(-1);
  return call ? JSON.parse(call[0] as string) : undefined;
}

describe("POST /api/upload", () => {
  it("rejects a non-POST method with a 405", async () => {
    const res = await request(buildServer()).get("/api/upload");
    expect(res.status).toBe(405);
  });

  it("uploads a fresh slug and returns the live URL", async () => {
    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      url: "https://marketing-dashboard.artsy.dev",
      fileCount: 2,
    });
    expect(mockDeletePrefix).toHaveBeenCalledWith(s3Client, bucket, "marketing-dashboard");
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      ZIP_ENTRIES[0]?.content,
      "text/html",
      "anonymous",
      undefined,
    );
    expect(mockInvalidateSlug).toHaveBeenCalledWith(
      cloudFrontClient,
      distributionId,
      "marketing-dashboard",
    );
    expect(lastUploadLog()).toEqual({
      event: "upload",
      slug: "marketing-dashboard",
      bytes: DEFAULT_ZIP_BUFFER.byteLength,
      status: "upload",
      files: 2,
      uploadedBy: "anonymous",
    });
  });

  it("rejects an existing slug without confirm with a 409, surfacing the prior uploader/time", async () => {
    mockHeadIndex.mockResolvedValue({
      exists: true,
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-16T12:00:00.000Z",
    });

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'Slug "marketing-dashboard" already exists',
      url: "https://marketing-dashboard.artsy.dev",
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-16T12:00:00.000Z",
    });
    expect(mockDeletePrefix).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("rejects an invalid slug with a 4xx and clear message", async () => {
    const res = await postUpload({ slug: "Bad_Slug" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lowercase/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("rejects a zip-slip / oversized zip with a 4xx surfacing the validation message", async () => {
    mockExtractZip.mockImplementation(
      rejectingExtractZip(
        new ZipValidationError('Zip entry escapes the archive root: "../escape"'),
      ),
    );

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/escapes the archive root/i);
    expect(mockDeletePrefix).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("surfaces busboy's fileSize truncation as a 400, not a 500", async () => {
    // busboy truncates the file part in place rather than erroring it once
    // its own fileSize limit is hit; the truncated bytes then reach
    // extractZip as a corrupt archive. Simulate that: a generic parse error
    // (not ZipValidationError) from extractZip on a stream that busboy has
    // marked truncated.
    mockExtractZip.mockImplementation((stream) => {
      stream.resume();
      return Promise.reject(new Error("invalid signature (readSlice)"));
    });

    const res = await postUpload(
      { slug: "marketing-dashboard" },
      Buffer.from("PK\x03\x04 this archive is well over five bytes"),
      { maxUploadBytes: 5 },
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/byte limit/i);
  });

  it("still returns 200 when CloudFront invalidation fails, logging the error", async () => {
    mockInvalidateSlug.mockRejectedValue(
      Object.assign(new Error("Throttled"), { name: "Throttling" }),
    );
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("strips a Finder-compressed wrapping folder and its __MACOSX junk before writing to S3", async () => {
    mockExtractZip.mockImplementation(
      resolvingExtractZip([
        { path: "test-upload/index.html", content: Buffer.from("<html></html>") },
        { path: "__MACOSX/test-upload/._index.html", content: Buffer.from("junk") },
      ]),
    );

    const res = await postUpload({ slug: "test-upload" });

    expect(res.status).toBe(200);
    expect(res.body.fileCount).toBe(1);
    expect(mockPutFile).toHaveBeenCalledTimes(1);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "test-upload",
      "index.html",
      Buffer.from("<html></html>"),
      "text/html",
      "anonymous",
      undefined,
    );
  });

  it("aliases a sole root .html file as index.html and notes it in the response", async () => {
    mockExtractZip.mockImplementation(
      resolvingExtractZip([
        { path: "art-history-quiz.html", content: Buffer.from("<html>quiz</html>") },
        { path: "assets/quiz.css", content: Buffer.from("body {}") },
      ]),
    );

    const res = await postUpload({ slug: "art-quiz" });

    expect(res.status).toBe(200);
    expect(res.body.fileCount).toBe(3);
    expect(res.body.notes).toEqual([
      "Used art-history-quiz.html as the homepage since no index.html was found",
    ]);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "art-quiz",
      "art-history-quiz.html",
      Buffer.from("<html>quiz</html>"),
      "text/html",
      "anonymous",
      undefined,
    );
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "art-quiz",
      "index.html",
      Buffer.from("<html>quiz</html>"),
      "text/html",
      "anonymous",
      { "aliased-from": "art-history-quiz.html" },
    );
  });

  it("rejects a zip with multiple root-level .html files and no index.html", async () => {
    mockExtractZip.mockImplementation(
      resolvingExtractZip([
        { path: "page1.html", content: Buffer.from("a") },
        { path: "page2.html", content: Buffer.from("b") },
      ]),
    );

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/index\.html/i);
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("rejects a zip that contains nothing but macOS junk", async () => {
    mockExtractZip.mockImplementation(
      resolvingExtractZip([{ path: "__MACOSX/._index.html", content: Buffer.from("junk") }]),
    );

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no usable files/i);
    expect(mockDeletePrefix).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("rejects a zip with no root index.html", async () => {
    mockExtractZip.mockImplementation(
      resolvingExtractZip([{ path: "assets/app.js", content: Buffer.from("console.log(1)") }]),
    );

    const res = await postUpload({ slug: "marketing-dashboard" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/index\.html/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
    expect(mockDeletePrefix).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it("rejects a reserved slug with a 4xx and clear message", async () => {
    const res = await postUpload({ slug: "admin" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reserved/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("rejects a request with no zip file", async () => {
    const res = await postUpload({ slug: "marketing-dashboard" }, null);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/zip/i);
    expect(mockHeadIndex).not.toHaveBeenCalled();
  });

  it("replaces an existing slug when confirm is set", async () => {
    mockHeadIndex.mockResolvedValue({
      exists: true,
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-16T12:00:00.000Z",
    });

    const res = await postUpload({ slug: "marketing-dashboard", confirm: "true" });

    expect(res.status).toBe(200);
    expect(mockDeletePrefix).toHaveBeenCalledWith(s3Client, bucket, "marketing-dashboard");
    expect(mockPutFile).toHaveBeenCalledTimes(2);
    expect(lastUploadLog()).toEqual({
      event: "upload",
      slug: "marketing-dashboard",
      bytes: DEFAULT_ZIP_BUFFER.byteLength,
      status: "overwrite",
      files: 2,
      uploadedBy: "anonymous",
    });
  });

  it("stamps the form uploadedBy field when no Access header is present", async () => {
    await postUpload({ slug: "marketing-dashboard", uploadedBy: "somebody@artsymail.com" });

    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      expect.anything(),
      expect.anything(),
      "somebody@artsymail.com",
      undefined,
    );
  });

  it("prefers the Cf-Access-Authenticated-User-Email header over the form field", async () => {
    const res = await request(buildServer())
      .post("/api/upload")
      .set("Cf-Access-Authenticated-User-Email", "access@artsymail.com")
      .field("slug", "marketing-dashboard")
      .field("uploadedBy", "somebody@artsymail.com")
      .attach("zip", DEFAULT_ZIP_BUFFER, "site.zip");

    expect(res.status).toBe(200);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      expect.anything(),
      expect.anything(),
      "access@artsymail.com",
      undefined,
    );
  });

  it("stamps the X-Requested-By header when no Access header is present", async () => {
    const res = await request(buildServer())
      .post("/api/upload")
      .set("X-Requested-By", "connector-user@artsymail.com")
      .field("slug", "marketing-dashboard")
      .attach("zip", DEFAULT_ZIP_BUFFER, "site.zip");

    expect(res.status).toBe(200);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      expect.anything(),
      expect.anything(),
      "connector-user@artsymail.com",
      undefined,
    );
    expect(lastUploadLog()).toMatchObject({ uploadedBy: "connector-user@artsymail.com" });
  });

  it("prefers the Cf-Access-Authenticated-User-Email header over X-Requested-By", async () => {
    const res = await request(buildServer())
      .post("/api/upload")
      .set("Cf-Access-Authenticated-User-Email", "access@artsymail.com")
      .set("X-Requested-By", "connector-user@artsymail.com")
      .field("slug", "marketing-dashboard")
      .attach("zip", DEFAULT_ZIP_BUFFER, "site.zip");

    expect(res.status).toBe(200);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      expect.anything(),
      expect.anything(),
      "access@artsymail.com",
      undefined,
    );
  });

  it("prefers X-Requested-By over the form uploadedBy field", async () => {
    const res = await request(buildServer())
      .post("/api/upload")
      .set("X-Requested-By", "connector-user@artsymail.com")
      .field("slug", "marketing-dashboard")
      .field("uploadedBy", "somebody@artsymail.com")
      .attach("zip", DEFAULT_ZIP_BUFFER, "site.zip");

    expect(res.status).toBe(200);
    expect(mockPutFile).toHaveBeenCalledWith(
      s3Client,
      bucket,
      "marketing-dashboard",
      "index.html",
      expect.anything(),
      expect.anything(),
      "connector-user@artsymail.com",
      undefined,
    );
  });

  it("caps an oversized X-Requested-By header before logging or storing it", async () => {
    const oversized = `user-${"a".repeat(400)}@artsymail.com`;

    const res = await request(buildServer())
      .post("/api/upload")
      .set("X-Requested-By", oversized)
      .field("slug", "marketing-dashboard")
      .attach("zip", DEFAULT_ZIP_BUFFER, "site.zip");

    expect(res.status).toBe(200);
    const [, , , , , , storedUploadedBy] = mockPutFile.mock.calls[0] ?? [];
    expect(storedUploadedBy).toHaveLength(320);
    expect(oversized.startsWith(storedUploadedBy as string)).toBe(true);
    expect(lastUploadLog().uploadedBy).toHaveLength(320);
  });
});
