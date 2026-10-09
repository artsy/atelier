import { Box } from "@artsy/palette";

export function DragHighlight() {
  return (
    <Box
      data-testid="drag-highlight"
      position="fixed"
      top={0}
      right={0}
      bottom={0}
      left={0}
      pointerEvents="none"
      boxShadow="inset 0 0 0 6px rgba(255, 255, 255, 0.85)"
    />
  );
}
