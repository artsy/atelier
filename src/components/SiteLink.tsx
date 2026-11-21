import { Link, THEMES } from "@artsy/palette";
import styled from "styled-components";

// Palette's visited blue (blue150) is nearly black in the light theme, so
// visited links look unvisited there. blue100 stays distinct from text.
//
// The scheme is picked by a media query rather than a JS prop: the server
// always renders the light theme, and Safari doesn't restyle :visited when
// the class changes at hydration, leaving dark-mode users with the light color.
const StyledLink = styled(Link)`
  &:visited {
    color: ${THEMES.light.colors.blue100};
  }

  @media (prefers-color-scheme: dark) {
    &:visited {
      color: ${THEMES.dark.colors.blue150};
    }
  }

  &:hover {
    text-decoration: underline;
  }
`;

export function SiteLink(props: React.ComponentProps<typeof Link>) {
  return <StyledLink {...props} />;
}
