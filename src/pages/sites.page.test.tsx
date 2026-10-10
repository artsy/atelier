import { screen } from "@testing-library/react";
import type { GetServerSidePropsContext } from "next";
import { getConfig, getS3Client } from "../lib/deps";
import type { SiteListing } from "../lib/siteListing";
import { listSites } from "../lib/sites";
import { renderWithBoot } from "../test/renderWithBoot";
import SitesPage, { getServerSideProps } from "./sites.page";

jest.mock("../lib/sites", () => ({ listSites: jest.fn() }));
jest.mock("../lib/deps", () => ({
  getS3Client: jest.fn(),
  getConfig: jest.fn(),
}));

const mockListSites = listSites as jest.MockedFunction<typeof listSites>;

const sites: SiteListing[] = [
  {
    slug: "gallery",
    url: "https://gallery.artsy.dev",
    uploadedBy: "somebody@artsymail.com",
    uploadedAt: "2026-07-20T12:00:00.000Z",
  },
  { slug: "no-meta", url: "https://no-meta.artsy.dev" },
];

describe("SitesPage", () => {
  it("lists each site as a link to its public url, with attribution when known", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByRole("link", { name: "gallery" })).toHaveAttribute(
      "href",
      "https://gallery.artsy.dev",
    );
    expect(screen.getByRole("link", { name: "no-meta" })).toHaveAttribute(
      "href",
      "https://no-meta.artsy.dev",
    );
    expect(screen.getByText(/uploaded by somebody@artsymail.com/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("mutes the attribution text", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByText(/uploaded by somebody@artsymail.com/)).toHaveStyle({
      color: "rgb(112, 112, 112)",
    });
  });

  it("does not underline site slugs", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByRole("link", { name: "gallery" })).toHaveStyle({ textDecoration: "none" });
  });

  it("shows a singular count for one site", () => {
    renderWithBoot(<SitesPage sites={sites.slice(0, 1)} sort="newest" />);

    expect(screen.getByText("Sort 1 site by")).toBeInTheDocument();
  });

  it("shows the site count", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByText("Sort 2 sites by")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("marks the active sort and links to the other one", () => {
    renderWithBoot(<SitesPage sites={sites} sort="name" />);

    expect(screen.getByRole("link", { name: "Name" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Newest" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute(
      "href",
      "/sites?sort=newest",
    );
  });

  it("offers sorting by uploader", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByRole("link", { name: "Uploader" })).toHaveAttribute(
      "href",
      "/sites?sort=uploader",
    );
  });

  it("separates the sort controls from the list", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("gives the sort links a hover highlight", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" />);

    const css = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("");
    expect(css).toMatch(/:hover\{[^}]*background(-color)?:color-mix/);
  });

  it("shows an empty state", () => {
    renderWithBoot(<SitesPage sites={[]} sort="newest" />);

    expect(screen.getByText("No sites yet")).toBeInTheDocument();
    expect(screen.queryByText(/^Sort /)).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Newest" })).not.toBeInTheDocument();
  });
});

describe("getServerSideProps", () => {
  beforeEach(() => {
    mockListSites.mockReset().mockResolvedValue([{ slug: "gallery" }]);
    (getS3Client as jest.Mock).mockReturnValue({});
    (getConfig as jest.Mock).mockReturnValue({
      s3Bucket: "artsy-atelier",
      publicDomain: "artsy.dev",
    });
  });

  const run = (query: Record<string, string | string[]>) =>
    getServerSideProps({ query } as unknown as GetServerSidePropsContext);

  it("defaults to newest and adds public urls", async () => {
    const result = await run({});

    expect(mockListSites).toHaveBeenCalledWith({}, "artsy-atelier", "newest");
    expect(result).toEqual({
      props: { sort: "newest", sites: [{ slug: "gallery", url: "https://gallery.artsy.dev" }] },
    });
  });

  it("honors a valid sort param", async () => {
    await run({ sort: "name" });

    expect(mockListSites).toHaveBeenCalledWith({}, "artsy-atelier", "name");
  });

  it("falls back to newest for an invalid sort param", async () => {
    await run({ sort: "bogus" });

    expect(mockListSites).toHaveBeenCalledWith({}, "artsy-atelier", "newest");
  });
});
