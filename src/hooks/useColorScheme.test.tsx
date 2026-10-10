import { act, renderHook } from "@testing-library/react";
import { clearMatchMedia, mockColorScheme } from "../test/matchMedia";
import { useColorScheme } from "./useColorScheme";

afterEach(clearMatchMedia);

describe("useColorScheme", () => {
  it("returns light when matchMedia is unavailable", () => {
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });

  it("follows the system preference", () => {
    mockColorScheme("dark");
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("dark");
  });

  it("updates when the system preference changes", () => {
    const system = mockColorScheme("light");
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe("light");

    act(() => system.set("dark"));

    expect(result.current).toBe("dark");
  });
});
