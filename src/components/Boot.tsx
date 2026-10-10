import { injectGlobalStyles, THEMES, Theme } from "@artsy/palette";
import type { ReactNode } from "react";
import { css, StyleSheetManager } from "styled-components";
import { useColorScheme } from "../hooks/useColorScheme";
import { shouldForwardProp } from "../lib/shouldForwardProp";

// The server can't know the user's scheme, so it renders the light theme;
// this paints the dark page colors before hydration so dark-mode users
// don't get a white flash.
const darkModeFirstPaint = css`
  @media (prefers-color-scheme: dark) {
    html,
    body {
      background-color: ${THEMES.dark.colors.mono0};
      color: ${THEMES.dark.colors.mono100};
    }
  }
`;

const { GlobalStyles } = injectGlobalStyles(darkModeFirstPaint);

export function Boot({ children }: { children?: ReactNode }) {
  const colorScheme = useColorScheme();

  return (
    <Theme theme={colorScheme}>
      <StyleSheetManager shouldForwardProp={shouldForwardProp}>
        <GlobalStyles />
        {children}
      </StyleSheetManager>
    </Theme>
  );
}
