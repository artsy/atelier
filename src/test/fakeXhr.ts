import { act } from "@testing-library/react";

// jsdom has no real XHR network stack — a minimal fake standing in for
// XMLHttpRequest, driven manually per test via `respond()`/`progress()`
// rather than a library, since only status/responseText and the
// progress-adjacent events the upload code listens to are ever touched.
type Handler = (event?: unknown) => void;

function register(listeners: Record<string, Handler[]>, event: string, handler: Handler) {
  const existing = listeners[event] ?? [];
  existing.push(handler);
  listeners[event] = existing;
}

export class FakeXhr {
  static instances: FakeXhr[] = [];

  method = "";
  url = "";
  status = 0;
  responseText = "";
  aborted = false;
  sentBody: FormData | undefined;
  private listeners: Record<string, Handler[]> = {};
  private uploadListeners: Record<string, Handler[]> = {};
  upload = {
    addEventListener: (event: string, handler: Handler) =>
      register(this.uploadListeners, event, handler),
  };

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  addEventListener(event: string, handler: Handler) {
    register(this.listeners, event, handler);
  }

  send(body: FormData) {
    this.sentBody = body;
  }

  abort() {
    this.aborted = true;
  }

  progress(loaded: number, total: number) {
    act(() => {
      for (const handler of this.uploadListeners.progress ?? []) {
        handler({ lengthComputable: true, loaded, total });
      }
    });
  }

  uploadFinished() {
    act(() => {
      for (const handler of this.uploadListeners.load ?? []) {
        handler();
      }
    });
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.respondRaw();
  }

  respondRaw() {
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

export function installFakeXhr() {
  FakeXhr.instances = [];
  // biome-ignore lint/suspicious/noExplicitAny: stubbing a browser global for the test, not production code
  (globalThis as any).XMLHttpRequest = FakeXhr;
}

export function lastXhr(): FakeXhr {
  const xhr = FakeXhr.instances.at(-1);
  if (!xhr) {
    throw new Error("no XHR was constructed");
  }
  return xhr;
}

export function zipFile(name = "my-site.zip") {
  return new File(["PK\x03\x04fake"], name, { type: "application/zip" });
}
