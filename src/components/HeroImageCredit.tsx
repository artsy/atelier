import { Box, type BoxProps, Text } from "@artsy/palette";
import Link from "next/link";
import styled from "styled-components";

export const HeroImageCredit: React.FC<BoxProps> = (props) => {
  return (
    <Box {...props}>
      <HoverLink
        href="https://www.metmuseum.org/art/collection/search/358631"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Text variant={"xs"} fontWeight={"bold"}>
          Image via Met Open Access
        </Text>
      </HoverLink>
    </Box>
  );
};

const HoverLink = styled(Link)`
  opacity: 0.3;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    opacity: 0.6;
  }
`;
