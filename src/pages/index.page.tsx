import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_MAX_UPLOAD_BYTES } from "../config";
import { deriveSlug } from "../lib/deriveSlug";
import { formatRelativeTime } from "../lib/formatRelativeTime";

// uploadedBy is best-effort provenance, not verified identity — it may be
// an Access email, a free-text form value, "anonymous", or absent
// entirely. Shown in full (not just the local-part): Access spans two
// Google Workspace domains (Artsy and Artnet), so two people can share a
// local-part, and the domain is what disambiguates them. Returns null
// when there's nothing worth displaying.
function formatUploader(value: string | undefined): string | null {
  return !value || value === "anonymous" ? null : value;
}

// Builds "uploaded by roop 37 minutes ago", degrading gracefully when
// either half is unavailable, or omitting the line entirely when neither
// is. React escapes all of this automatically since it's rendered as text,
// never innerHTML — unlike app.js's copy, no manual escaping is needed.
function formatAttribution(uploadedBy: string | undefined, uploadedAt: string | undefined) {
  const who = formatUploader(uploadedBy);
  const when = formatRelativeTime(uploadedAt);
  if (who && when) {
    return `uploaded by ${who} ${when}`;
  }
  if (who) {
    return `uploaded by ${who}`;
  }
  if (when) {
    return `uploaded ${when}`;
  }
  return null;
}

function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    return true;
  }
  return file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface UploadResponse {
  ok?: boolean;
  url?: string;
  error?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

// A plain useState discriminated union, kept directly in this component
// rather than split into a reducer or extracted hooks — this page is
// expected to be rewritten ground-up soon, so investing in that structure
// now would be work thrown away twice. The confirm variant carries the
// pendingFormData that app.js stashed at module scope.
type UploadState =
  | { status: "idle" }
  | { status: "busy"; message: string }
  | { status: "error"; message: string }
  | {
      status: "confirm";
      slug: string;
      formData: FormData;
      existingUrl?: string;
      uploadedBy?: string;
      uploadedAt?: string;
    }
  | { status: "success"; url: string };

export default function IndexPage() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  // A ref alongside the state, so upload()'s XHR callbacks (registered once
  // per call, outside React's render cycle) can always check the *current*
  // uploading flag without becoming stale closures over the state at the
  // time upload() was called.
  const uploadingRef = useRef(false);

  useEffect(() => {
    uploadingRef.current = state.status === "busy";
  }, [state.status]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleFile (called inside the drop handler below) closes over state indirectly only through uploadingRef and setState, both stable across renders — safe to omit despite being defined in the component body
  useEffect(() => {
    document.body.classList.toggle("drag-active", false);

    function onDragEnter(event: DragEvent) {
      event.preventDefault();
      dragDepthRef.current++;
      document.body.classList.add("drag-active");
    }
    function onDragOver(event: DragEvent) {
      event.preventDefault(); // required on every dragover to allow a drop
    }
    function onDragLeave() {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        document.body.classList.remove("drag-active");
      }
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      dragDepthRef.current = 0;
      document.body.classList.remove("drag-active");
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
      document.body.classList.remove("drag-active");
    };
  }, []);

  function upload(formData: FormData, slug: string) {
    uploadingRef.current = true;
    setState({ status: "busy", message: "Uploading…" });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setState({
          status: "busy",
          message: `Uploading… ${Math.round((event.loaded / event.total) * 100)}%`,
        });
      }
    });
    xhr.upload.addEventListener("load", () => {
      setState({ status: "busy", message: "Processing…" });
    });

    xhr.addEventListener("load", () => {
      uploadingRef.current = false;
      const data = safeJson(xhr.responseText) as UploadResponse | null;

      if (!data) {
        setState({ status: "error", message: "Something went wrong — please retry." });
        return;
      }
      if (xhr.status === 200 && data.ok && data.url) {
        setState({ status: "success", url: data.url });
        return;
      }
      if (xhr.status === 409) {
        setState({
          status: "confirm",
          slug,
          formData,
          ...(data.url !== undefined && { existingUrl: data.url }),
          ...(data.uploadedBy !== undefined && { uploadedBy: data.uploadedBy }),
          ...(data.uploadedAt !== undefined && { uploadedAt: data.uploadedAt }),
        });
        return;
      }
      setState({ status: "error", message: data.error || "Something went wrong — please retry." });
    });
    xhr.addEventListener("error", () => {
      uploadingRef.current = false;
      setState({ status: "error", message: "Network error — please retry." });
    });

    xhr.send(formData);
  }

  function handleFile(file: File | null | undefined) {
    if (!file || uploadingRef.current) {
      return;
    }
    if (!isZipFile(file)) {
      setState({ status: "error", message: "Please drop a .zip file." });
      return;
    }
    if (file.size > DEFAULT_MAX_UPLOAD_BYTES) {
      setState({ status: "error", message: "That file is larger than the upload limit." });
      return;
    }

    const derived = deriveSlug(file.name);
    if (!derived.valid || !derived.slug) {
      setState({ status: "error", message: derived.error ?? "Couldn't derive a slug." });
      return;
    }

    const formData = new FormData();
    formData.set("slug", derived.slug);
    formData.set("zip", file, file.name);
    upload(formData, derived.slug);
  }

  function handleConfirmYes() {
    if (state.status !== "confirm") {
      return;
    }
    state.formData.set("confirm", "true");
    upload(state.formData, state.slug);
  }

  function handleConfirmNo() {
    setState({ status: "idle" });
  }

  // Whole page is the drop target, but click-to-browse is scoped to the
  // tagline/status area (not the giant title) so clicking elsewhere on the
  // page doesn't surprise the user with a file picker. Status-area clicks
  // are handled by their own onClick with stopPropagation, so this only
  // fires for clicks on the tagline itself.
  function handleClickTargetClick() {
    if (uploadingRef.current) {
      return;
    }
    fileInputRef.current?.click();
  }

  function handleBrowseTriggerClick() {
    if (!uploadingRef.current) {
      fileInputRef.current?.click();
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    event.target.value = ""; // allow re-selecting the same file later
  }

  const attribution =
    state.status === "confirm" ? formatAttribution(state.uploadedBy, state.uploadedAt) : null;
  const siteLabel =
    state.status === "confirm"
      ? (state.existingUrl?.replace(/^https?:\/\//, "") ?? state.slug)
      : "";

  return (
    <>
      <Head>
        <title>Atelier</title>
      </Head>

      {/*
        Drag-and-drop and click-anywhere are pointer-only. This button is the
        keyboard/screen-reader path to the same file picker — visually hidden
        until focused (classic skip-link pattern) so it doesn't disturb the
        hero for mouse users, but it's still reachable via Tab and announced
        by assistive tech regardless of visibility.
      */}
      <button type="button" className="browse-trigger" onClick={handleBrowseTriggerClick}>
        Choose a zip file
      </button>

      <div className="branding">
        <div className="title">The Atelier</div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only click-to-browse, same as app.js; the browse-trigger button above is the independent keyboard/screen-reader path to the same file picker */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: see noStaticElementInteractions above */}
        <div className="click-target" onClick={handleClickTargetClick}>
          <div className="tagline">
            A place to hang your html sketches. Drop a zip, get a live site.
          </div>
          {state.status !== "idle" && (
            // biome-ignore lint/a11y/noStaticElementInteractions: only stops the click-target's onClick from firing when the status area itself is clicked (e.g. its Yes/No buttons) — not an interactive element in its own right
            // biome-ignore lint/a11y/useKeyWithClickEvents: see noStaticElementInteractions above
            <div
              className={`status ${state.status === "error" || state.status === "confirm" ? state.status : ""}`}
              aria-live="polite"
              onClick={(event) => event.stopPropagation()}
            >
              {state.status === "busy" && <span className="line">{state.message}</span>}
              {state.status === "error" && <span className="line">{state.message}</span>}
              {state.status === "success" && (
                <>
                  <span className="line">Your site is live!</span>
                  <a className="url" href={state.url} target="_blank" rel="noopener noreferrer">
                    {state.url}
                  </a>
                </>
              )}
              {state.status === "confirm" && (
                <>
                  <span className="line">
                    There is already a site at{" "}
                    {state.existingUrl ? (
                      <a href={state.existingUrl} target="_blank" rel="noopener noreferrer">
                        {siteLabel}
                      </a>
                    ) : (
                      siteLabel
                    )}
                  </span>
                  <span className="line">
                    Overwrite?{" "}
                    <button type="button" className="link-btn" onClick={handleConfirmYes}>
                      Yes
                    </button>{" "}
                    /{" "}
                    <button type="button" className="link-btn" onClick={handleConfirmNo}>
                      No
                    </button>
                  </span>
                  {attribution && (
                    <span className="line provenance">The current site was {attribution}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="gallery-link">
          <a href="https://gallery.artsy.dev" target="gallery" rel="noopener noreferrer">
            See what others have made &rarr;
          </a>
        </div>
      </div>

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
