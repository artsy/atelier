type Listener = () => void;

export function mockColorScheme(initial: "light" | "dark") {
  let scheme = initial;
  const listeners = new Set<Listener>();

  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    get matches() {
      return query === "(prefers-color-scheme: dark)" && scheme === "dark";
    },
    media: query,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  }));

  return {
    set(next: "light" | "dark") {
      scheme = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export function clearMatchMedia() {
  // biome-ignore lint/suspicious/noExplicitAny: jsdom doesn't define matchMedia, so tests remove what they added
  delete (window as any).matchMedia;
}
