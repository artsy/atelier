import { formatRelativeTime } from "./formatRelativeTime";

// uploadedBy is best-effort provenance, not verified identity: an Access
// email, a free-text form value, "anonymous", or absent. Shown in full
// rather than as a local-part, since Access spans two Google Workspace
// domains (Artsy and Artnet) and the domain disambiguates.
export function formatUploader(value: string | undefined): string | null {
  return !value || value === "anonymous" ? null : value;
}

export function formatAttribution(
  uploadedBy: string | undefined,
  uploadedAt: string | undefined,
): string | null {
  const who = formatUploader(uploadedBy);
  const when = formatRelativeTime(uploadedAt);
  if (who && when) {
    return `uploaded by ${who} ${when}`;
  }
  if (who) {
    return `uploaded by ${who}`;
  }
  if (when) {
    return `uploaded ${when}`;
  }
  return null;
}
