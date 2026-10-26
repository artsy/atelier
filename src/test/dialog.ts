export function stubDialog() {
  const showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });

  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;

  return { showModal, close };
}

export function clearDialog() {
  // biome-ignore lint/suspicious/noExplicitAny: jsdom doesn't define these, so tests remove what they added
  delete (HTMLDialogElement.prototype as any).showModal;
  // biome-ignore lint/suspicious/noExplicitAny: as above
  delete (HTMLDialogElement.prototype as any).close;
}
