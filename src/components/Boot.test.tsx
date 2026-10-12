import { useTheme } from "@artsy/palette";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { clearMatchMedia, mockColorScheme } from "../test/matchMedia";
import { Boot } from "./Boot";

afterEach(clearMatchMedia);

function PageColor() {
  const { theme } = useTheme();
  return <div data-testid="page-color">{theme.colors.mono0}</div>;
}

describe("Boot", () => {
  it("renders palette's global styles", () => {
    const sheet = new ServerStyleSheet();
    renderToString(sheet.collectStyles(<Boot>hi</Boot>));
    const css = sheet.getStyleTags();
    sheet.seal();

    expect(css).toContain("body{margin:0;padding:0;}");
    expect(css).toContain('font-family:"ll-unica77"');
  });

  it("paints dark backgrounds from the first byte for dark-mode users", () => {
    const sheet = new ServerStyleSheet();
    renderToString(sheet.collectStyles(<Boot>hi</Boot>));
    const css = sheet.getStyleTags();
    sheet.seal();

    expect(css).toContain("@media (prefers-color-scheme:dark)");
    expect(css).toContain("background-color:#121212");
  });

  it("uses the light theme when the system prefers light", () => {
    mockColorScheme("light");
    render(
      <Boot>
        <PageColor />
      </Boot>,
    );

    expect(screen.getByTestId("page-color")).toHaveTextContent("#FFFFFF");
  });

  it("uses the dark theme when the system prefers dark", () => {
    mockColorScheme("dark");
    render(
      <Boot>
        <PageColor />
      </Boot>,
    );

    expect(screen.getByTestId("page-color")).toHaveTextContent("#121212");
  });
});
