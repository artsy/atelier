import { Theme } from "@artsy/palette";
import type { ReactNode } from "react";
import { StyleSheetManager } from "styled-components";
import { shouldForwardProp } from "../lib/shouldForwardProp";

export function Boot({ children }: { children?: ReactNode }) {
  return (
    <Theme>
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>{children}</StyleSheetManager>
    </Theme>
  );
}
