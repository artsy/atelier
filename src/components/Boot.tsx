import { injectGlobalStyles, Theme } from "@artsy/palette";
import type { ReactNode } from "react";
import { StyleSheetManager } from "styled-components";
import { shouldForwardProp } from "../lib/shouldForwardProp";

const { GlobalStyles } = injectGlobalStyles();

export function Boot({ children }: { children?: ReactNode }) {
  return (
    <Theme>
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>
        <GlobalStyles />
        {children}
      </StyleSheetManager>
    </Theme>
  );
}
