import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithBoot } from "../test/renderWithBoot";
import { AboutAtelierDrawer } from "./AboutAtelierDrawer";

describe("AboutAtelierDrawer", () => {
  it("closes via a close button", async () => {
    const onClose = jest.fn();
    renderWithBoot(<AboutAtelierDrawer open onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("puts the close button before all other focusable content", () => {
    renderWithBoot(<AboutAtelierDrawer open onClose={jest.fn()} />);

    const focusable = Array.from(document.querySelectorAll<HTMLElement>("a[href], button"));

    expect(focusable[0]).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("headlines the drawer with an h2 introducing the Atelier, and its questions with h3s", () => {
    renderWithBoot(<AboutAtelierDrawer open onClose={jest.fn()} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /^The Atelier .* is Artsy and Artnet’s/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "How do I create a site?" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
