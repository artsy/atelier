import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearDialog, stubDialog } from "../test/dialog";
import { renderWithBoot } from "../test/renderWithBoot";
import { AboutAtelierDrawer } from "./AboutAtelierDrawer";

afterEach(clearDialog);

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

  it("shows a lazily loaded static still of the tutorial, not the animated gif", () => {
    renderWithBoot(<AboutAtelierDrawer open onClose={jest.fn()} />);

    const button = screen.getByRole("button", { name: "View 30-second demo" });
    const still = button.querySelector("img");

    expect(still).toHaveAttribute("src", "/atelier-howto-poster.webp");
    expect(still).toHaveAttribute("loading", "lazy");
    expect(document.querySelector("img[src$='.gif']")).toBeNull();
  });

  it("plays the tutorial video, muted and looping with controls, in a lightbox", async () => {
    stubDialog();
    renderWithBoot(<AboutAtelierDrawer open onClose={jest.fn()} />);
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(within(dialog).queryByLabelText(/screen recording/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View 30-second demo" }));

    const video = within(dialog).getByLabelText(/screen recording/i) as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "/atelier-howto.mp4");
    expect(video).toHaveAttribute("poster", "/atelier-howto-poster.webp");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.controls).toBe(true);
  });
});
