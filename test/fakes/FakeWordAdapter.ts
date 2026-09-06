import type { SelectionSnapshot, WordAdapter } from "../../src/office/WordAdapter";

export interface ApplyCall {
  readonly snapshot: SelectionSnapshot;
  readonly proposedText: string;
}

export class FakeWordAdapter implements WordAdapter {
  captureCalls = 0;
  readonly applyCalls: ApplyCall[] = [];
  readonly releaseCalls: SelectionSnapshot[] = [];
  captureError?: Error;
  applyError?: Error;
  releaseError?: Error;

  constructor(public snapshot: SelectionSnapshot) {}

  async captureSelection(): Promise<SelectionSnapshot> {
    this.captureCalls++;
    if (this.captureError) {
      throw this.captureError;
    }
    return this.snapshot;
  }

  async applyReplacement(snapshot: SelectionSnapshot, proposedText: string): Promise<void> {
    this.applyCalls.push({ snapshot, proposedText });
    if (this.applyError) {
      throw this.applyError;
    }
  }

  async releaseSelection(snapshot: SelectionSnapshot): Promise<void> {
    this.releaseCalls.push({ ...snapshot });
    if (this.releaseError) {
      throw this.releaseError;
    }
  }
}
