import { Box, Flex, Text } from "@artsy/palette";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatUploader } from "../lib/formatAttribution";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import type { SiteListing } from "../lib/siteListing";
import { SiteLink } from "./SiteLink";

export function SiteCard({ site, eager = false }: { site: SiteListing; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const uploader = formatUploader(site.uploadedBy);
  const when = formatRelativeTime(site.uploadedAt);

  // The server-rendered <img> can fail before React hydrates and attaches
  // onError, so that error event would otherwise be missed.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0 && image.currentSrc !== "") {
      setFailed(true);
    }
  }, []);

  return (
    <>
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        style={{ display: "block", color: "inherit", textDecoration: "none" }}
      >
        <Box
          bg="mono5"
          border="1px solid"
          borderColor="mono15"
          style={{
            position: "relative",
            aspectRatio: "16 / 10",
            overflow: "hidden",
            borderRadius: 4,
          }}
        >
          {failed ? (
            <Flex height="100%" alignItems="center" justifyContent="center">
              <Text variant="xs" color="mono60">
                No preview
              </Text>
            </Flex>
          ) : (
            <Image
              ref={imageRef}
              src={site.thumbnailUrl}
              alt={`Screenshot of ${site.slug}`}
              fill
              unoptimized
              loading={eager ? "eager" : "lazy"}
              sizes="(min-width: 1200px) 280px, 50vw"
              onError={() => setFailed(true)}
              style={{ objectFit: "cover", objectPosition: "top" }}
            />
          )}
        </Box>
      </a>

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
