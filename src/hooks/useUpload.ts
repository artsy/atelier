import { useEffect, useReducer, useRef } from "react";
import { DEFAULT_MAX_UPLOAD_BYTES } from "../config";
import { deriveSlug } from "../lib/deriveSlug";
import { isZipFile } from "../lib/isZipFile";
import { type UploadState, uploadReducer } from "./uploadReducer";

interface UploadResponse {
  ok?: boolean;
  url?: string;
  error?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

const GENERIC_ERROR = "Something went wrong — please retry.";

function parseResponse(text: string): UploadResponse | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function useUpload() {
  const [state, dispatch] = useReducer(uploadReducer, { status: "idle" } as UploadState);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => () => xhrRef.current?.abort(), []);

  function send(file: File, slug: string, confirm: boolean) {
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("zip", file, file.name);
    if (confirm) {
      formData.set("confirm", "true");
    }

    // XHR rather than fetch: fetch can't report upload progress
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    dispatch({ type: "started" });
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        dispatch({ type: "progressed", percent: Math.round((event.loaded / event.total) * 100) });
      }
    });
    xhr.upload.addEventListener("load", () => dispatch({ type: "processing" }));

    xhr.addEventListener("load", () => {
      xhrRef.current = null;
      const data = parseResponse(xhr.responseText);

      if (!data) {
        dispatch({ type: "failed", message: GENERIC_ERROR });
      } else if (xhr.status === 200 && data.ok && data.url) {
        dispatch({ type: "succeeded", url: data.url });
      } else if (xhr.status === 409) {
        dispatch({
          type: "conflicted",
          slug,
          file,
          existingUrl: data.url,
          uploadedBy: data.uploadedBy,
          uploadedAt: data.uploadedAt,
        });
      } else {
        dispatch({ type: "failed", message: data.error || GENERIC_ERROR });
      }
    });
    xhr.addEventListener("error", () => {
      xhrRef.current = null;
      dispatch({ type: "failed", message: "Network error — please retry." });
    });

    xhr.send(formData);
  }

  function chooseFile(file: File | null | undefined) {
    if (!file || state.status === "busy") {
      return;
    }
    if (!isZipFile(file)) {
      dispatch({ type: "failed", message: "Please drop a .zip file." });
      return;
    }
    if (file.size > DEFAULT_MAX_UPLOAD_BYTES) {
      dispatch({ type: "failed", message: "That file is larger than the upload limit." });
      return;
    }

    const derived = deriveSlug(file.name);
    if (!derived.valid || !derived.slug) {
      dispatch({ type: "failed", message: derived.error ?? "Couldn't derive a slug." });
      return;
    }
    send(file, derived.slug, false);
  }

  function confirmOverwrite() {
    if (state.status === "confirm") {
      send(state.file, state.slug, true);
    }
  }

  function dismiss() {
    dispatch({ type: "dismissed" });
  }

  return { state, chooseFile, confirmOverwrite, dismiss };
}
