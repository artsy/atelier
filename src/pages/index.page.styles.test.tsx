import { renderToString } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { Boot } from "../components/Boot";
import IndexPage from "./index.page";

function renderWithCss() {
  const sheet = new ServerStyleSheet();
  const html = renderToString(
    sheet.collectStyles(
      <Boot>
        <IndexPage />
      </Boot>,
    ),
  );
  const css = sheet.getStyleTags();
  sheet.seal();
  return { html, css };
}

function declarationsFor(css: string, classNames: string[]): string {
  return classNames
    .flatMap((name) => css.match(new RegExp(`\\.${name}[^{]*\\{[^}]*\\}`, "g")) ?? [])
    .join("");
}

describe("IndexPage styles", () => {
  it("renders the title in regular weight, as the original page did", () => {
    const { html, css } = renderWithCss();
    const titleClasses = html.match(/<h1[^>]*class="([^"]+)"/)?.[1]?.split(" ") ?? [];

    expect(titleClasses.length).toBeGreaterThan(0);
    expect(declarationsFor(css, titleClasses)).toMatch(/font-weight:400/);
  });

  it("keeps hero links the surrounding text colour when hovered or visited", () => {
    const { html, css } = renderWithCss();
    const linkClasses = html.match(/<a[^>]*gallery[^>]*class="([^"]+)"/)?.[1]?.split(" ") ?? [];
    const rules = declarationsFor(css, linkClasses);

    expect(linkClasses.length).toBeGreaterThan(0);
    expect(rules).toMatch(/:visited[^{]*\{[^}]*color:inherit/);
    expect(rules).toMatch(/:hover[^{]*\{[^}]*color:inherit/);
  });
});
