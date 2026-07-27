// NOTE: public/app.js carries a hand-synced mirror of this logic (it's a
// dependency-free classic script with no build step, so it can't import this
// module). If you change this formatting, update that mirror too — see
// public/app.js's `formatRelativeTime`.

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// iso is a server-generated ISO timestamp (S3 object metadata) — safe to
// trust, but still validated since it may be absent on older/anonymous
// uploads. Returns null when it can't be parsed.
export function formatRelativeTime(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return null;
  }
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 0) {
    return null; // future timestamp (clock skew or bad metadata) — don't guess
  }
  if (seconds < 60) {
    return relativeTimeFormatter.format(0, "minute"); // "now"-ish, but keep granularity coarse
  }
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (seconds >= unitSeconds) {
      return relativeTimeFormatter.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return relativeTimeFormatter.format(-Math.floor(seconds / 60), "minute");
}
