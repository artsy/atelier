import { act, fireEvent, renderHook } from "@testing-library/react";
import { useWindowFileDrop } from "./useWindowFileDrop";

function drop(files: File[]) {
  const dataTransfer = { files } as unknown as DataTransfer;
  fireEvent.drop(window, { dataTransfer });
}

describe("useWindowFileDrop", () => {
  it("reports dragging from the first dragenter until the drop", () => {
    const { result } = renderHook(() => useWindowFileDrop(jest.fn()));
    expect(result.current.isDragging).toBe(false);

    act(() => {
      fireEvent.dragEnter(window);
    });
    expect(result.current.isDragging).toBe(true);

    act(() => drop([new File(["x"], "a.zip")]));
    expect(result.current.isDragging).toBe(false);
  });

  it("stays dragging until every nested dragenter has a matching dragleave", () => {
    const { result } = renderHook(() => useWindowFileDrop(jest.fn()));

    act(() => {
      fireEvent.dragEnter(window);
      fireEvent.dragEnter(window);
      fireEvent.dragLeave(window);
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      fireEvent.dragLeave(window);
    });
    expect(result.current.isDragging).toBe(false);
  });

  it("calls onFile with the first dropped file", () => {
    const onFile = jest.fn();
    renderHook(() => useWindowFileDrop(onFile));
    const first = new File(["x"], "first.zip");

    act(() => drop([first, new File(["y"], "second.zip")]));

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(first);
  });

  it("does not call onFile for a drop with no files", () => {
    const onFile = jest.fn();
    renderHook(() => useWindowFileDrop(onFile));

    act(() => drop([]));

    expect(onFile).not.toHaveBeenCalled();
  });

  it("cancels dragover so the browser allows the drop", () => {
    renderHook(() => useWindowFileDrop(jest.fn()));

    const notCancelled = fireEvent.dragOver(window);

    expect(notCancelled).toBe(false);
  });

  it("uses the latest onFile without resubscribing", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ onFile }) => useWindowFileDrop(onFile), {
      initialProps: { onFile: first },
    });
    rerender({ onFile: second });

    act(() => drop([new File(["x"], "a.zip")]));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops listening on unmount", () => {
    const onFile = jest.fn();
    const { unmount } = renderHook(() => useWindowFileDrop(onFile));
    unmount();

    drop([new File(["x"], "a.zip")]);

    expect(onFile).not.toHaveBeenCalled();
  });
});
