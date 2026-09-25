/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  pageExtensions: ["page.tsx", "page.ts"],
  reactStrictMode: true,
};

module.exports = nextConfig;
