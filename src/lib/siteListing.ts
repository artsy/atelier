import type { SiteInfo, SiteSort } from "./sites";
import { siteUrl } from "./siteUrl";

export interface SiteListing extends SiteInfo {
  url: string;
  thumbnailUrl: string;
}

export const DEFAULT_SITE_SORT: SiteSort = "newest";

const SITE_SORTS: readonly string[] = ["name", "oldest", "newest", "uploader"];

export function parseSiteSort(value: unknown): SiteSort | undefined {
  if (value === undefined) {
    return DEFAULT_SITE_SORT;
  }
  return typeof value === "string" && SITE_SORTS.includes(value) ? (value as SiteSort) : undefined;
}

// Versioned by upload time: a re-upload changes the URL, which lets the
// thumbnail route be cached as immutable.
function thumbnailUrl(site: SiteInfo): string {
  const version = site.uploadedAt ? `?v=${encodeURIComponent(site.uploadedAt)}` : "";
  return `/api/thumbnails/${site.slug}${version}`;
}

export function toSiteListing(site: SiteInfo): SiteListing {
  return { ...site, url: siteUrl(site.slug), thumbnailUrl: thumbnailUrl(site) };
}
