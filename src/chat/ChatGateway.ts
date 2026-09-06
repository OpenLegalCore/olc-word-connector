/* global AbortSignal */

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
  readonly model?: string;
  readonly usage?: CompletionUsage;
}

export interface ChatGateway {
  checkConnection(signal?: AbortSignal): Promise<void>;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}
