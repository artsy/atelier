import { createGlobalStyle } from "styled-components";

export const HeroBackground = createGlobalStyle`
  body {
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image:
      linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.65)), url(/atelier-crop.webp);
    background-size: cover;
    background-position: center;
  }
`;
