import { Text } from "@artsy/palette";
import styled from "styled-components";
import { formatUploader } from "../lib/formatAttribution";
import { formatRelativeTime } from "../lib/formatRelativeTime";
import type { SiteListing } from "../lib/siteListing";
import { SiteLink } from "./SiteLink";
import { SiteThumbnail } from "./SiteThumbnail";

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

const rowBorder = "1px solid color-mix(in srgb, currentColor 15%, transparent)";

const THUMBNAIL_WIDTH = 72;
// Eager covers roughly the rows visible without scrolling.
const EAGER_ROWS = 12;

// Column names for assistive tech only; the layout is self-explanatory.
const VisuallyHiddenHead = styled.thead`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const Cell = styled.td`
  padding: 0.5rem 1rem 0.5rem 0;
  border-bottom: ${rowBorder};
  vertical-align: middle;
  overflow-wrap: anywhere;

  &:last-child {
    padding-right: 0;
  }
`;

const ThumbnailCell = styled(Cell)`
  width: ${THUMBNAIL_WIDTH}px;
`;

// Deterministic (not locale-based), so server and client render the same.
function preciseTime(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

export function SiteTable({ sites }: { sites: SiteListing[] }) {
  return (
    <Table>
      <VisuallyHiddenHead>
        <tr>
          {["Preview", "Slug", "Uploaded by", "Uploaded"].map((heading) => (
            <th key={heading} scope="col">
              {heading}
            </th>
          ))}
        </tr>
      </VisuallyHiddenHead>
      <tbody>
        {sites.map((site, index) => {
          const uploader = formatUploader(site.uploadedBy);
          const when = formatRelativeTime(site.uploadedAt);
          return (
            <tr key={site.slug}>
              <ThumbnailCell>
                <div style={{ width: THUMBNAIL_WIDTH }}>
                  <SiteThumbnail
                    site={site}
                    eager={index < EAGER_ROWS}
                    alt=""
                    sizes={`${THUMBNAIL_WIDTH}px`}
                    placeholderText={false}
                  />
                </div>
              </ThumbnailCell>
              <Cell>
                <Text variant="md">
                  <SiteLink
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    textDecoration="none"
                  >
                    {site.slug}
                  </SiteLink>
                </Text>
              </Cell>
              <Cell>
                <Text variant="sm" color="mono60">
                  {uploader ?? "—"}
                </Text>
              </Cell>
              <Cell>
                <Text variant="sm" color="mono60" textAlign="right">
                  {when && site.uploadedAt ? (
                    <time dateTime={site.uploadedAt} title={preciseTime(site.uploadedAt)}>
                      {when}
                    </time>
                  ) : (
                    "—"
                  )}
                </Text>
              </Cell>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
