import { screen } from "@testing-library/react";
import type { SiteListing } from "../lib/siteListing";
import { renderWithBoot } from "../test/renderWithBoot";
import { SiteCard } from "./SiteCard";

const site: SiteListing = {
  slug: "gallery",
  url: "https://gallery.artsy.dev",
  thumbnailUrl: "/api/thumbnails/gallery",
  uploadedBy: "somebody@artsymail.com",
  uploadedAt: "2026-07-20T12:00:00.000Z",
};

beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-07-22T12:00:00.000Z").getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SiteCard attribution", () => {
  it("puts the uploader and the time on separate lines, without a label", () => {
    renderWithBoot(<SiteCard site={site} />);

    const uploader = screen.getByText("somebody@artsymail.com");
    const time = screen.getByText("2 days ago");
    expect(uploader).not.toBe(time);
    expect(uploader.parentElement).toBe(time.parentElement);
    expect(screen.queryByText(/uploaded by/i)).not.toBeInTheDocument();
  });

  it("mutes both lines", () => {
    renderWithBoot(<SiteCard site={site} />);

    for (const text of ["somebody@artsymail.com", "2 days ago"]) {
      expect(screen.getByText(text)).toHaveStyle({ color: "rgb(112, 112, 112)" });
    }
  });

  it("shows only the time for an anonymous uploader", () => {
    renderWithBoot(<SiteCard site={{ ...site, uploadedBy: "anonymous" }} />);

    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
  });

  it("shows no attribution lines when nothing is known", () => {
    const { uploadedBy: _by, uploadedAt: _at, ...bare } = site;
    renderWithBoot(<SiteCard site={bare} />);

    expect(screen.getByRole("link", { name: "gallery" })).toBeInTheDocument();
    expect(screen.queryByText(/ago|yesterday/)).not.toBeInTheDocument();
  });
});
