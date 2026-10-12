import { getThumbnail, listSlugs } from "./s3";
import { refreshThumbnail, type ThumbnailDeps } from "./thumbnail";

export interface BackfillOptions {
  slugs?: string[];
  missingOnly?: boolean;
}

export interface BackfillResult {
  succeeded: string[];
  skipped: string[];
  failed: Array<{ slug: string; error: string }>;
}

// Sequential on purpose: Browser Rendering limits concurrent sessions.
export async function backfillThumbnails(
  deps: ThumbnailDeps,
  { slugs, missingOnly = false }: BackfillOptions,
): Promise<BackfillResult> {
  if (!deps.thumbnails) {
    throw new Error(
      "Thumbnails are not configured: set CF_ACCOUNT_ID, CF_API_TOKEN, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET",
    );
  }

  const targets = slugs ?? (await listSlugs(deps.s3Client, deps.bucket));
  const result: BackfillResult = { succeeded: [], skipped: [], failed: [] };

  for (const slug of targets) {
    if (missingOnly && (await getThumbnail(deps.s3Client, deps.bucket, slug))) {
      result.skipped.push(slug);
      continue;
    }

    try {
      await refreshThumbnail(deps, slug);
      result.succeeded.push(slug);
    } catch (err) {
      result.failed.push({ slug, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
