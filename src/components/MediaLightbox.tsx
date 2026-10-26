import { type ReactNode, useRef, useState } from "react";
import styled from "styled-components";

interface MediaLightboxProps {
  label: string;
  media: ReactNode;
  children: ReactNode;
}

export function MediaLightbox({ label, media, children }: MediaLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  function open() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function handleClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current.close();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
    }
  }

  return (
    <>
      <ThumbnailButton type="button" onClick={open}>
        {children}
      </ThumbnailButton>

      <Dialog
        ref={dialogRef}
        aria-label={label}
        onClick={handleClick}
        onClose={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      >
        {isOpen && media}
      </Dialog>
    </>
  );
}

const ThumbnailButton = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
`;

const Dialog = styled.dialog`
  padding: 0;
  border: none;
  background: transparent;
  outline: none;
  max-width: 90vw;
  max-height: 90vh;

  &::backdrop {
    background: rgba(0, 0, 0, 0.8);
  }

  video {
    display: block;
    max-width: 90vw;
    max-height: 90vh;
  }
`;
