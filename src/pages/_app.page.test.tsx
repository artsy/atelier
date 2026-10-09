import { Flex } from "@artsy/palette";
import { render, screen } from "@testing-library/react";
import type { AppProps } from "next/app";
import { useContext } from "react";
import { ThemeContext } from "styled-components";
import App from "./_app.page";

function ThemeProbe() {
  const theme = useContext(ThemeContext);
  return <div>{theme ? "theme provided" : "no theme"}</div>;
}

describe("App", () => {
  it("provides the palette theme to pages", () => {
    render(<App {...({ Component: ThemeProbe, pageProps: {} } as unknown as AppProps)} />);

    expect(screen.getByText("theme provided")).toBeInTheDocument();
  });

  it("keeps palette's styling props off the DOM", () => {
    function Page() {
      return <Flex data-testid="flex" flexDirection="column" mt={2} />;
    }

    render(<App {...({ Component: Page, pageProps: {} } as unknown as AppProps)} />);

    const element = screen.getByTestId("flex");
    expect(element).not.toHaveAttribute("flexdirection");
    expect(element).not.toHaveAttribute("mt");
  });
});
