import { siteUrl } from "./siteUrl";

describe("siteUrl", () => {
  it("builds the public https url for a slug", () => {
    expect(siteUrl("marketing-dashboard", "artsy.dev")).toBe(
      "https://marketing-dashboard.artsy.dev",
    );
  });
});
