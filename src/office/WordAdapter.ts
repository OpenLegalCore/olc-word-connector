export interface SelectionSnapshot {
  readonly snapshotId: string;
  readonly text: string;
  readonly characterCount: number;
  readonly context: "body" | "single-table-cell";
  readonly capturedAt: string;
}

export type WordAdapterErrorCode =
  | "NO_SELECTION"
  | "SELECTION_TOO_LARGE"
  | "UNSUPPORTED_SELECTION"
  | "SELECTION_CHANGED"
  | "WORD_READ_FAILED"
  | "WORD_WRITE_FAILED";

export class WordAdapterError extends Error {
  constructor(readonly code: WordAdapterErrorCode) {
    super(code);
    this.name = "WordAdapterError";
  }
}

export interface WordAdapter {
  captureSelection(): Promise<SelectionSnapshot>;
  releaseSelection(snapshot: SelectionSnapshot): Promise<void>;
}
