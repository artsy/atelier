import { parseSiteSort, toSiteListing } from "./siteListing";

jest.mock("./deps", () => ({ getConfig: () => ({ publicDomain: "artsy.dev" }) }));

describe("parseSiteSort", () => {
  it("defaults to newest when absent", () => {
    expect(parseSiteSort(undefined)).toBe("newest");
  });

  it.each(["name", "oldest", "newest", "uploader"])("accepts %s", (value) => {
    expect(parseSiteSort(value)).toBe(value);
  });

  it("returns undefined for unknown or repeated values", () => {
    expect(parseSiteSort("bogus")).toBeUndefined();
    expect(parseSiteSort(["name", "oldest"])).toBeUndefined();
  });
});

describe("toSiteListing", () => {
  it("adds the public url and keeps upload metadata", () => {
    expect(toSiteListing({ slug: "gallery", uploadedBy: "somebody@artsymail.com" })).toEqual({
      slug: "gallery",
      uploadedBy: "somebody@artsymail.com",
      url: "https://gallery.artsy.dev",
      thumbnailUrl: "/api/thumbnails/gallery",
    });
  });
});

describe("toSiteListing thumbnailUrl", () => {
  it("is versioned by upload time so a re-upload busts the cache", () => {
    const listing = toSiteListing(
      { slug: "gallery", uploadedAt: "2026-07-20T12:00:00.000Z" },
      "artsy.dev",
    );

    expect(listing.thumbnailUrl).toBe("/api/thumbnails/gallery?v=2026-07-20T12%3A00%3A00.000Z");
  });

  it("has no version when the upload time is unknown", () => {
    expect(toSiteListing({ slug: "gallery" }, "artsy.dev").thumbnailUrl).toBe(
      "/api/thumbnails/gallery",
    );
  });
});
