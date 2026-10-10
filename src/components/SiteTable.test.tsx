import { fireEvent, screen, within } from "@testing-library/react";
import type { SiteListing } from "../lib/siteListing";
import { renderWithBoot } from "../test/renderWithBoot";
import { SiteTable } from "./SiteTable";

const sites: SiteListing[] = [
  {
    slug: "gallery",
    url: "https://gallery.artsy.dev",
    thumbnailUrl: "/api/thumbnails/gallery",
    uploadedBy: "somebody@artsymail.com",
    uploadedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    slug: "no-meta",
    url: "https://no-meta.artsy.dev",
    thumbnailUrl: "/api/thumbnails/no-meta",
  },
  {
    slug: "anon",
    url: "https://anon.artsy.dev",
    thumbnailUrl: "/api/thumbnails/anon",
    uploadedBy: "anonymous",
    uploadedAt: "2026-07-21T12:00:00.000Z",
  },
];

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-07-22T12:00:00.000Z").getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
});

function rowFor(slug: string): HTMLElement {
  return screen.getByRole("link", { name: slug }).closest("tr") as HTMLElement;
}

describe("SiteTable", () => {
  it("has a column each for preview, slug, uploader and upload time", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Preview",
      "Slug",
      "Uploaded by",
      "Uploaded",
    ]);
    expect(screen.getAllByRole("row")).toHaveLength(sites.length + 1);
  });

  it("keeps the column headers for assistive tech but hides them visually", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    const head = screen.getAllByRole("columnheader")[0]?.closest("thead");
    expect(head).toHaveStyle({ position: "absolute", width: "1px", height: "1px" });
  });

  it("links the slug to the live site without an underline", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    const link = screen.getByRole("link", { name: "gallery" });
    expect(link).toHaveAttribute("href", "https://gallery.artsy.dev");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveStyle({ textDecoration: "none" });
  });

  it("shows the uploader and a relative upload time in their own cells", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    const cells = within(rowFor("gallery")).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "",
      "gallery",
      "somebody@artsymail.com",
      "2 days ago",
    ]);
  });

  it("gives the upload time a machine-readable value and a precise tooltip", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    const time = within(rowFor("gallery")).getByText("2 days ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-20T12:00:00.000Z");
    expect(time).toHaveAttribute("title", "2026-07-20 12:00 UTC");
  });

  it("shows a dash for unknown metadata and anonymous uploaders", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    expect(
      within(rowFor("no-meta"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["", "no-meta", "—", "—"]);
    expect(
      within(rowFor("anon"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["", "anon", "—", "yesterday"]);
  });

  it("mutes the uploader and time", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    expect(screen.getByText("somebody@artsymail.com")).toHaveStyle({ color: "rgb(112, 112, 112)" });
  });

  it("right-aligns the upload time, including the dash for unknown times", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    expect(within(rowFor("gallery")).getByText("2 days ago").parentElement).toHaveStyle({
      textAlign: "right",
    });
    const unknown = within(rowFor("no-meta")).getAllByRole("cell")[3]?.firstElementChild;
    expect(unknown).toHaveStyle({ textAlign: "right" });
  });

  it("lets the last column end flush with the table edge", () => {
    renderWithBoot(<SiteTable sites={sites} />);

    const cells = within(rowFor("gallery")).getAllByRole("cell");
    expect(cells[3]).toHaveStyle({ paddingRight: "0px" });
    expect(cells[2]).not.toHaveStyle({ paddingRight: "0px" });
  });

  describe("preview column", () => {
    it("sizes the preview column to the thumbnail so the slug sits close to it", () => {
      renderWithBoot(<SiteTable sites={sites} />);

      const cell = within(rowFor("gallery")).getAllByRole("cell")[0];

      expect(cell).toHaveStyle({ width: "72px" });
      expect(cell).not.toHaveAttribute("width");
    });

    function previewCell(slug: string): HTMLElement {
      return within(rowFor(slug)).getAllByRole("cell")[0] as HTMLElement;
    }

    it("shows a small decorative thumbnail first in each row", () => {
      renderWithBoot(<SiteTable sites={sites} />);

      const image = previewCell("gallery").querySelector("img");
      expect(image?.getAttribute("src")).toMatch(/\/api\/thumbnails\/gallery$/);
      expect(image).toHaveAttribute("alt", "");
    });

    it("links the thumbnail to the live site without adding a tab stop", () => {
      renderWithBoot(<SiteTable sites={sites} />);

      const link = previewCell("gallery").querySelector("a");
      expect(link).toHaveAttribute("href", "https://gallery.artsy.dev");
      expect(link).toHaveAttribute("tabindex", "-1");
    });

    it("falls back to a blank placeholder when the thumbnail fails to load", () => {
      renderWithBoot(<SiteTable sites={sites} />);

      const cell = previewCell("gallery");
      fireEvent.error(cell.querySelector("img") as HTMLImageElement);

      expect(cell.querySelector("img")).toBeNull();
      expect(cell).toHaveTextContent("");
      expect(screen.queryByText("No preview")).not.toBeInTheDocument();
    });
  });
});
