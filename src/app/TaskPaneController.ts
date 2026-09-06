/* global AbortController */

import type { ChatGateway, CompletionRequest } from "../chat/ChatGateway";
import { ChatGatewayError } from "../chat/ChatGatewayError";
import { WordAdapterError, type SelectionSnapshot, type WordAdapter } from "../office/WordAdapter";
import type { AppErrorCode } from "./errors";
import {
  beginCapture,
  beginSearch,
  completeSearch,
  copyAppState,
  fail,
  initialState,
  returnToReady,
  type AppState,
} from "./state";

export type DocumentContextMode = "none" | "selected-text";

export interface SearchInput {
  readonly question: string;
  readonly contextMode: DocumentContextMode;
  readonly uiLocale: "sl-SI" | "en-US";
}

export type StateListener = (state: AppState) => void;

export class TaskPaneController {
  private state: AppState = initialState;
  private readonly listeners = new Set<StateListener>();
  private operationId = 0;
  private completionAbort?: AbortController;
  private activeSnapshot?: SelectionSnapshot;

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
    if (this.state.kind !== "ready") {
      return false;
    }

    const operationId = ++this.operationId;
    const abortController = new AbortController();
    this.completionAbort = abortController;
    let errorCode: AppErrorCode = "COMPLETION_FAILED";
    let snapshot: SelectionSnapshot | undefined;

    try {
      if (input.contextMode === "selected-text") {
        errorCode = "CAPTURE_FAILED";
        this.setState(beginCapture(operationId));
        snapshot = await this.word.captureSelection();
        if (this.operationId !== operationId) {
          await this.releaseSnapshot(snapshot);
          return false;
        }
        this.activeSnapshot = snapshot;
      }

      const request: CompletionRequest = {
        question: input.question,
        context:
          snapshot === undefined
            ? { type: "none" }
            : { type: "selected_text", quotedText: snapshot.text },
        uiLocale: input.uiLocale,
      };
      errorCode = "COMPLETION_FAILED";
      this.setState(beginSearch(operationId, request));
      const result = await this.chat.complete(request, abortController.signal);
      if (this.operationId !== operationId || this.getInternalState().kind !== "searching") {
        return false;
      }

      if (snapshot) {
        if (this.activeSnapshot === snapshot) {
          this.activeSnapshot = undefined;
        }
        await this.releaseSnapshot(snapshot);
      }
      if (this.operationId !== operationId || this.getInternalState().kind !== "searching") {
        return false;
      }
      this.setState(completeSearch(request, result));
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
      this.setState(fail({ code: this.appErrorCode(error, errorCode) }));
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
    this.setState(returnToReady());
    return true;
  }

  private setState(state: AppState): void {
    this.state = copyAppState(state);
    [...this.listeners].forEach((listener) => this.notifyListener(listener));
  }

  private getInternalState(): AppState {
    return this.state;
  }

  private appErrorCode(error: unknown, fallback: AppErrorCode): AppErrorCode {
    return error instanceof WordAdapterError || error instanceof ChatGatewayError
      ? error.code
      : fallback;
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
