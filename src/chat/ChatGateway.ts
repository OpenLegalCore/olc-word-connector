/* global AbortSignal */

import type { DocumentProposal } from "./DocumentProposal";

export type LegalSourceContext =
  { readonly type: "none" } | { readonly type: "selected_text"; readonly quotedText: string };

export interface CompletionRequest {
  readonly question: string;
  readonly context: LegalSourceContext;
  readonly uiLocale: "sl-SI" | "en-US";
}

export interface CompletionUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface CompletionResult {
  readonly text: string;
  readonly sources?: readonly CompletionSource[];
  /** Exact response retained in memory for this result only; never logged/persisted. */
  readonly rawResponse?: string;
  readonly proposal?: DocumentProposal | null;
  readonly model?: string;
  readonly usage?: CompletionUsage | null;
}

export interface CompletionSource {
  readonly label: string;
  readonly title: string;
  readonly locator: string;
  readonly url: string;
}

export interface CompletionObserver {
  readonly onTextDelta?: (delta: string) => void;
}

export interface ChatGateway {
  checkConnection(signal?: AbortSignal): Promise<void>;
  complete(
    request: CompletionRequest,
    signal?: AbortSignal,
    observer?: CompletionObserver
  ): Promise<CompletionResult>;
}
