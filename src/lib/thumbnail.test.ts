import type { S3Client } from "@aws-sdk/client-s3";
import type { ThumbnailConfig } from "../config";
import { putThumbnail } from "./s3";
import { captureThumbnail, refreshThumbnail } from "./thumbnail";

jest.mock("./s3");
jest.mock("./deps", () => ({ getConfig: () => ({ publicDomain: "artsy.dev" }) }));

const mockPutThumbnail = putThumbnail as jest.MockedFunction<typeof putThumbnail>;

const cf: ThumbnailConfig = {
  accountId: "acct",
  apiToken: "api-token",
  accessClientId: "id.access",
  accessClientSecret: "secret",
};

function imageResponse(bytes: number[] = [1, 2, 3]) {
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg" } });
}

describe("captureThumbnail", () => {
  it("asks Cloudflare to screenshot the site, authenticating past Access", async () => {
    const fetchFn = jest.fn().mockResolvedValue(imageResponse());

    await captureThumbnail("gallery", cf, fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/browser-run/screenshot");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer api-token" });
    expect(JSON.parse(init.body)).toEqual({
      url: "https://gallery.artsy.dev",
      viewport: { width: 1280, height: 800, deviceScaleFactor: 0.5 },
      gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
      screenshotOptions: { type: "jpeg", quality: 80 },
      setExtraHTTPHeaders: {
        "CF-Access-Client-Id": "id.access",
        "CF-Access-Client-Secret": "secret",
      },
    });
  });

  it("returns the image bytes", async () => {
    const fetchFn = jest.fn().mockResolvedValue(imageResponse([9, 8, 7]));

    const bytes = await captureThumbnail("gallery", cf, fetchFn);

    expect(Array.from(bytes)).toEqual([9, 8, 7]);
  });

  it("throws with the status and body on a failed response", async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));

    await expect(captureThumbnail("gallery", cf, fetchFn)).rejects.toThrow(/429.*rate limited/);
  });

  it("throws when a 200 response is not an image", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(captureThumbnail("gallery", cf, fetchFn)).rejects.toThrow(/not an image/i);
  });
});

describe("refreshThumbnail", () => {
  const s3Client = {} as S3Client;

  it("captures the site and stores the thumbnail", async () => {
    const fetchFn = jest.fn().mockResolvedValue(imageResponse([1, 2, 3]));

    await refreshThumbnail(
      { s3Client, bucket: "artsy-atelier", thumbnails: cf },
      "gallery",
      fetchFn,
    );

    expect(mockPutThumbnail).toHaveBeenCalledWith(
      s3Client,
      "artsy-atelier",
      "gallery",
      new Uint8Array([1, 2, 3]),
    );
  });

  it("does nothing when thumbnails are not configured", async () => {
    const fetchFn = jest.fn();

    await refreshThumbnail({ s3Client, bucket: "artsy-atelier" }, "gallery", fetchFn);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(mockPutThumbnail).not.toHaveBeenCalled();
  });

  it("does not store anything when the capture fails", async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response("boom", { status: 500 }));

    await expect(
      refreshThumbnail({ s3Client, bucket: "artsy-atelier", thumbnails: cf }, "gallery", fetchFn),
    ).rejects.toThrow(/500/);
    expect(mockPutThumbnail).not.toHaveBeenCalled();
  });
});
