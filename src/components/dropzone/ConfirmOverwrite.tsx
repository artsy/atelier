import { formatAttribution } from "../../lib/formatAttribution";
import { HeroAction, HeroLink, HeroText } from "./HeroText";

interface ConfirmOverwriteProps {
  slug: string;
  existingUrl?: string | undefined;
  uploadedBy?: string | undefined;
  uploadedAt?: string | undefined;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ConfirmOverwrite({
  slug,
  existingUrl,
  uploadedBy,
  uploadedAt,
  onConfirm,
  onDismiss,
}: ConfirmOverwriteProps) {
  const siteLabel = existingUrl?.replace(/^https?:\/\//, "") ?? slug;
  const attribution = formatAttribution(uploadedBy, uploadedAt);

  return (
    <>
      <HeroText variant="lg-display" fontWeight="bold" textColor="yellow100">
        There is already a site at{" "}
        {existingUrl ? (
          <HeroLink href={existingUrl} target="_blank" rel="noopener noreferrer">
            {siteLabel}
          </HeroLink>
        ) : (
          siteLabel
        )}
      </HeroText>
      <HeroText variant="lg-display" fontWeight="bold" textColor="yellow100">
        Overwrite? <HeroAction onClick={onConfirm}>Yes</HeroAction> /{" "}
        <HeroAction onClick={onDismiss}>No</HeroAction>
      </HeroText>
      {attribution && (
        <HeroText variant="sm" mt={1} opacity={0.85}>
          The current site was {attribution}
        </HeroText>
      )}
    </>
  );
}
