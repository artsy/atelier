import { Link, THEMES } from "@artsy/palette";
import styled from "styled-components";
import type { ColorScheme } from "../hooks/useColorScheme";
import { useColorScheme } from "../hooks/useColorScheme";

// Palette's visited blue (blue150) is nearly black in the light theme, so
// visited links look unvisited there. blue100 stays distinct from text.
const VISITED_TOKEN: Record<ColorScheme, "blue100" | "blue150"> = {
  light: "blue100",
  dark: "blue150",
};

const StyledLink = styled(Link)<{ $visitedColor: string }>`
  &:visited {
    color: ${(props) => props.$visitedColor};
  }

  &:hover {
    text-decoration: underline;
  }
`;

export function SiteLink(props: React.ComponentProps<typeof Link>) {
  const scheme = useColorScheme();
  return <StyledLink $visitedColor={THEMES[scheme].colors[VISITED_TOKEN[scheme]]} {...props} />;
}
