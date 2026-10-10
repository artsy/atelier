import { Flex, Separator, Spacer, Text } from "@artsy/palette";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import styled from "styled-components";
import { SiteLink } from "../components/SiteLink";
import { getConfig, getS3Client } from "../lib/deps";
import { formatAttribution } from "../lib/formatAttribution";
import {
  DEFAULT_SITE_SORT,
  parseSiteSort,
  type SiteListing,
  toSiteListing,
} from "../lib/siteListing";
import { listSites, type SiteSort } from "../lib/sites";

interface SitesPageProps {
  sites: SiteListing[];
  sort: SiteSort;
}

const SORT_OPTIONS: Array<{ sort: SiteSort; label: string }> = [
  { sort: "newest", label: "Newest" },
  { sort: "name", label: "Name" },
  { sort: "uploader", label: "Uploader" },
];

const SortLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: color-mix(in srgb, currentColor 12%, transparent);
  }

  &[aria-current="true"] {
    text-decoration: underline;
  }
`;

export const getServerSideProps: GetServerSideProps<SitesPageProps> = async ({ query }) => {
  const sort = parseSiteSort(query.sort) ?? DEFAULT_SITE_SORT;
  const { s3Bucket } = getConfig();
  const sites = await listSites(getS3Client(), s3Bucket, sort);

  return { props: { sort, sites: sites.map((site) => toSiteListing(site)) } };
};

export default function SitesPage({ sites, sort }: SitesPageProps) {
  return (
    <>
      <Head>
        <title>Sites | Atelier</title>
      </Head>

      <Flex flexDirection="column" width="100%" maxWidth={720} mx="auto" p={2} mt={4}>
        {sites.length > 0 && (
          <>
            <Flex alignItems="baseline">
              <Text variant="sm" mr={1}>
                Sort {sites.length} {sites.length === 1 ? "site" : "sites"} by
              </Text>
              {SORT_OPTIONS.map((option) => (
                <Text key={option.sort} variant="sm">
                  <SortLink
                    href={`/sites?sort=${option.sort}`}
                    aria-current={option.sort === sort ? "true" : undefined}
                  >
                    {option.label}
                  </SortLink>
                </Text>
              ))}
            </Flex>
            <Separator role="separator" my={2} />
          </>
        )}

        {sites.length === 0 ? (
          <Text variant="md">No sites yet</Text>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sites.map((site) => {
              const attribution = formatAttribution(site.uploadedBy, site.uploadedAt);
              return (
                <li key={site.slug} style={{ marginBottom: "1rem" }}>
                  <Text variant="lg-display">
                    <SiteLink
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      textDecoration="none"
                    >
                      {site.slug}
                    </SiteLink>
                  </Text>
                  {attribution && (
                    <Text variant="xs" color="mono60">
                      {attribution}
                    </Text>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Spacer y={2} />
        <Text variant="md">
          <SiteLink href="/">&larr; Upload a site</SiteLink>
        </Text>
      </Flex>
    </>
  );
}
