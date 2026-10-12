import { shouldForwardProp } from "./shouldForwardProp";

describe("shouldForwardProp", () => {
  it("forwards valid HTML attributes to DOM elements", () => {
    expect(shouldForwardProp("href", "a")).toBe(true);
    expect(shouldForwardProp("aria-label", "div")).toBe(true);
    expect(shouldForwardProp("data-testid", "div")).toBe(true);
  });

  it("drops styling props on DOM elements", () => {
    expect(shouldForwardProp("flexDirection", "div")).toBe(false);
    expect(shouldForwardProp("mt", "div")).toBe(false);
    expect(shouldForwardProp("variant", "div")).toBe(false);
  });

  it("forwards everything to non-DOM targets", () => {
    expect(shouldForwardProp("flexDirection", () => null)).toBe(true);
  });
});
