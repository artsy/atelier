const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "." });

/** @type {() => Promise<import('jest').Config>} */
module.exports = async () => {
  const nextConfig = await createJestConfig({
    displayName: "jsdom",
    testEnvironment: "jsdom",
    roots: ["<rootDir>/src"],
    testMatch: ["**/*.test.tsx"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    clearMocks: true,
  })();

  return {
    projects: [
      {
        displayName: "node",
        preset: "ts-jest",
        testEnvironment: "node",
        roots: ["<rootDir>/src"],
        testMatch: ["**/*.test.ts"],
        clearMocks: true,
      },
      nextConfig,
    ],
  };
};
