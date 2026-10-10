import { Text } from "@artsy/palette";
import { formatUploader } from "../lib/formatAttribution";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import type { SiteListing } from "../lib/siteListing";
import { SiteLink } from "./SiteLink";
import { SiteThumbnail } from "./SiteThumbnail";

export function SiteCard({ site, eager = false }: { site: SiteListing; eager?: boolean }) {
  const uploader = formatUploader(site.uploadedBy);
  const when = formatRelativeTime(site.uploadedAt);

  return (
    <>
      <SiteThumbnail site={site} eager={eager} />

      <Text variant="sm-display" mt={1}>
        <SiteLink href={site.url} target="_blank" rel="noopener noreferrer" textDecoration="none">
          {site.slug}
        </SiteLink>
      </Text>
      {uploader && (
        <Text variant="xs" color="mono60" style={{ overflowWrap: "anywhere" }}>
          {uploader}
        </Text>
      )}
      {when && (
        <Text variant="xs" color="mono60">
          {when}
        </Text>
      )}
    </>
  );
}
