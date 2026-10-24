import { Flex } from "@artsy/palette";
import Head from "next/head";
import { useRef } from "react";
import styled from "styled-components";
import { ButtonLink } from "../components/ButtonLink";
import { DragHighlight } from "../components/dropzone/DragHighlight";
import { HeroText } from "../components/dropzone/HeroText";
import { UploadStatus } from "../components/dropzone/UploadStatus";
import { HeroBackground } from "../components/HeroBackground";
import { useUpload } from "../hooks/useUpload";
import { useWindowFileDrop } from "../hooks/useWindowFileDrop";

const TaglineButton = styled.button`
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  &:disabled {
    cursor: default;
  }
`;

export default function IndexPage() {
  const { state, chooseFile, confirmOverwrite, dismiss } = useUpload();
  const { isDragging } = useWindowFileDrop(chooseFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <>
      <HeroBackground />
      <Head>
        <title>Atelier</title>
      </Head>

      {isDragging && <DragHighlight />}

      <Flex flexDirection="column" alignItems="center" textAlign="center">
        <HeroText as="h1" variant="xxxl" fontWeight={400} m={0}>
          The Atelier
        </HeroText>

        <TaglineButton
          type="button"
          disabled={state.status === "busy"}
          onClick={() => fileInputRef.current?.click()}
        >
          <HeroText variant="lg-display" fontWeight="bold">
            A place to hang your html sketches. Drop a zip, get a live site.
          </HeroText>
        </TaglineButton>

        <UploadStatus state={state} onConfirm={confirmOverwrite} onDismiss={dismiss} />

        <Flex gap={4} mt={2} flexWrap="wrap" justifyContent="center">
          <ButtonLink
            bg="white"
            color="black"
            href="/sites/"
            target="gallery"
            rel="noopener noreferrer"
          >
            See what others have made ↗︎
          </ButtonLink>
        </Flex>
      </Flex>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleFileInputChange}
      />
    </>
  );
}
