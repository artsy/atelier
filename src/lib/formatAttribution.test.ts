import { formatAttribution, formatUploader } from "./formatAttribution";

describe("formatAttribution", () => {
  const NOW = new Date("2026-07-27T12:00:00.000Z");
  const thirtySevenMinutesAgo = new Date(NOW.getTime() - 37 * 60 * 1000).toISOString();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("includes both uploader and time when available", () => {
    expect(formatAttribution("somebody@artsymail.com", thirtySevenMinutesAgo)).toBe(
      "uploaded by somebody@artsymail.com 37 minutes ago",
    );
  });

  it("omits the time when it is unavailable", () => {
    expect(formatAttribution("somebody@artsymail.com", undefined)).toBe(
      "uploaded by somebody@artsymail.com",
    );
  });

  it("omits the uploader when anonymous or absent", () => {
    expect(formatAttribution("anonymous", thirtySevenMinutesAgo)).toBe("uploaded 37 minutes ago");
    expect(formatAttribution(undefined, thirtySevenMinutesAgo)).toBe("uploaded 37 minutes ago");
  });

  it("returns null when there is nothing to show", () => {
    expect(formatAttribution(undefined, undefined)).toBeNull();
    expect(formatAttribution("anonymous", "not a date")).toBeNull();
  });
});

describe("formatUploader", () => {
  it("returns a real uploader as is", () => {
    expect(formatUploader("somebody@artsymail.com")).toBe("somebody@artsymail.com");
  });

  it("returns null for anonymous, empty or absent uploaders", () => {
    expect(formatUploader("anonymous")).toBeNull();
    expect(formatUploader("")).toBeNull();
    expect(formatUploader(undefined)).toBeNull();
  });
});
