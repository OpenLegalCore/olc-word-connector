import type { CompletionRequest, CompletionResult } from "../chat/ChatGateway";
import type { AppError } from "./errors";

export type ReadyState = { readonly kind: "ready" };
export type CapturingState = { readonly kind: "capturing"; readonly operationId: number };
export type SearchingState = {
  readonly kind: "searching";
  readonly operationId: number;
  readonly request: CompletionRequest;
};
export type ResultState = {
  readonly kind: "result";
  readonly request: CompletionRequest;
  readonly result: CompletionResult;
};
export type ErrorState = { readonly kind: "error"; readonly error: AppError };

export type AppState = ReadyState | CapturingState | SearchingState | ResultState | ErrorState;

export const initialState: ReadyState = { kind: "ready" };

export function copyCompletionRequest(request: CompletionRequest): CompletionRequest {
  return {
    question: request.question,
    context:
      request.context.type === "none"
        ? { type: "none" }
        : { type: "selected_text", quotedText: request.context.quotedText },
    uiLocale: request.uiLocale,
  };
}

export function copyCompletionResult(result: CompletionResult): CompletionResult {
  return {
    text: result.text,
    model: result.model,
    usage: result.usage
      ? {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        }
      : undefined,
  };
}

export function copyAppState(state: AppState): AppState {
  if (state.kind === "searching") {
    return { ...state, request: copyCompletionRequest(state.request) };
  }
  if (state.kind === "result") {
    return {
      kind: "result",
      request: copyCompletionRequest(state.request),
      result: copyCompletionResult(state.result),
    };
  }
  if (state.kind === "error") {
    return { kind: "error", error: { code: state.error.code } };
  }
  return { ...state };
}

export function beginCapture(operationId: number): CapturingState {
  return { kind: "capturing", operationId };
}

export function beginSearch(operationId: number, request: CompletionRequest): SearchingState {
  return { kind: "searching", operationId, request: copyCompletionRequest(request) };
}

export function completeSearch(request: CompletionRequest, result: CompletionResult): ResultState {
  return {
    kind: "result",
    request: copyCompletionRequest(request),
    result: copyCompletionResult(result),
  };
}

export function fail(error: AppError): ErrorState {
  return { kind: "error", error: { code: error.code } };
}

export function returnToReady(): ReadyState {
  return initialState;
}
