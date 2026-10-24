import { Image } from "@artsy/palette";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearDialog, stubDialog } from "../test/dialog";
import { renderWithBoot } from "../test/renderWithBoot";
import { MediaLightbox } from "./MediaLightbox";

afterEach(clearDialog);

function renderLightbox() {
  const dialog = stubDialog();
  renderWithBoot(
    <MediaLightbox label="How to" media={<video data-testid="enlarged" src="/how-to.mp4" muted />}>
      <Image src="/how-to.gif" alt="How to" />
    </MediaLightbox>,
  );
  return dialog;
}

function lightbox() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

async function openLightbox() {
  await userEvent.click(screen.getByRole("button", { name: "How to" }));
}

describe("MediaLightbox", () => {
  it("shows its thumbnail inside a keyboard-accessible button", () => {
    renderLightbox();

    const button = screen.getByRole("button", { name: "How to" });
    expect(within(button).getByAltText("How to")).toBeInTheDocument();
  });

  it("does not mount the enlarged media until opened", () => {
    renderLightbox();

    expect(within(lightbox()).queryByTestId("enlarged")).not.toBeInTheDocument();
  });

  it("opens the enlarged media in a modal dialog when the thumbnail is clicked", async () => {
    const { showModal } = renderLightbox();

    await openLightbox();

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(within(lightbox()).getByTestId("enlarged")).toHaveAttribute("src", "/how-to.mp4");
  });

  it("closes when the backdrop is clicked, and unmounts the enlarged media", async () => {
    const { close } = renderLightbox();
    await openLightbox();

    await userEvent.click(lightbox());

    expect(close).toHaveBeenCalledTimes(1);
    expect(within(lightbox()).queryByTestId("enlarged")).not.toBeInTheDocument();
  });

  it("stays open when the media itself is clicked, so its controls remain usable", async () => {
    const { close } = renderLightbox();
    await openLightbox();

    await userEvent.click(within(lightbox()).getByTestId("enlarged"));

    expect(close).not.toHaveBeenCalled();
  });

  it("also unmounts the enlarged media when the dialog closes itself, e.g. via Esc", async () => {
    renderLightbox();
    await openLightbox();

    fireEvent(lightbox(), new Event("close"));

    expect(within(lightbox()).queryByTestId("enlarged")).not.toBeInTheDocument();
  });

  it("keeps Esc from reaching listeners outside it, so a parent drawer stays open", async () => {
    renderLightbox();
    await openLightbox();
    const outside = jest.fn();
    document.addEventListener("keydown", outside);

    fireEvent.keyDown(lightbox(), { key: "Escape" });

    document.removeEventListener("keydown", outside);
    expect(outside).not.toHaveBeenCalled();
  });
});
