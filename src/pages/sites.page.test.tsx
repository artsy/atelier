import { fireEvent, screen, within } from "@testing-library/react";
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
    thumbnailUrl: "/api/thumbnails/gallery?v=2026-07-20T12%3A00%3A00.000Z",
    uploadedBy: "somebody@artsymail.com",
    uploadedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    slug: "no-meta",
    url: "https://no-meta.artsy.dev",
    thumbnailUrl: "/api/thumbnails/no-meta",
  },
];

describe("SitesPage", () => {
  it("lists each site as a link to its public url, with attribution when known", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("link", { name: "gallery" })).toHaveAttribute(
      "href",
      "https://gallery.artsy.dev",
    );
    expect(screen.getByRole("link", { name: "no-meta" })).toHaveAttribute(
      "href",
      "https://no-meta.artsy.dev",
    );
    expect(screen.getByText("somebody@artsymail.com")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("does not underline site slugs", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("link", { name: "gallery" })).toHaveStyle({ textDecoration: "none" });
  });

  it("shows a page heading", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("heading", { name: "Atelier Sites" })).toBeInTheDocument();
  });

  it("shows a singular count for one site", () => {
    renderWithBoot(<SitesPage sites={sites.slice(0, 1)} sort="newest" view="list" />);

    expect(screen.getByText("1 site")).toBeInTheDocument();
  });

  it("shows the site count and labels the sort and view controls", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByText("2 sites")).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    expect(screen.getByText("View as")).toBeInTheDocument();
  });

  describe("on small screens", () => {
    function generatedCss(): string {
      return Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
    }

    it("hides the site count so the sort and view controls share a line", () => {
      renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

      expect(generatedCss()).toMatch(/@media \(max-width:599px\)\{[^}]*display:none/);
      expect(screen.getByText("2 sites")).toBeInTheDocument();
    });

    it("hides the control labels visually on narrow phones but keeps them for screen readers", () => {
      renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

      expect(generatedCss()).toMatch(/@media \(max-width:439px\)\{[^}]*clip:rect\(0 0 0 0\)/);
      expect(screen.getByText("Sort by")).toBeInTheDocument();
      expect(screen.getByText("View as")).toBeInTheDocument();
    });
  });

  it("keeps each control group on one line so a narrow header wraps by group", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    expect(screen.getByText("Sort by").parentElement).toHaveStyle({ whiteSpace: "nowrap" });
    expect(screen.getByText("View as").parentElement).toHaveStyle({ whiteSpace: "nowrap" });
  });

  it("marks the active sort and links to the other one", () => {
    renderWithBoot(<SitesPage sites={sites} sort="name" view="list" />);

    expect(screen.getByRole("link", { name: "Name" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Newest" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute(
      "href",
      "/sites?sort=newest&view=list",
    );
  });

  it("separates the sort controls from the list", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("gives the sort links a hover highlight", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    const css = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("");
    expect(css).toMatch(/:hover\{[^}]*background(-color)?:color-mix/);
  });

  it("shows an empty state", () => {
    renderWithBoot(<SitesPage sites={[]} sort="newest" view="list" />);

    expect(screen.getByText("No sites yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atelier Sites" })).toBeInTheDocument();
    expect(screen.queryByText("Sort by")).not.toBeInTheDocument();
    expect(screen.queryByText("View as")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ sites?$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Newest" })).not.toBeInTheDocument();
  });
});

describe("SitesPage grid view", () => {
  it("shows a thumbnail for each site, with the slug and attribution", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    const image = screen.getByRole("img", { name: "Screenshot of gallery" });
    expect(image.getAttribute("src")).toMatch(
      /\/api\/thumbnails\/gallery\?v=2026-07-20T12%3A00%3A00\.000Z$/,
    );
    expect(screen.getByRole("link", { name: "gallery" })).toHaveAttribute(
      "href",
      "https://gallery.artsy.dev",
    );
    expect(screen.getByText("somebody@artsymail.com")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("loads the first two rows of thumbnails eagerly and the rest lazily", () => {
    const many: SiteListing[] = Array.from({ length: 12 }, (_, i) => ({
      slug: `site-${i}`,
      url: `https://site-${i}.artsy.dev`,
      thumbnailUrl: `/api/thumbnails/site-${i}`,
    }));
    renderWithBoot(<SitesPage sites={many} sort="newest" view="grid" />);

    const loading = screen.getAllByRole("img").map((img) => img.getAttribute("loading"));
    expect(loading).toEqual([...Array(10).fill("eager"), "lazy", "lazy"]);
  });

  it("does not underline the placeholder text", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    fireEvent.error(screen.getByRole("img", { name: "Screenshot of gallery" }));

    expect(screen.getByText("No preview").closest("a")).toHaveStyle({ textDecoration: "none" });
  });

  it("falls back to a placeholder when a thumbnail fails to load", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    fireEvent.error(screen.getByRole("img", { name: "Screenshot of gallery" }));

    expect(screen.queryByRole("img", { name: "Screenshot of gallery" })).not.toBeInTheDocument();
    const card = screen.getByRole("link", { name: "gallery" }).closest("li") as HTMLElement;
    expect(within(card).getByText("No preview")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Screenshot of no-meta" })).toBeInTheDocument();
  });

  it("spaces the cards generously", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    const grid = screen.getAllByRole("listitem")[0]?.parentElement;
    expect(grid).toHaveStyle({ rowGap: "2.5rem", columnGap: "1.5rem" });
  });

  it("shows grid cards, not a table, in the grid view", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a table, not grid cards, in the list view", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Screenshot of/ })).not.toBeInTheDocument();
  });
});

describe("SitesPage layout", () => {
  it.each(["list", "grid"] as const)(
    "uses the same page width in the %s view so the controls do not move",
    (view) => {
      renderWithBoot(<SitesPage sites={sites} sort="newest" view={view} />);

      expect(screen.getByRole("separator").parentElement).toHaveStyle({ maxWidth: "1440px" });
    },
  );
});

describe("SitesPage view toggle", () => {
  it("marks the grid as active and links to the list, keeping the sort", () => {
    renderWithBoot(<SitesPage sites={sites} sort="name" view="grid" />);

    expect(screen.getByRole("link", { name: "Grid" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/sites?sort=name&view=list",
    );
  });

  it("links back to the grid without a view param, since grid is the default", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Grid" })).toHaveAttribute(
      "href",
      "/sites?sort=newest",
    );
  });

  it("offers sorting by uploader", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    expect(screen.getByRole("link", { name: "Uploader" })).toHaveAttribute(
      "href",
      "/sites?sort=uploader",
    );
  });

  it("keeps the list view when changing the sort", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="list" />);

    expect(screen.getByRole("link", { name: "Name" })).toHaveAttribute(
      "href",
      "/sites?sort=name&view=list",
    );
  });

  it("lists the grid option before the list option", () => {
    renderWithBoot(<SitesPage sites={sites} sort="newest" view="grid" />);

    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent)
      .filter((text) => text === "Grid" || text === "List");
    expect(names).toEqual(["Grid", "List"]);
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
      props: {
        sort: "newest",
        view: "grid",
        sites: [
          {
            slug: "gallery",
            url: "https://gallery.artsy.dev",
            thumbnailUrl: "/api/thumbnails/gallery",
          },
        ],
      },
    });
  });

  it("honors a valid sort param", async () => {
    await run({ sort: "name" });

    expect(mockListSites).toHaveBeenCalledWith({}, "artsy-atelier", "name");
  });

  it("honors view=list", async () => {
    const result = await run({ view: "list" });

    expect(result).toMatchObject({ props: { view: "list" } });
  });

  it("falls back to the grid view for an unknown view param", async () => {
    const result = await run({ view: "carousel" });

    expect(result).toMatchObject({ props: { view: "grid" } });
  });

  it("falls back to newest for an invalid sort param", async () => {
    await run({ sort: "bogus" });

    expect(mockListSites).toHaveBeenCalledWith({}, "artsy-atelier", "newest");
  });
});
