// biome-ignore lint/suspicious/noDocumentImportInPage: this *is* _document, just under our .page.tsx convention (pageExtensions in next.config.js) that the rule's filename check doesn't recognize
import Document, { type DocumentContext, Head, Html, Main, NextScript } from "next/document";
import type { ReactElement } from "react";
import { ServerStyleSheet } from "styled-components";

export default class AtelierDocument extends Document {
  static override async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />) as ReactElement,
        });

      const initialProps = await Document.getInitialProps(ctx);
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      };
    } finally {
      sheet.seal();
    }
  }

  override render() {
    return (
      <Html lang="en">
        <Head>
          <link
            rel="preload"
            href="https://webfonts.artsy.net/ll-unica77_regular.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="https://webfonts.artsy.net/ll-unica77_medium.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link rel="stylesheet" href="https://webfonts.artsy.net/ll-unica77.css" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
