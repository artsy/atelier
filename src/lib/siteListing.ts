import type { SiteInfo, SiteSort } from "./sites";
import { siteUrl } from "./siteUrl";

export interface SiteListing extends SiteInfo {
  url: string;
}

export const DEFAULT_SITE_SORT: SiteSort = "newest";

const SITE_SORTS: readonly string[] = ["name", "oldest", "newest", "uploader"];

export function parseSiteSort(value: unknown): SiteSort | undefined {
  if (value === undefined) {
    return DEFAULT_SITE_SORT;
  }
  return typeof value === "string" && SITE_SORTS.includes(value) ? (value as SiteSort) : undefined;
}

export function toSiteListing(site: SiteInfo): SiteListing {
  return { ...site, url: siteUrl(site.slug) };
}
