import { Box, Flex, Text } from "@artsy/palette";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SiteListing } from "../lib/siteListing";

interface SiteThumbnailProps {
  site: SiteListing;
  eager?: boolean;
  // Empty for decorative use next to a text link with the same name.
  alt?: string;
  sizes?: string;
  // Spell out "No preview" in the placeholder; too big for tiny thumbnails.
  placeholderText?: boolean;
}

export function SiteThumbnail({
  site,
  eager = false,
  alt = `Screenshot of ${site.slug}`,
  sizes = "(min-width: 1200px) 280px, 50vw",
  placeholderText = true,
}: SiteThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // The server-rendered <img> can fail before React hydrates and attaches
  // onError, so that error event would otherwise be missed.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0 && image.currentSrc !== "") {
      setFailed(true);
    }
  }, []);

  return (
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
          placeholderText && (
            <Flex height="100%" alignItems="center" justifyContent="center">
              <Text variant="xs" color="mono60">
                No preview
              </Text>
            </Flex>
          )
        ) : (
          <Image
            ref={imageRef}
            src={site.thumbnailUrl}
            alt={alt}
            fill
            unoptimized
            loading={eager ? "eager" : "lazy"}
            sizes={sizes}
            onError={() => setFailed(true)}
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        )}
      </Box>
    </a>
  );
}
