import { Box } from "@artsy/palette";
import type { UploadState } from "../../hooks/uploadReducer";
import { ConfirmOverwrite } from "./ConfirmOverwrite";
import { HeroLink, HeroText } from "./HeroText";

interface UploadStatusProps {
  state: UploadState;
  onConfirm: () => void;
  onDismiss: () => void;
}

function busyMessage(state: Extract<UploadState, { status: "busy" }>): string {
  if (state.stage === "processing") {
    return "Processing…";
  }
  return state.percent === undefined ? "Uploading…" : `Uploading… ${state.percent}%`;
}

function StatusContent({ state, onConfirm, onDismiss }: UploadStatusProps) {
  switch (state.status) {
    case "idle":
      return null;
    case "busy":
      return (
        <HeroText variant="lg-display" fontWeight="bold">
          {busyMessage(state)}
        </HeroText>
      );
    case "error":
      return (
        <HeroText variant="lg-display" fontWeight="bold" textColor="yellow100">
          {state.message}
        </HeroText>
      );
    case "success":
      return (
        <>
          <HeroText variant="lg-display" fontWeight="bold">
            Your site is live!
          </HeroText>
          <HeroText variant="lg-display" fontWeight="bold">
            <HeroLink href={state.url} target="_blank" rel="noopener noreferrer">
              {state.url}
            </HeroLink>
          </HeroText>
        </>
      );
    case "confirm":
      return (
        <ConfirmOverwrite
          slug={state.slug}
          existingUrl={state.existingUrl}
          uploadedBy={state.uploadedBy}
          uploadedAt={state.uploadedAt}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      );
  }
}

export function UploadStatus(props: UploadStatusProps) {
  return (
    <Box role="status" mt={4}>
      <StatusContent {...props} />
    </Box>
  );
}
