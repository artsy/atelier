import type { IncomingHttpHeaders } from "node:http";

// Node's raw headers are string | string[] | undefined (some, like
// set-cookie, can repeat) — Express's req.get() narrowed this to a single
// string for us; Pages API routes read req.headers directly and need the
// same narrowing done explicitly.
export function getHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
