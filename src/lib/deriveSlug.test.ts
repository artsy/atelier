import { deriveSlug } from "./deriveSlug";

describe("deriveSlug", () => {
  it("strips the .zip extension, case-insensitively", () => {
    expect(deriveSlug("marketing-dashboard.zip")).toEqual({
      valid: true,
      slug: "marketing-dashboard",
    });
    expect(deriveSlug("Marketing-Dashboard.ZIP").slug).toBe("marketing-dashboard");
  });

  it("lowercases and collapses non-alphanumeric runs into single hyphens", () => {
    expect(deriveSlug("My Site!!.zip").slug).toBe("my-site");
    expect(deriveSlug("Q3_Report (final).zip").slug).toBe("q3-report-final");
  });

  it("trims leading and trailing hyphens", () => {
    expect(deriveSlug("--marketing--.zip").slug).toBe("marketing");
    expect(deriveSlug("!!!hello!!!.zip").slug).toBe("hello");
  });

  it("strips an inner .html or .htm left behind by the .zip strip", () => {
    // Zipping a lone HTML file yields `my-site.html.zip`; the inner extension
    // shouldn't leak into the slug as `my-site-html`. See issue #88.
    expect(deriveSlug("my-site.html.zip")).toEqual({
      valid: true,
      slug: "my-site",
    });
    expect(deriveSlug("report.htm.zip").slug).toBe("report");
    expect(deriveSlug("index.html.zip").slug).toBe("index");
  });

  it("caps at 63 characters and re-trims a trailing hyphen left by the cap", () => {
    const derived = deriveSlug(`${"a".repeat(63)}-overflow.zip`);
    expect(derived.slug).toBe("a".repeat(63));

    // 62 a's then a hyphen lands exactly on the cap boundary, which would
    // leave a dangling trailing hyphen if not re-trimmed.
    const boundary = deriveSlug(`${"a".repeat(62)}-b.zip`);
    expect(boundary.slug).toBe("a".repeat(62));
    expect(boundary.slug?.endsWith("-")).toBe(false);
  });

  it("applies the 63-char cap after stripping the inner html extension", () => {
    // The extension is peeled before the cap, so more of the real name survives.
    const derived = deriveSlug(`${"a".repeat(63)}.html.zip`);
    expect(derived.valid).toBe(true);
    expect(derived.slug).toBe("a".repeat(63));
    expect(deriveSlug(`${"a".repeat(70)}.html.zip`).slug).toBe("a".repeat(63));
  });

  it("reports an error when nothing survives sanitization", () => {
    expect(deriveSlug("___.zip")).toEqual({
      valid: false,
      error: "Couldn't derive a name from that filename — try renaming the zip.",
    });
    expect(deriveSlug(".zip").valid).toBe(false);
    expect(deriveSlug(".html.zip")).toEqual({
      valid: false,
      error: "Couldn't derive a name from that filename — try renaming the zip.",
    });
    // No leading dot, so this is a real name rather than a bare extension.
    expect(deriveSlug("html.zip").slug).toBe("html");
  });

  it("delegates to validateSlug for reserved names", () => {
    const derived = deriveSlug("admin.zip");
    expect(derived.valid).toBe(false);
    expect(derived.error).toMatch(/reserved/i);
    expect(derived.slug).toBe("admin");

    // Stripping the inner extension can newly land on a reserved name.
    const fromHtml = deriveSlug("admin.html.zip");
    expect(fromHtml.valid).toBe(false);
    expect(fromHtml.error).toMatch(/reserved/i);
    expect(fromHtml.slug).toBe("admin");
  });
});
