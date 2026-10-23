/* global AbortController */

import type { ChatGateway, CompletionRequest } from "../chat/ChatGateway";
import { ChatGatewayError } from "../chat/ChatGatewayError";
import { validateDocumentProposal } from "../chat/DocumentProposal";
import { WordAdapterError, type SelectionSnapshot, type WordAdapter } from "../office/WordAdapter";
import type { AppErrorCode } from "./errors";
import {
  beginSearch,
  appendSearchDelta,
  completeSearch,
  copyAppState,
  fail,
  initialState,
  returnToReady,
  type AppState,
} from "./state";

export interface SearchInput {
  readonly question: string;
  readonly selection?: SelectionSnapshot;
  readonly uiLocale: "sl-SI" | "en-US";
}

export type StateListener = (state: AppState) => void;

export class TaskPaneController {
  private state: AppState = initialState;
  private readonly listeners = new Set<StateListener>();
  private operationId = 0;
  private completionAbort?: AbortController;
  private activeSnapshot?: SelectionSnapshot;
  private disposed = false;

  constructor(
    private readonly word: WordAdapter,
    private readonly chat: ChatGateway
  ) {}

  getState(): AppState {
    return copyAppState(this.state);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    this.notifyListener(listener);
    return () => this.listeners.delete(listener);
  }

  async search(input: SearchInput): Promise<boolean> {
    if (this.disposed || this.state.kind !== "ready") {
      return false;
    }

    const operationId = ++this.operationId;
    const abortController = new AbortController();
    this.completionAbort = abortController;
    const snapshot = input.selection ? { ...input.selection } : undefined;
    if (snapshot) {
      this.activeSnapshot = snapshot;
    }

    try {
      const request: CompletionRequest = {
        question: input.question,
        context:
          snapshot === undefined
            ? { type: "none" }
            : { type: "selected_text", quotedText: snapshot.text },
        uiLocale: input.uiLocale,
      };
      this.setState(beginSearch(operationId, request));
      const result = await this.chat.complete(request, abortController.signal, {
        onTextDelta: (delta) => {
          const current = this.getInternalState();
          if (
            delta.length > 0 &&
            this.operationId === operationId &&
            current.kind === "searching" &&
            current.operationId === operationId
          ) {
            this.setState(appendSearchDelta(current, delta));
          }
        },
      });
      if (this.operationId !== operationId || this.getInternalState().kind !== "searching") {
        return false;
      }

      const proposal =
        result.proposal != null
          ? validateDocumentProposal(result.proposal, request.uiLocale)
          : undefined;
      if (snapshot && (!proposal || !this.word.documentWriter)) {
        if (this.activeSnapshot === snapshot) {
          this.activeSnapshot = undefined;
        }
        await this.releaseSnapshot(snapshot);
      }
      if (this.operationId !== operationId || this.getInternalState().kind !== "searching") {
        return false;
      }
      this.setState({
        ...completeSearch(request, { ...result, proposal }),
        documentChange:
          proposal && this.word.documentWriter
            ? { status: "ready", canReplace: snapshot !== undefined }
            : undefined,
      });
      return true;
    } catch (error) {
      if (this.operationId !== operationId) {
        return false;
      }
      if (snapshot) {
        if (this.activeSnapshot === snapshot) {
          this.activeSnapshot = undefined;
        }
        await this.releaseSnapshot(snapshot);
      }
      if (this.operationId !== operationId) {
        return false;
      }
      this.setState(fail({ code: this.appErrorCode(error) }));
      return false;
    } finally {
      if (this.operationId === operationId) {
        this.completionAbort = undefined;
      }
    }
  }

  async cancel(): Promise<boolean> {
    if (this.state.kind !== "capturing" && this.state.kind !== "searching") {
      return false;
    }

    const snapshot = this.activeSnapshot;
    this.activeSnapshot = undefined;
    this.completionAbort?.abort();
    this.operationId++;
    this.setState(returnToReady());
    if (snapshot) {
      await this.releaseSnapshot(snapshot);
    }
    return true;
  }

  reset(): boolean {
    if (this.state.kind !== "result" && this.state.kind !== "error") {
      return false;
    }
    if (this.state.kind === "result" && this.state.documentChange?.status === "applying") {
      return false;
    }
    this.releaseActiveSnapshot();
    this.setState(returnToReady());
    return true;
  }

  /** A one-shot user gesture: neither result arrival nor retries call this method. */
  async applyProposal(mode: "replace" | "insert"): Promise<boolean> {
    const state = this.state;
    const writer = this.word.documentWriter;
    const proposal = state.kind === "result" ? state.result.proposal : undefined;
    if (
      this.disposed ||
      state.kind !== "result" ||
      !proposal ||
      !writer ||
      state.documentChange?.status !== "ready" ||
      (mode === "replace" && (!state.documentChange.canReplace || !this.activeSnapshot))
    ) {
      return false;
    }
    const snapshot = this.activeSnapshot;
    this.setState({ ...state, documentChange: { ...state.documentChange, status: "applying" } });
    try {
      if (mode === "replace" && snapshot) {
        await writer.applyReplacement({ ...snapshot }, proposal.text);
      } else {
        await writer.insertAtCursor(proposal.text);
      }
      this.setState({ ...state, documentChange: { ...state.documentChange, status: "applied" } });
      return true;
    } catch (error) {
      const code =
        error instanceof WordAdapterError &&
        (error.code === "SELECTION_CHANGED" || error.code === "CURSOR_REQUIRED")
          ? error.code
          : "WORD_WRITE_FAILED";
      this.setState({
        ...state,
        documentChange: { ...state.documentChange, status: "failed", error: code },
      });
      return false;
    } finally {
      this.releaseActiveSnapshot();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.completionAbort?.abort();
    this.operationId++;
    this.listeners.clear();
    if (this.state.kind !== "result" || this.state.documentChange?.status !== "applying") {
      this.releaseActiveSnapshot();
    }
  }

  private releaseActiveSnapshot(): void {
    const snapshot = this.activeSnapshot;
    this.activeSnapshot = undefined;
    if (snapshot) void this.releaseSnapshot(snapshot);
  }

  private setState(state: AppState): void {
    this.state = copyAppState(state);
    [...this.listeners].forEach((listener) => this.notifyListener(listener));
  }

  private getInternalState(): AppState {
    return this.state;
  }

  private appErrorCode(error: unknown): AppErrorCode {
    return error instanceof ChatGatewayError ? error.code : "COMPLETION_FAILED";
  }

  private async releaseSnapshot(snapshot: SelectionSnapshot): Promise<void> {
    try {
      await this.word.releaseSelection({ ...snapshot });
    } catch {
      // Cleanup failures never expose selection content or replace the primary result.
    }
  }

  private notifyListener(listener: StateListener): void {
    try {
      listener(copyAppState(this.state));
    } catch {
      this.listeners.delete(listener);
    }
  }
}
