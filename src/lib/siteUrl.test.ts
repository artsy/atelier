import type { Config } from "../config";
import { getConfig } from "./deps";
import { siteUrl } from "./siteUrl";

jest.mock("./deps", () => ({ getConfig: jest.fn() }));

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe("siteUrl", () => {
  it("builds the public https url from the configured domain", () => {
    mockGetConfig.mockReturnValue({ publicDomain: "artsy.dev" } as Config);

    expect(siteUrl("marketing-dashboard")).toBe("https://marketing-dashboard.artsy.dev");
  });

  it("follows a different configured domain", () => {
    mockGetConfig.mockReturnValue({ publicDomain: "sites.example.test" } as Config);

    expect(siteUrl("gallery")).toBe("https://gallery.sites.example.test");
  });
});
