import { useEffect, useEffectEvent, useState } from "react";

export function useWindowFileDrop(onFile: (file: File) => void): { isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false);
  const handleFile = useEffectEvent(onFile);

  useEffect(() => {
    // dragenter/dragleave also fire for every child element crossed, so
    // dragging is tracked by depth rather than a boolean
    let depth = 0;

    function onDragEnter(event: DragEvent) {
      event.preventDefault();
      depth++;
      setIsDragging(true);
    }
    function onDragOver(event: DragEvent) {
      event.preventDefault();
    }
    function onDragLeave() {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setIsDragging(false);
      }
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      depth = 0;
      setIsDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) {
        handleFile(file);
      }
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return { isDragging };
}
