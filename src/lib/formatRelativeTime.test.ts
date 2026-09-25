import { formatRelativeTime } from "./formatRelativeTime";

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-07-27T12:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

  it("returns null when there's no timestamp, or it can't be parsed", () => {
    expect(formatRelativeTime(undefined)).toBeNull();
    expect(formatRelativeTime("")).toBeNull();
    expect(formatRelativeTime("not-a-date")).toBeNull();
  });

  it('collapses anything under a minute to "this minute" (no seconds granularity)', () => {
    expect(formatRelativeTime(secondsAgo(0))).toBe("this minute");
    expect(formatRelativeTime(secondsAgo(1))).toBe("this minute");
    expect(formatRelativeTime(secondsAgo(59))).toBe("this minute");
  });

  it("shows whole minutes once a minute has passed, under an hour", () => {
    expect(formatRelativeTime(secondsAgo(60))).toBe("1 minute ago");
    expect(formatRelativeTime(secondsAgo(90))).toBe("1 minute ago"); // rounds down
    expect(formatRelativeTime(secondsAgo(120))).toBe("2 minutes ago");
    expect(formatRelativeTime(secondsAgo(3599))).toBe("59 minutes ago");
  });

  it("shows whole hours once an hour has passed, under a day", () => {
    expect(formatRelativeTime(secondsAgo(60 * 60))).toBe("1 hour ago");
    expect(formatRelativeTime(secondsAgo(2 * 60 * 60))).toBe("2 hours ago");
    expect(formatRelativeTime(secondsAgo(23 * 60 * 60 + 59 * 60 + 59))).toBe("23 hours ago");
  });

  it("shows whole days once a day has passed, under a month", () => {
    // Intl's numeric:"auto" special-cases exactly -1 day as "yesterday"
    // rather than "1 day ago" — this is real Intl.RelativeTimeFormat
    // behavior, not a bug in the app's own formatting.
    expect(formatRelativeTime(secondsAgo(24 * 60 * 60))).toBe("yesterday");
    expect(formatRelativeTime(secondsAgo(2 * 24 * 60 * 60))).toBe("2 days ago");
    expect(formatRelativeTime(secondsAgo(29 * 24 * 60 * 60))).toBe("29 days ago");
  });

  it('rolls over to "last month" at the 30-day boundary', () => {
    expect(formatRelativeTime(secondsAgo(30 * 24 * 60 * 60))).toBe("last month");
  });

  it("returns null for a future timestamp instead of guessing", () => {
    expect(formatRelativeTime(secondsAgo(-1))).toBeNull();
    expect(formatRelativeTime(secondsAgo(-60 * 60))).toBeNull();
    expect(formatRelativeTime(secondsAgo(-40 * 24 * 60 * 60))).toBeNull();
  });

  it("degrades to null (rather than throwing) when Intl.RelativeTimeFormat is unavailable", () => {
    // The module computes its formatter once at load time via a feature
    // detect — carried over from public/app.js's copy, which needs it for
    // older browsers. Force that branch by removing the API and
    // re-importing the module fresh.
    const original = Intl.RelativeTimeFormat;
    delete (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat;

    jest.resetModules();
    const { formatRelativeTime: withoutIntl } = require("./formatRelativeTime");

    expect(withoutIntl(secondsAgo(60))).toBeNull();

    (Intl as { RelativeTimeFormat: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat = original;
  });
});
