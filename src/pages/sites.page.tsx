import { Flex, Separator, Spacer, Text } from "@artsy/palette";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import styled from "styled-components";
import { SiteCard } from "../components/SiteCard";
import { SiteLink } from "../components/SiteLink";
import { SiteTable } from "../components/SiteTable";
import { getConfig, getS3Client } from "../lib/deps";
import {
  DEFAULT_SITE_SORT,
  parseSiteSort,
  type SiteListing,
  toSiteListing,
} from "../lib/siteListing";
import { listSites, type SiteSort } from "../lib/sites";

type SiteView = "list" | "grid";

// One width for both views, so the controls stay put when switching.
const PAGE_MAX_WIDTH = "1440px";

// Below this the count is hidden so the sort and view controls share a line.
const SMALL_SCREEN = "599px";

// Below this even the controls need the room, so their labels are hidden
// visually (still announced by screen readers).
const NARROW_PHONE = "439px";

// Roughly the first two rows on a desktop-width grid.
const EAGER_THUMBNAILS = 10;

interface SitesPageProps {
  sites: SiteListing[];
  sort: SiteSort;
  view: SiteView;
}

const SORT_OPTIONS: Array<{ sort: SiteSort; label: string }> = [
  { sort: "newest", label: "Newest" },
  { sort: "name", label: "Name" },
  { sort: "uploader", label: "Uploader" },
];

const VIEW_OPTIONS: Array<{ view: SiteView; label: string }> = [
  { view: "grid", label: "Grid" },
  { view: "list", label: "List" },
];

function parseView(value: unknown): SiteView {
  return value === "list" ? "list" : "grid";
}

// The grid view is the default, so it stays out of the URL.
function sitesHref(sort: SiteSort, view: SiteView): string {
  const params = new URLSearchParams({ sort });
  if (view === "list") {
    params.set("view", "list");
  }
  return `/sites?${params}`;
}

const OptionLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  padding: 0.125rem 0.25rem;
  border-radius: 4px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: color-mix(in srgb, currentColor 12%, transparent);
  }

  &[aria-current="true"] {
    text-decoration: underline;
  }
`;

interface OptionLinksProps {
  label: string;
  options: Array<{ label: string; href: string; active: boolean }>;
}

const SiteCount = styled(Text)`
  white-space: nowrap;

  @media (max-width: ${SMALL_SCREEN}) {
    display: none;
  }
`;

const ControlLabel = styled(Text)`
  @media (max-width: ${NARROW_PHONE}) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;

function OptionLinks({ label, options }: OptionLinksProps) {
  return (
    <>
      <ControlLabel variant="sm" fontWeight="bold" mr={0.5}>
        {label}
      </ControlLabel>
      {options.map((option) => (
        <Text key={option.label} variant="sm">
          <OptionLink href={option.href} aria-current={option.active ? "true" : undefined}>
            {option.label}
          </OptionLink>
        </Text>
      ))}
    </>
  );
}

// Equal-width side groups that never squeeze below their content, so the
// header wraps group by group on narrow screens instead of breaking a label.
const SIDE_GROUP_STYLE = { flex: "1 1 0", minWidth: "max-content", whiteSpace: "nowrap" } as const;

export const getServerSideProps: GetServerSideProps<SitesPageProps> = async ({ query }) => {
  const sort = parseSiteSort(query.sort) ?? DEFAULT_SITE_SORT;
  const { s3Bucket } = getConfig();
  const sites = await listSites(getS3Client(), s3Bucket, sort);

  return {
    props: {
      sort,
      view: parseView(query.view),
      sites: sites.map((site) => toSiteListing(site)),
    },
  };
};

export default function SitesPage({ sites, sort, view }: SitesPageProps) {
  return (
    <>
      <Head>
        <title>Sites | Atelier</title>
      </Head>

      <Flex flexDirection="column" width="100%" maxWidth={PAGE_MAX_WIDTH} mx="auto" p={2} mt={4}>
        <Text as="h1" variant="xl">
          Atelier Sites
        </Text>

        <Spacer y={2} />

        {sites.length > 0 && (
          <>
            <Flex alignItems="baseline" flexWrap="wrap" style={{ gap: "0.5rem 1rem" }}>
              <Flex alignItems="baseline" style={SIDE_GROUP_STYLE}>
                <OptionLinks
                  label="Sort by"
                  options={SORT_OPTIONS.map((option) => ({
                    label: option.label,
                    href: sitesHref(option.sort, view),
                    active: option.sort === sort,
                  }))}
                />
              </Flex>

              <SiteCount variant="sm" fontWeight="bold">
                {sites.length} {sites.length === 1 ? "site" : "sites"}
              </SiteCount>

              <Flex alignItems="baseline" justifyContent="flex-end" style={SIDE_GROUP_STYLE}>
                <OptionLinks
                  label="View as"
                  options={VIEW_OPTIONS.map((option) => ({
                    label: option.label,
                    href: sitesHref(sort, option.view),
                    active: option.view === view,
                  }))}
                />
              </Flex>
            </Flex>
            <Separator role="separator" my={2} />
          </>
        )}

        {sites.length === 0 ? (
          <Text variant="md">No sites yet</Text>
        ) : view === "grid" ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              rowGap: "2.5rem",
              columnGap: "1.5rem",
            }}
          >
            {sites.map((site, index) => (
              <li key={site.slug}>
                <SiteCard site={site} eager={index < EAGER_THUMBNAILS} />
              </li>
            ))}
          </ul>
        ) : (
          <SiteTable sites={sites} />
        )}

        <Spacer y={2} />
        <Text variant="md">
          <SiteLink href="/">&larr; Upload a site</SiteLink>
        </Text>
      </Flex>
    </>
  );
}
