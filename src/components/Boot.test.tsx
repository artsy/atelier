import { renderToString } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { Boot } from "./Boot";

describe("Boot", () => {
  it("renders palette's global styles", () => {
    const sheet = new ServerStyleSheet();
    renderToString(sheet.collectStyles(<Boot>hi</Boot>));
    const css = sheet.getStyleTags();
    sheet.seal();

    expect(css).toContain("body{margin:0;padding:0;}");
    expect(css).toContain('font-family:"ll-unica77"');
  });
});
