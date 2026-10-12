export type UploadState =
  | { status: "idle" }
  | { status: "busy"; stage: "uploading" | "processing"; percent?: number }
  | { status: "error"; message: string }
  | {
      status: "confirm";
      slug: string;
      file: File;
      existingUrl?: string | undefined;
      uploadedBy?: string | undefined;
      uploadedAt?: string | undefined;
    }
  | { status: "success"; url: string };

export type UploadAction =
  | { type: "started" }
  | { type: "progressed"; percent: number }
  | { type: "processing" }
  | { type: "succeeded"; url: string }
  | { type: "failed"; message: string }
  | {
      type: "conflicted";
      slug: string;
      file: File;
      existingUrl?: string | undefined;
      uploadedBy?: string | undefined;
      uploadedAt?: string | undefined;
    }
  | { type: "dismissed" };

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "started":
      return { status: "busy", stage: "uploading" };
    case "progressed":
      return state.status === "busy" ? { ...state, percent: action.percent } : state;
    case "processing":
      return state.status === "busy" ? { status: "busy", stage: "processing" } : state;
    case "succeeded":
      return { status: "success", url: action.url };
    case "failed":
      return { status: "error", message: action.message };
    case "conflicted": {
      const { type: _type, ...conflict } = action;
      return { status: "confirm", ...conflict };
    }
    case "dismissed":
      return { status: "idle" };
  }
}
