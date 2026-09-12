import type { IncomingMessage } from "node:http";
import Busboy from "busboy";
import { extractZip, type ZipEntry, ZipValidationError } from "./zip";

export interface ParsedUpload {
  slug: string;
  confirm: boolean;
  uploadedBy?: string;
  entries?: ZipEntry[];
  zipBytes: number;
}

const CONFIRM_TRUE_VALUES = new Set(["true", "1", "on"]);

// Attached to parseUpload's rejection so the outer handler can still log a
// slug/size-bearing line for uploads that fail before or during extraction
// (e.g. zip-slip, oversize). Applied via Object.assign rather than a wrapper
// class so `err instanceof ZipValidationError` still holds downstream.
export interface UploadContext {
  slug: string;
  zipBytes: number;
}

/**
 * Streams the multipart request into its form fields plus the zip's
 * validated entries, without ever buffering the whole raw archive in
 * memory (busboy hands `extractZip` the file part as it arrives).
 */
export function parseUpload(req: IncomingMessage, maxUploadBytes: number): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: maxUploadBytes } });

    let slug = "";
    let confirm = false;
    let uploadedBy: string | undefined;
    let entriesPromise: Promise<ZipEntry[]> | undefined;
    let fileStream: (NodeJS.ReadableStream & { truncated?: boolean }) | undefined;
    let zipBytes = 0;
    let settled = false;

    const fail = (err: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      const context: UploadContext = { slug, zipBytes };
      reject(Object.assign(err, { uploadContext: context }));
    };

    bb.on("field", (name, value) => {
      if (name === "slug") {
        slug = value;
      } else if (name === "confirm") {
        confirm = CONFIRM_TRUE_VALUES.has(value.toLowerCase());
      } else if (name === "uploadedBy") {
        uploadedBy = value;
      }
    });

    bb.on("file", (name, stream) => {
      if (name !== "zip" || entriesPromise) {
        stream.resume();
        return;
      }
      fileStream = stream;
      // Counts the raw (compressed) bytes of the zip as busboy streams it in
      // — the size actually dropped, as opposed to extractZip's internal
      // tally of uncompressed entry bytes. Attaching this listener doesn't
      // steal chunks from extractZip's own pipe(); every "data" listener on a
      // flowing stream receives the same chunks.
      stream.on("data", (chunk: Buffer) => {
        zipBytes += chunk.length;
      });
      entriesPromise = extractZip(stream, maxUploadBytes);
    });

    bb.on("error", fail);
    req.on("error", fail);

    bb.on("close", async () => {
      try {
        let entries: ZipEntry[] | undefined;
        try {
          entries = entriesPromise ? await entriesPromise : undefined;
        } catch (err) {
          // busboy truncates the file part on its own fileSize limit rather
          // than erroring it — the truncated bytes then reach extractZip as
          // a corrupt archive, which throws its own (non-ZipValidationError)
          // parse error. Recognize the truncation and report the size cap
          // instead of letting that raw parse error 500.
          if (fileStream?.truncated) {
            throw new ZipValidationError(`Uploaded zip exceeds the ${maxUploadBytes}-byte limit`);
          }
          throw err;
        }

        if (fileStream?.truncated) {
          throw new ZipValidationError(`Uploaded zip exceeds the ${maxUploadBytes}-byte limit`);
        }

        if (settled) {
          return;
        }
        settled = true;
        resolve({
          slug,
          confirm,
          zipBytes,
          ...(uploadedBy !== undefined && { uploadedBy }),
          ...(entries !== undefined && { entries }),
        });
      } catch (err) {
        fail(err as Error);
      }
    });

    req.pipe(bb);
  });
}
