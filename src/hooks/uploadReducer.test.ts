import { type UploadState, uploadReducer } from "./uploadReducer";

const idle: UploadState = { status: "idle" };
const file = new File(["x"], "my-site.zip");

describe("uploadReducer", () => {
  it("starts an upload", () => {
    expect(uploadReducer(idle, { type: "started" })).toEqual({
      status: "busy",
      stage: "uploading",
    });
  });

  it("records upload progress while busy", () => {
    const busy = uploadReducer(idle, { type: "started" });

    expect(uploadReducer(busy, { type: "progressed", percent: 42 })).toEqual({
      status: "busy",
      stage: "uploading",
      percent: 42,
    });
  });

  it("moves to processing once the bytes are sent", () => {
    const busy = uploadReducer(idle, { type: "started" });

    expect(uploadReducer(busy, { type: "processing" })).toEqual({
      status: "busy",
      stage: "processing",
    });
  });

  it("ignores progress and processing events when not busy", () => {
    const failed: UploadState = { status: "error", message: "nope" };

    expect(uploadReducer(failed, { type: "progressed", percent: 10 })).toBe(failed);
    expect(uploadReducer(failed, { type: "processing" })).toBe(failed);
  });

  it("records success, failure and conflict outcomes", () => {
    expect(uploadReducer(idle, { type: "succeeded", url: "https://a.example" })).toEqual({
      status: "success",
      url: "https://a.example",
    });
    expect(uploadReducer(idle, { type: "failed", message: "boom" })).toEqual({
      status: "error",
      message: "boom",
    });
    expect(
      uploadReducer(idle, {
        type: "conflicted",
        slug: "my-site",
        file,
        existingUrl: "https://my-site.example",
        uploadedBy: "somebody@artsymail.com",
        uploadedAt: "2026-07-27T11:00:00.000Z",
      }),
    ).toEqual({
      status: "confirm",
      slug: "my-site",
      file,
      existingUrl: "https://my-site.example",
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-27T11:00:00.000Z",
    });
  });

  it("returns to idle when dismissed", () => {
    const confirm: UploadState = { status: "confirm", slug: "my-site", file };

    expect(uploadReducer(confirm, { type: "dismissed" })).toEqual(idle);
  });
});
