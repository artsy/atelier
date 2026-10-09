import { act, renderHook } from "@testing-library/react";
import { DEFAULT_MAX_UPLOAD_BYTES } from "../config";
import { FakeXhr, installFakeXhr, lastXhr, zipFile } from "../test/fakeXhr";
import { useUpload } from "./useUpload";

beforeEach(installFakeXhr);

function setup() {
  return renderHook(() => useUpload());
}

describe("useUpload", () => {
  it("posts the zip and its derived slug to /api/upload and reports success", () => {
    const { result } = setup();

    act(() => result.current.chooseFile(zipFile("marketing-dashboard.zip")));

    expect(result.current.state).toEqual({ status: "busy", stage: "uploading" });
    const xhr = lastXhr();
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/upload");
    expect(xhr.sentBody?.get("slug")).toBe("marketing-dashboard");
    expect((xhr.sentBody?.get("zip") as File | null)?.name).toBe("marketing-dashboard.zip");

    xhr.respond(200, { ok: true, url: "https://marketing-dashboard.artsy.dev" });

    expect(result.current.state).toEqual({
      status: "success",
      url: "https://marketing-dashboard.artsy.dev",
    });
  });

  it("tracks upload progress, then processing", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile()));

    lastXhr().progress(25, 100);
    expect(result.current.state).toEqual({ status: "busy", stage: "uploading", percent: 25 });

    lastXhr().uploadFinished();
    expect(result.current.state).toEqual({ status: "busy", stage: "processing" });
  });

  it("asks for confirmation on a 409, then re-sends with confirm=true", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile("marketing-dashboard.zip")));

    lastXhr().respond(409, {
      error: "already exists",
      url: "https://marketing-dashboard.artsy.dev",
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-27T11:00:00.000Z",
    });

    expect(result.current.state).toMatchObject({
      status: "confirm",
      slug: "marketing-dashboard",
      existingUrl: "https://marketing-dashboard.artsy.dev",
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: "2026-07-27T11:00:00.000Z",
    });

    act(() => result.current.confirmOverwrite());

    expect(FakeXhr.instances).toHaveLength(2);
    expect(lastXhr().sentBody?.get("confirm")).toBe("true");
    expect(lastXhr().sentBody?.get("slug")).toBe("marketing-dashboard");

    lastXhr().respond(200, { ok: true, url: "https://marketing-dashboard.artsy.dev" });
    expect(result.current.state.status).toBe("success");
  });

  it("returns to idle without a second upload when the overwrite is dismissed", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile()));
    lastXhr().respond(409, { error: "already exists" });

    act(() => result.current.dismiss());

    expect(result.current.state).toEqual({ status: "idle" });
    expect(FakeXhr.instances).toHaveLength(1);
  });

  it("ignores confirmOverwrite when nothing is awaiting confirmation", () => {
    const { result } = setup();

    act(() => result.current.confirmOverwrite());

    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("rejects non-zip files without contacting the server", () => {
    const { result } = setup();

    act(() => result.current.chooseFile(new File(["x"], "notes.txt", { type: "text/plain" })));

    expect(result.current.state).toEqual({ status: "error", message: "Please drop a .zip file." });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("rejects files over the upload limit without contacting the server", () => {
    const { result } = setup();
    const oversized = zipFile("big-site.zip");
    Object.defineProperty(oversized, "size", { value: DEFAULT_MAX_UPLOAD_BYTES + 1 });

    act(() => result.current.chooseFile(oversized));

    expect(result.current.state).toEqual({
      status: "error",
      message: "That file is larger than the upload limit.",
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("rejects a filename that can't derive a valid slug", () => {
    const { result } = setup();

    act(() => result.current.chooseFile(zipFile("___.zip")));

    expect(result.current.state).toMatchObject({ status: "error" });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("ignores new files while an upload is in flight", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile("first.zip")));

    act(() => result.current.chooseFile(zipFile("second.zip")));

    expect(FakeXhr.instances).toHaveLength(1);
  });

  it("ignores a missing file", () => {
    const { result } = setup();

    act(() => result.current.chooseFile(undefined));

    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("surfaces the server's error message", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile()));

    lastXhr().respond(400, { error: "Zip is empty" });

    expect(result.current.state).toEqual({ status: "error", message: "Zip is empty" });
  });

  it("falls back to a generic message for unparseable responses and network errors", () => {
    const { result } = setup();
    act(() => result.current.chooseFile(zipFile()));
    const xhr = lastXhr();
    xhr.status = 502;
    xhr.responseText = "<html>bad gateway</html>";
    xhr.respondRaw();

    expect(result.current.state).toEqual({
      status: "error",
      message: "Something went wrong — please retry.",
    });

    act(() => result.current.chooseFile(zipFile()));
    lastXhr().networkError();

    expect(result.current.state).toEqual({
      status: "error",
      message: "Network error — please retry.",
    });
  });

  it("aborts an in-flight upload on unmount", () => {
    const { result, unmount } = setup();
    act(() => result.current.chooseFile(zipFile()));

    unmount();

    expect(lastXhr().aborted).toBe(true);
  });
});
