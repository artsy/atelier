import type { S3Client } from "@aws-sdk/client-s3";
import { headIndex, listSlugs } from "./s3";

export interface SiteInfo {
  slug: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export type SiteSort = "name" | "recent";

export async function listSites(
  client: S3Client,
  bucket: string,
  sort: SiteSort = "name",
): Promise<SiteInfo[]> {
  const slugs = await listSlugs(client, bucket);
  const sites = await Promise.all(
    slugs.map(async (slug): Promise<SiteInfo> => {
      const { uploadedBy, uploadedAt } = await headIndex(client, bucket, slug);
      return {
        slug,
        ...(uploadedBy !== undefined && { uploadedBy }),
        ...(uploadedAt !== undefined && { uploadedAt }),
      };
    }),
  );

  return sortSites(sites, sort);
}

export function sortSites(sites: SiteInfo[], sort: SiteSort): SiteInfo[] {
  const copy = [...sites];

  if (sort === "recent") {
    // chronological by uploadedAt (oldest first); missing dates sort last
    copy.sort((a, b) => {
      if (a.uploadedAt === undefined) {
        return b.uploadedAt === undefined ? 0 : 1;
      }
      if (b.uploadedAt === undefined) {
        return -1;
      }
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  } else {
    copy.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  return copy;
}
