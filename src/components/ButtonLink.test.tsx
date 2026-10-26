import { render, screen } from "@testing-library/react";
import { Boot } from "./Boot";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("renders an anchor with the given link attributes", () => {
    render(
      <Boot>
        <ButtonLink href="/sites/" target="gallery" rel="noopener noreferrer">
          Gallery
        </ButtonLink>
      </Boot>,
    );

    const link = screen.getByRole("link", { name: "Gallery" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/sites/");
    expect(link).toHaveAttribute("target", "gallery");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("passes button props through", () => {
    render(
      <Boot>
        <ButtonLink href="/" variant="secondaryBlack" size="small">
          Home
        </ButtonLink>
      </Boot>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });
});
