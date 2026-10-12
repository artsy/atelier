import type { S3Client } from "@aws-sdk/client-s3";
import type { ThumbnailConfig } from "../config";
import { putThumbnail } from "./s3";
import { siteUrl } from "./siteUrl";

type FetchFn = typeof fetch;

export interface ThumbnailDeps {
  s3Client: S3Client;
  bucket: string;
  thumbnails?: ThumbnailConfig | undefined;
}

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const ERROR_BODY_LIMIT = 200;

export async function captureThumbnail(
  slug: string,
  cf: ThumbnailConfig,
  fetchFn: FetchFn = fetch,
): Promise<Uint8Array> {
  const response = await fetchFn(
    `${CLOUDFLARE_API}/accounts/${cf.accountId}/browser-run/screenshot`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cf.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: siteUrl(slug),
        // Half scale yields a ~640x400 thumbnail from a desktop-width render.
        viewport: { width: 1280, height: 800, deviceScaleFactor: 0.5 },
        // "load" fires before client-rendered pages finish painting.
        gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
        screenshotOptions: { type: "jpeg", quality: 80 },
        setExtraHTTPHeaders: {
          "CF-Access-Client-Id": cf.accessClientId,
          "CF-Access-Client-Secret": cf.accessClientSecret,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, ERROR_BODY_LIMIT);
    throw new Error(`Screenshot of "${slug}" failed with ${response.status}: ${body}`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Screenshot of "${slug}" was not an image (got ${contentType || "no type"})`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function refreshThumbnail(
  deps: ThumbnailDeps,
  slug: string,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  if (!deps.thumbnails) {
    return;
  }

  const image = await captureThumbnail(slug, deps.thumbnails, fetchFn);
  await putThumbnail(deps.s3Client, deps.bucket, slug, image);
}
