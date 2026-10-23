import { WordAdapterError, type SelectionSnapshot } from "../../src/office/WordAdapter";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";

const originalText = "Sintetični prvotni odlomek.";

type DocumentState = { target: string; inserted: string };
export class SyntheticProposalWord extends FakeWordAdapter {
  private state: DocumentState = { target: originalText, inserted: "" };
  private undoStates: DocumentState[] = [];
  private redoStates: DocumentState[] = [];
  onChange: () => void = () => {};
  readonly documentWriter = {
    applyReplacement: async (snapshot: SelectionSnapshot, text: string): Promise<void> => {
      if (
        snapshot.snapshotId !== "synthetic-original" ||
        this.snapshot.snapshotId !== snapshot.snapshotId ||
        snapshot.text !== this.state.target ||
        this.snapshot.text !== snapshot.text
      )
        throw new WordAdapterError("SELECTION_CHANGED");
      this.commit({ ...this.state, target: text });
    },
    insertAtCursor: async (text: string): Promise<void> => {
      if (this.snapshot.snapshotId !== "synthetic-cursor" || this.snapshot.text !== "")
        throw new WordAdapterError("CURSOR_REQUIRED");
      this.commit({ ...this.state, inserted: this.state.inserted + text });
    },
  };
  constructor() {
    super({
      snapshotId: "synthetic-original",
      text: originalText,
      characterCount: originalText.length,
      context: "body",
      capturedAt: new Date(0).toISOString(),
    });
  }
  get documentText(): string {
    return `UVOD — ${this.state.target} — ZAKLJUČEK${this.state.inserted}`;
  }
  choose(mode: "original" | "cursor" | "other"): void {
    const text = mode === "cursor" ? "" : this.state.target;
    this.captureError = mode === "cursor" ? new WordAdapterError("NO_SELECTION") : undefined;
    this.emitSelectionChange({
      snapshotId: `synthetic-${mode}`,
      text,
      characterCount: text.length,
      context: "body",
      capturedAt: new Date(0).toISOString(),
    });
    this.onChange();
  }
  drift(): void {
    this.state = { ...this.state, target: this.state.target + " Sprememba." };
    this.choose("original");
  }
  undo(): void {
    const s = this.undoStates.pop();
    if (s) {
      this.redoStates.push({ ...this.state });
      this.state = s;
      this.onChange();
    }
  }
  redo(): void {
    const s = this.redoStates.pop();
    if (s) {
      this.undoStates.push({ ...this.state });
      this.state = s;
      this.onChange();
    }
  }
  private commit(next: DocumentState): void {
    this.undoStates.push({ ...this.state });
    this.redoStates = [];
    this.state = next;
    this.onChange();
  }
}
