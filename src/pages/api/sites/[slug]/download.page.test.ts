import { Readable } from "node:stream";
import type { S3Client } from "@aws-sdk/client-s3";
import type { Response } from "superagent";
import request from "supertest";
import unzipper from "unzipper";
import { getConfig, getS3Client } from "../../../../lib/deps";
import { getObjectStream, listPrefix } from "../../../../lib/s3";
import { createTestServer } from "../../../../lib/testApiRouteHandler";
import handler from "./download.page";

jest.mock("../../../../lib/s3");
jest.mock("../../../../lib/deps", () => ({
  ...jest.requireActual("../../../../lib/deps"),
  getS3Client: jest.fn(),
  getConfig: jest.fn(),
}));

const mockListPrefix = listPrefix as jest.MockedFunction<typeof listPrefix>;
const mockGetObjectStream = getObjectStream as jest.MockedFunction<typeof getObjectStream>;
const mockGetS3Client = getS3Client as jest.MockedFunction<typeof getS3Client>;
const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

const s3Client = {} as S3Client;
const bucket = "artsy-atelier";

const OBJECTS: Record<string, string> = {
  "price-game/index.html": "<html></html>",
  "price-game/assets/app.js": "console.log(1)",
};

beforeEach(() => {
  mockGetS3Client.mockReturnValue(s3Client);
  mockGetConfig.mockReturnValue({ s3Bucket: bucket } as ReturnType<typeof getConfig>);
  mockListPrefix.mockResolvedValue(Object.keys(OBJECTS));
  mockGetObjectStream.mockImplementation(async (_client, _bucket, key) =>
    Readable.from([Buffer.from(OBJECTS[key] ?? "")]),
  );
});

function get(path: string) {
  return request(createTestServer(handler)).get(path).buffer(true).parse(binaryParser);
}

function binaryParser(res: Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("GET /api/sites/[slug]/download", () => {
  it("rejects methods other than GET", async () => {
    const res = await request(createTestServer(handler)).post("/?slug=price-game");

    expect(res.status).toBe(405);
  });

  it("rejects an invalid slug", async () => {
    const res = await get("/?slug=Not_A_Slug");

    expect(res.status).toBe(400);
    expect(mockListPrefix).not.toHaveBeenCalled();
  });

  it("responds 404 when the site has no files", async () => {
    mockListPrefix.mockResolvedValue([]);

    const res = await get("/?slug=price-game");

    expect(res.status).toBe(404);
  });

  it("streams a zip of the site's files with the slug prefix stripped", async () => {
    const res = await get("/?slug=price-game");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="price-game.zip"');

    const directory = await unzipper.Open.buffer(res.body as Buffer);
    const contents = Object.fromEntries(
      await Promise.all(
        directory.files.map(async (file) => [file.path, (await file.buffer()).toString()]),
      ),
    );
    expect(contents).toEqual({
      "index.html": "<html></html>",
      "assets/app.js": "console.log(1)",
    });
  });

  it("responds 500 when the first object cannot be fetched", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetObjectStream.mockRejectedValueOnce(new Error("Forbidden"));

    const res = await get("/?slug=price-game");

    expect(res.status).toBe(500);
  });

  it("aborts the connection instead of finishing a truncated zip when a later object fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetObjectStream
      .mockResolvedValueOnce(Readable.from([Buffer.from("<html></html>")]))
      .mockRejectedValueOnce(new Error("Forbidden"));

    await expect(get("/?slug=price-game")).rejects.toThrow();
  });

  it("lists the slug's prefix in the configured bucket", async () => {
    await get("/?slug=price-game");

    expect(mockListPrefix).toHaveBeenCalledWith(s3Client, bucket, "price-game");
  });
});
