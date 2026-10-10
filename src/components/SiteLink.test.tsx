import { render } from "@testing-library/react";
import { clearMatchMedia, mockColorScheme } from "../test/matchMedia";
import { Boot } from "./Boot";
import { SiteLink } from "./SiteLink";

afterEach(clearMatchMedia);

function css() {
  return Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent)
    .join("");
}

function renderLink() {
  render(
    <Boot>
      <SiteLink href="https://gallery.artsy.dev">gallery</SiteLink>
    </Boot>,
  );
}

describe("SiteLink", () => {
  it("makes visited links clearly distinct from black text in the light theme", () => {
    mockColorScheme("light");
    renderLink();

    expect(css()).toMatch(/:visited\{color:#1023d7;?\}/i);
  });

  it("uses palette's light visited blue in the dark theme", () => {
    mockColorScheme("dark");
    renderLink();

    expect(css()).toMatch(/:visited\{color:#a2b1fb;?\}/i);
  });

  it("underlines on hover even when it has no underline at rest", () => {
    mockColorScheme("light");
    renderLink();

    expect(css()).toMatch(/:hover\{[^}]*text-decoration:underline/);
  });
});
