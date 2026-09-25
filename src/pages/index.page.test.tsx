import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import IndexPage from "./index.page";

// jsdom has no real XHR network stack — a minimal fake standing in for
// XMLHttpRequest, driven manually per test via `respond()`/`progress()`
// rather than a library, since only status/responseText and the two
// progress-adjacent events this page listens to are ever touched.
class FakeXhr {
  static instances: FakeXhr[] = [];

  method = "";
  url = "";
  status = 0;
  responseText = "";
  upload = { addEventListener: jest.fn() };
  private listeners: Record<string, Array<() => void>> = {};
  sentBody: FormData | undefined;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  addEventListener(event: string, handler: () => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  send(body: FormData) {
    this.sentBody = body;
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    act(() => {
      for (const handler of this.listeners.load ?? []) {
        handler();
      }
    });
  }

  networkError() {
    act(() => {
      for (const handler of this.listeners.error ?? []) {
        handler();
      }
    });
  }
}

function lastXhr(): FakeXhr {
  const xhr = FakeXhr.instances.at(-1);
  if (!xhr) {
    throw new Error("no XHR was constructed");
  }
  return xhr;
}

function zipFile(name = "my-site.zip") {
  return new File(["PK\x03\x04fake"], name, { type: "application/zip" });
}

beforeEach(() => {
  FakeXhr.instances = [];
  // biome-ignore lint/suspicious/noExplicitAny: stubbing a browser global for the test, not production code
  (globalThis as any).XMLHttpRequest = FakeXhr;
});

afterEach(() => {
  document.body.classList.remove("drag-active");
});

function dropFile(file: File) {
  const dataTransfer = { files: [file] } as unknown as DataTransfer;
  fireEvent.drop(window, { dataTransfer });
}

describe("IndexPage", () => {
  it("uploads a dropped zip and shows the success state", async () => {
    render(<IndexPage />);

    dropFile(zipFile());
    const xhr = lastXhr();
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/upload");
    expect(xhr.sentBody?.get("slug")).toBe("my-site");

    xhr.respond(200, { ok: true, url: "https://my-site.artsy.dev" });

    await waitFor(() => {
      expect(screen.getByText("Your site is live!")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "https://my-site.artsy.dev" })).toHaveAttribute(
      "href",
      "https://my-site.artsy.dev",
    );
  });

  it("shows the confirm-overwrite prompt on a 409, then re-uploads with confirm=true on Yes", async () => {
    render(<IndexPage />);

    dropFile(zipFile("marketing-dashboard.zip"));
    lastXhr().respond(409, {
      error: 'Slug "marketing-dashboard" already exists',
      url: "https://marketing-dashboard.artsy.dev",
      uploadedBy: "somebody@artsymail.com",
      uploadedAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(screen.getByText(/There is already a site at/)).toBeInTheDocument();
    });
    expect(screen.getByText(/uploaded by somebody@artsymail.com/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    const confirmXhr = lastXhr();
    expect(confirmXhr.sentBody?.get("confirm")).toBe("true");
    expect(confirmXhr.sentBody?.get("slug")).toBe("marketing-dashboard");

    confirmXhr.respond(200, { ok: true, url: "https://marketing-dashboard.artsy.dev" });

    await waitFor(() => {
      expect(screen.getByText("Your site is live!")).toBeInTheDocument();
    });
  });

  it("returns to idle when the confirm prompt is declined", async () => {
    render(<IndexPage />);

    dropFile(zipFile("marketing-dashboard.zip"));
    lastXhr().respond(409, {
      error: "already exists",
      url: "https://marketing-dashboard.artsy.dev",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "No" }));

    await waitFor(() => {
      expect(screen.queryByText(/There is already a site at/)).not.toBeInTheDocument();
    });
    expect(FakeXhr.instances).toHaveLength(1); // no second upload fired
  });

  it("rejects a filename that can't derive a valid slug", () => {
    render(<IndexPage />);

    dropFile(zipFile("___.zip"));

    expect(screen.getByText(/Couldn't derive a name/)).toBeInTheDocument();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("rejects a file over the upload size limit before ever contacting the server", () => {
    render(<IndexPage />);

    const oversized = new File([new Uint8Array(1)], "big-site.zip", { type: "application/zip" });
    Object.defineProperty(oversized, "size", { value: 52428800 + 1 });
    dropFile(oversized);

    expect(screen.getByText(/larger than the upload limit/)).toBeInTheDocument();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("toggles the drag-active class on the whole document during a drag, and clears it on drop", () => {
    render(<IndexPage />);

    fireEvent.dragEnter(window);
    expect(document.body.classList.contains("drag-active")).toBe(true);

    dropFile(zipFile());
    expect(document.body.classList.contains("drag-active")).toBe(false);
  });

  it("clears drag-active only once every nested dragenter has a matching dragleave", () => {
    render(<IndexPage />);

    fireEvent.dragEnter(window);
    fireEvent.dragEnter(window); // e.g. entering a child element fires a second enter
    fireEvent.dragLeave(window);
    expect(document.body.classList.contains("drag-active")).toBe(true);

    fireEvent.dragLeave(window);
    expect(document.body.classList.contains("drag-active")).toBe(false);
  });
});
