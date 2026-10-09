/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  // Bundle styled-components and its consumers together. Otherwise the server
  // loads palette against the CJS styled-components while our code gets the
  // bundled one: two ThemeContexts, and palette's theme never reaches our
  // styled(Text) wrappers (font-family renders as the literal "sans").
  // Add "@artsy/icons" here when we first import it, for the same reason.
  transpilePackages: ["@artsy/palette", "styled-components"],
  pageExtensions: ["page.tsx", "page.ts"],
  reactStrictMode: true,
};

module.exports = nextConfig;
