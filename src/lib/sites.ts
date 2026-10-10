import type { S3Client } from "@aws-sdk/client-s3";
import { formatUploader } from "./formatAttribution";
import { headIndex, listSlugs } from "./s3";

export interface SiteInfo {
  slug: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export type SiteSort = "name" | "oldest" | "newest" | "uploader";

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

// Missing values sort last, in either direction.
function compareDates(a: SiteInfo, b: SiteInfo, direction: 1 | -1): number {
  if (a.uploadedAt === undefined) {
    return b.uploadedAt === undefined ? 0 : 1;
  }
  if (b.uploadedAt === undefined) {
    return -1;
  }
  return direction * a.uploadedAt.localeCompare(b.uploadedAt);
}

// Anonymous and absent uploaders count as missing, and ties go to the
// newest upload, so one person's sites read most-recent first.
function compareUploaders(a: SiteInfo, b: SiteInfo): number {
  const x = formatUploader(a.uploadedBy);
  const y = formatUploader(b.uploadedBy);
  if (x === null || y === null) {
    return x === y ? compareDates(a, b, -1) : x === null ? 1 : -1;
  }
  return x.localeCompare(y, "en", { sensitivity: "base" }) || compareDates(a, b, -1);
}

export function sortSites(sites: SiteInfo[], sort: SiteSort): SiteInfo[] {
  const copy = [...sites];

  switch (sort) {
    case "oldest":
      copy.sort((a, b) => compareDates(a, b, 1));
      break;
    case "newest":
      copy.sort((a, b) => compareDates(a, b, -1));
      break;
    case "uploader":
      copy.sort(compareUploaders);
      break;
    default:
      copy.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  return copy;
}
