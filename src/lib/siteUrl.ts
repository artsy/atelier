export function siteUrl(slug: string, publicDomain: string): string {
  return `https://${slug}.${publicDomain}`;
}
