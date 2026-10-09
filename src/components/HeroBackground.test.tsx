import { renderToString } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { HeroBackground } from "./HeroBackground";

describe("HeroBackground", () => {
  it("emits body styles for the hero image and centering", () => {
    const sheet = new ServerStyleSheet();
    renderToString(sheet.collectStyles(<HeroBackground />));
    const css = sheet.getStyleTags();
    sheet.seal();

    expect(css).toContain("body{");
    expect(css).toContain("url(/atelier-crop.webp)");
    expect(css).toContain("display:flex");
  });
});
