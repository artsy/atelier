import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import { parseUpload } from "./parseUpload";
import { ZipValidationError } from "./zip";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Hand-rolled, uncompressed ("store") zip builder for tests — mirrors
 * zip.test.ts's own copy. Real zip-writer libraries sanitize entry paths,
 * which is fine here since parseUpload tests don't need zip-slip fixtures,
 * but keeping the two builders independent avoids a cross-file test coupling
 * for a ~40-line helper.
 */
function buildZip(entries: Array<{ path: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, "utf8");
    const contentBuf = Buffer.from(entry.content, "utf8");
    const crc = crc32(contentBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuf.length, 18);
    localHeader.writeUInt32LE(contentBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, contentBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuf.length, 20);
    centralHeader.writeUInt32LE(contentBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + contentBuf.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localSection = Buffer.concat(localParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralDirectory, eocd]);
}

const BOUNDARY = "----parseUploadTestBoundary";

interface MultipartField {
  type: "field";
  name: string;
  value: string;
}

interface MultipartFile {
  type: "file";
  name: string;
  filename: string;
  content: Buffer;
}

type MultipartPart = MultipartField | MultipartFile;

/**
 * Hand-builds a real multipart/form-data body, per the ticket's requirement
 * to drive parseUpload without supertest/Express. parseUpload only ever
 * touches `req.headers`, `req.pipe()`, and `req.on("error")` — all
 * IncomingMessage surface — so a bare PassThrough stream with a `.headers`
 * property stands in for a real IncomingMessage.
 */
function buildMultipartBody(parts: MultipartPart[]): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if (part.type === "field") {
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`),
        Buffer.from(part.value),
        Buffer.from("\r\n"),
      );
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            "Content-Type: application/zip\r\n\r\n",
        ),
        part.content,
        Buffer.from("\r\n"),
      );
    }
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

function fakeRequest(body: Buffer): IncomingMessage {
  const stream = new PassThrough();
  const req = stream as unknown as IncomingMessage;
  req.headers = {
    "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
  };
  stream.end(body);
  return req;
}

const VALID_ZIP = buildZip([{ path: "index.html", content: "<html></html>" }]);
const MAX_UPLOAD_BYTES = 1024 * 1024;

describe("parseUpload", () => {
  it("parses slug, confirm, and extracted entries from a well-formed request", async () => {
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "marketing-dashboard" },
      { type: "field", name: "confirm", value: "true" },
      { type: "file", name: "zip", filename: "site.zip", content: VALID_ZIP },
    ]);

    const result = await parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES);

    expect(result.slug).toBe("marketing-dashboard");
    expect(result.confirm).toBe(true);
    expect(result.entries).toEqual([{ path: "index.html", content: Buffer.from("<html></html>") }]);
    expect(result.zipBytes).toBe(VALID_ZIP.length);
  });

  it.each([
    ["true", true],
    ["1", true],
    ["on", true],
    ["TRUE", true],
    ["false", false],
    ["0", false],
    ["", false],
    ["yes", false],
  ])("coerces confirm=%s to %s", async (value, expected) => {
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "some-slug" },
      { type: "field", name: "confirm", value },
      { type: "file", name: "zip", filename: "site.zip", content: VALID_ZIP },
    ]);

    const result = await parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES);

    expect(result.confirm).toBe(expected);
  });

  it("resolves without entries when the multipart field name for the file isn't 'zip'", async () => {
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "some-slug" },
      { type: "file", name: "wrongFieldName", filename: "site.zip", content: VALID_ZIP },
    ]);

    const result = await parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES);

    expect(result.entries).toBeUndefined();
    expect(result.zipBytes).toBe(0);
  });

  it("counts the raw (compressed) zip bytes as busboy streams them in", async () => {
    const bigZip = buildZip([{ path: "index.html", content: "x".repeat(5000) }]);
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "some-slug" },
      { type: "file", name: "zip", filename: "site.zip", content: bigZip },
    ]);

    const result = await parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES);

    expect(result.zipBytes).toBe(bigZip.length);
  });

  it("rejects with ZipValidationError, carrying uploadContext, when busboy truncates the file for exceeding the byte limit", async () => {
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "oversized-slug" },
      { type: "file", name: "zip", filename: "site.zip", content: VALID_ZIP },
    ]);

    await expect(parseUpload(fakeRequest(body), 10)).rejects.toMatchObject({
      constructor: ZipValidationError,
      message: expect.stringContaining("exceeds the 10-byte limit"),
      uploadContext: { slug: "oversized-slug", zipBytes: 10 },
    });
  });

  it("rejects with ZipValidationError when the extracted zip is invalid, attaching uploadContext", async () => {
    const corruptZip = Buffer.from("not a real zip");
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "bad-zip-slug" },
      { type: "file", name: "zip", filename: "site.zip", content: corruptZip },
    ]);

    await expect(parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES)).rejects.toMatchObject({
      uploadContext: { slug: "bad-zip-slug", zipBytes: corruptZip.length },
    });
  });

  it("attaches the uploadedBy form field when present", async () => {
    const body = buildMultipartBody([
      { type: "field", name: "slug", value: "some-slug" },
      { type: "field", name: "uploadedBy", value: "roop@artsymail.com" },
      { type: "file", name: "zip", filename: "site.zip", content: VALID_ZIP },
    ]);

    const result = await parseUpload(fakeRequest(body), MAX_UPLOAD_BYTES);

    expect(result.uploadedBy).toBe("roop@artsymail.com");
  });
});
