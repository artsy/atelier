import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Boot } from "../components/Boot";

export function renderWithBoot(ui: ReactElement, options?: RenderOptions) {
  return render(<Boot>{ui}</Boot>, options);
}
