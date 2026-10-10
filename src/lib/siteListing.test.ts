import { parseSiteSort, toSiteListing } from "./siteListing";

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
    expect(
      toSiteListing({ slug: "gallery", uploadedBy: "somebody@artsymail.com" }, "artsy.dev"),
    ).toEqual({
      slug: "gallery",
      uploadedBy: "somebody@artsymail.com",
      url: "https://gallery.artsy.dev",
    });
  });
});
