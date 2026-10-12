import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeXhr, installFakeXhr, lastXhr, zipFile } from "../test/fakeXhr";
import { renderWithBoot } from "../test/renderWithBoot";
import IndexPage from "./index.page";

beforeEach(installFakeXhr);

function dropFile(file: File) {
  const dataTransfer = { files: [file] } as unknown as DataTransfer;
  fireEvent.drop(window, { dataTransfer });
}

describe("IndexPage", () => {
  it("uploads a dropped zip and shows the success state", async () => {
    renderWithBoot(<IndexPage />);

    dropFile(zipFile("marketing-dashboard.zip"));
    expect(screen.getByText("Uploading…")).toBeInTheDocument();

    lastXhr().respond(200, { ok: true, url: "https://marketing-dashboard.artsy.dev" });

    expect(await screen.findByText("Your site is live!")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://marketing-dashboard.artsy.dev" }),
    ).toHaveAttribute("href", "https://marketing-dashboard.artsy.dev");
  });

  it("shows upload progress and then processing", () => {
    renderWithBoot(<IndexPage />);

    dropFile(zipFile());
    lastXhr().progress(40, 100);
    expect(screen.getByText("Uploading… 40%")).toBeInTheDocument();

    lastXhr().uploadFinished();
    expect(screen.getByText("Processing…")).toBeInTheDocument();
  });

  it("asks before overwriting on a 409, then re-uploads with confirm=true on Yes", async () => {
    renderWithBoot(<IndexPage />);

    dropFile(zipFile("marketing-dashboard.zip"));
    lastXhr().respond(409, {
      error: "already exists",
      url: "https://marketing-dashboard.artsy.dev",
      uploadedBy: "somebody@artsymail.com",
    });

    expect(await screen.findByText(/There is already a site at/)).toBeInTheDocument();
    expect(
      screen.getByText(/The current site was uploaded by somebody@artsymail.com/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    expect(lastXhr().sentBody?.get("confirm")).toBe("true");
    lastXhr().respond(200, { ok: true, url: "https://marketing-dashboard.artsy.dev" });
    expect(await screen.findByText("Your site is live!")).toBeInTheDocument();
  });

  it("returns to idle without uploading when the overwrite is declined", async () => {
    renderWithBoot(<IndexPage />);

    dropFile(zipFile("marketing-dashboard.zip"));
    lastXhr().respond(409, {
      error: "already exists",
      url: "https://marketing-dashboard.artsy.dev",
    });
    fireEvent.click(await screen.findByRole("button", { name: "No" }));

    await waitFor(() => {
      expect(screen.queryByText(/There is already a site at/)).not.toBeInTheDocument();
    });
    expect(FakeXhr.instances).toHaveLength(1);
  });

  it("shows validation errors without contacting the server", () => {
    renderWithBoot(<IndexPage />);

    dropFile(zipFile("___.zip"));

    expect(screen.getByText(/Couldn't derive a name/)).toBeInTheDocument();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("opens the file picker from the tagline button, which is keyboard accessible", async () => {
    const user = userEvent.setup();
    const { container } = renderWithBoot(<IndexPage />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const click = jest.spyOn(HTMLInputElement.prototype, "click");

    await user.tab();
    expect(screen.getByRole("button", { name: /drop a zip, get a live site/i })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(click).toHaveBeenCalledTimes(1);
    expect(input).not.toBeNull();
  });

  it("uploads a file chosen through the picker", async () => {
    const user = userEvent.setup();
    const { container } = renderWithBoot(<IndexPage />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(input, zipFile("my-site.zip"));

    expect(lastXhr().sentBody?.get("slug")).toBe("my-site");
  });

  it("highlights the viewport while a file is dragged over, and clears it on drop", () => {
    renderWithBoot(<IndexPage />);
    expect(screen.queryByTestId("drag-highlight")).not.toBeInTheDocument();

    fireEvent.dragEnter(window);
    expect(screen.getByTestId("drag-highlight")).toBeInTheDocument();

    dropFile(zipFile());
    expect(screen.queryByTestId("drag-highlight")).not.toBeInTheDocument();
  });

  it("announces status changes through a polite live region", () => {
    renderWithBoot(<IndexPage />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("links to the gallery in a new tab", () => {
    renderWithBoot(<IndexPage />);

    expect(screen.getByRole("link", { name: /See what others have made/ })).toHaveAttribute(
      "href",
      "https://gallery.artsy.dev",
    );
  });
});
