import { getConfig } from "./deps";

export function siteUrl(slug: string): string {
  return `https://${slug}.${getConfig().publicDomain}`;
}
