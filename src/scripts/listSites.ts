import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";
import { loadConfig } from "../config";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import { listSites, type SiteSort } from "../lib/sites";

function parseSort(argv: string[]): SiteSort {
  const flag = argv.find((arg) => arg.startsWith("--sort="));
  const value = flag?.split("=")[1];
  if (value === "recent" || value === "name") {
    return value;
  }
  if (value !== undefined) {
    throw new Error(`Unknown --sort value "${value}" (expected "name" or "recent")`);
  }
  return "name";
}

async function main(): Promise<void> {
  const sort = parseSort(process.argv.slice(2));
  const config = loadConfig(process.env);
  const client = new S3Client({ region: config.s3Region });

  const sites = await listSites(client, config.s3Bucket, sort);

  if (sites.length === 0) {
    console.log("No sites found.");
    return;
  }

  const slugWidth = Math.max(...sites.map((s) => s.slug.length), "SLUG".length);
  const byWidth = Math.max(...sites.map((s) => (s.uploadedBy ?? "").length), "UPLOADED BY".length);

  const row = (slug: string, by: string, when: string) =>
    `${slug.padEnd(slugWidth)}  ${by.padEnd(byWidth)}  ${when}`;

  console.log(row("SLUG", "UPLOADED BY", "UPLOADED AT"));
  for (const site of sites) {
    const when = formatRelativeTime(site.uploadedAt) ?? "unknown";
    console.log(row(site.slug, site.uploadedBy ?? "unknown", when));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
