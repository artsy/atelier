import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";
import { loadConfig } from "../config";
import { backfillThumbnails } from "../lib/backfillThumbnails";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const missingOnly = args.includes("--missing-only");
  const slugs = args.filter((arg) => !arg.startsWith("--"));

  const config = loadConfig(process.env);
  const result = await backfillThumbnails(
    {
      s3Client: new S3Client({ region: config.s3Region }),
      bucket: config.s3Bucket,
      thumbnails: config.thumbnails,
    },
    { missingOnly, ...(slugs.length > 0 && { slugs }) },
  );

  console.log(
    `${result.succeeded.length} refreshed, ${result.skipped.length} skipped, ${result.failed.length} failed`,
  );
  for (const { slug, error } of result.failed) {
    console.error(`  ${slug}: ${error}`);
  }
  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
