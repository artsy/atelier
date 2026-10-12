import { isZipFile } from "./isZipFile";

describe("isZipFile", () => {
  it("accepts a .zip extension regardless of case or mime type", () => {
    expect(isZipFile(new File(["x"], "site.zip"))).toBe(true);
    expect(isZipFile(new File(["x"], "SITE.ZIP", { type: "application/octet-stream" }))).toBe(true);
  });

  it("accepts zip mime types without a .zip extension", () => {
    expect(isZipFile(new File(["x"], "site", { type: "application/zip" }))).toBe(true);
    expect(isZipFile(new File(["x"], "site", { type: "application/x-zip-compressed" }))).toBe(true);
  });

  it("rejects other files", () => {
    expect(isZipFile(new File(["x"], "site.tar.gz", { type: "application/gzip" }))).toBe(false);
  });
});
