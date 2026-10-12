import { Clickable, Link, Text } from "@artsy/palette";
import styled, { css } from "styled-components";

const textShadow = css`
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
`;

const dottedUnderline = css`
  text-decoration: underline;
  text-decoration-style: dotted;
`;

export const HeroText = styled(Text)`
  ${textShadow}
`;

export const HeroLink = styled(Link)`
  ${textShadow}
  ${dottedUnderline}
  color: inherit;

  &:hover,
  &:visited {
    color: inherit;
  }
`;

export const HeroAction = styled(Clickable)`
  ${dottedUnderline}
  font: inherit;
  color: inherit;
`;
