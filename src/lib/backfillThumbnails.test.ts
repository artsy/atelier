import type { S3Client } from "@aws-sdk/client-s3";
import type { ThumbnailConfig } from "../config";
import { backfillThumbnails } from "./backfillThumbnails";
import { getThumbnail, listSlugs } from "./s3";
import { refreshThumbnail } from "./thumbnail";

jest.mock("./s3");
jest.mock("./thumbnail");

const mockListSlugs = listSlugs as jest.MockedFunction<typeof listSlugs>;
const mockGetThumbnail = getThumbnail as jest.MockedFunction<typeof getThumbnail>;
const mockRefresh = refreshThumbnail as jest.MockedFunction<typeof refreshThumbnail>;

const thumbnails: ThumbnailConfig = {
  accountId: "acct",
  apiToken: "token",
  accessClientId: "id.access",
  accessClientSecret: "secret",
};
const deps = {
  s3Client: {} as S3Client,
  bucket: "artsy-atelier",
  publicDomain: "artsy.dev",
  thumbnails,
};

beforeEach(() => {
  mockListSlugs.mockReset().mockResolvedValue(["alpha", "beta", "gamma"]);
  mockGetThumbnail.mockReset().mockResolvedValue(undefined);
  mockRefresh.mockReset().mockResolvedValue(undefined);
});

describe("backfillThumbnails", () => {
  it("refreshes every site one at a time when no slugs are given", async () => {
    let running = 0;
    let maxRunning = 0;
    mockRefresh.mockImplementation(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
    });

    const result = await backfillThumbnails(deps, {});

    expect(mockRefresh.mock.calls.map((call) => call[1])).toEqual(["alpha", "beta", "gamma"]);
    expect(maxRunning).toBe(1);
    expect(result).toEqual({ succeeded: ["alpha", "beta", "gamma"], skipped: [], failed: [] });
  });

  it("refreshes only the given slugs without listing the bucket", async () => {
    await backfillThumbnails(deps, { slugs: ["beta"] });

    expect(mockListSlugs).not.toHaveBeenCalled();
    expect(mockRefresh.mock.calls.map((call) => call[1])).toEqual(["beta"]);
  });

  it("skips sites that already have a thumbnail when asked", async () => {
    mockGetThumbnail.mockImplementation(async (_c, _b, slug) =>
      slug === "beta" ? new Uint8Array([1]) : undefined,
    );

    const result = await backfillThumbnails(deps, { missingOnly: true });

    expect(mockRefresh.mock.calls.map((call) => call[1])).toEqual(["alpha", "gamma"]);
    expect(result.skipped).toEqual(["beta"]);
  });

  it("keeps going after a failure and reports it", async () => {
    mockRefresh.mockImplementation(async (_deps, slug) => {
      if (slug === "beta") {
        throw new Error("screenshot failed");
      }
    });

    const result = await backfillThumbnails(deps, {});

    expect(result.succeeded).toEqual(["alpha", "gamma"]);
    expect(result.failed).toEqual([{ slug: "beta", error: "screenshot failed" }]);
  });

  it("refuses to run when thumbnails are not configured", async () => {
    const { thumbnails: _omitted, ...unconfigured } = deps;

    await expect(backfillThumbnails(unconfigured, {})).rejects.toThrow(/CF_ACCOUNT_ID/);
  });
});
