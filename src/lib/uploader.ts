// Long enough for any real email address, the form of value all three
// uploader-identity sources (CF Access header, X-Requested-By, form field)
// take in practice.
const MAX_UPLOADER_LEN = 320;

/**
 * Uploader-identity sources are provenance metadata, not an authz signal
 * (see the trust-boundary note in the POST /upload handler) — treat them as
 * untrusted free text. Strips control characters (this value is round-tripped
 * back out as a raw S3 object-metadata header by GET /check and the sites
 * index) and caps length before a candidate value is considered, so a
 * present-but-garbage header falls through to the next candidate in the
 * precedence chain instead of winning with an empty value.
 */
export function sanitizeUploader(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const cleaned = value
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally stripping them
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_UPLOADER_LEN);
  return cleaned.length > 0 ? cleaned : undefined;
}
