import { getHeader } from "./getHeader";

describe("getHeader", () => {
  it("returns a plain string header unchanged", () => {
    expect(getHeader({ "x-requested-by": "somebody@artsymail.com" }, "X-Requested-By")).toBe(
      "somebody@artsymail.com",
    );
  });

  it("is case-insensitive on the header name", () => {
    expect(
      getHeader(
        { "cf-access-authenticated-user-email": "somebody@artsymail.com" },
        "Cf-Access-Authenticated-User-Email",
      ),
    ).toBe("somebody@artsymail.com");
  });

  it("takes the first value of a repeated header", () => {
    expect(getHeader({ "x-requested-by": ["first", "second"] }, "X-Requested-By")).toBe("first");
  });

  it("returns undefined for a missing header", () => {
    expect(getHeader({}, "X-Requested-By")).toBeUndefined();
  });
});
