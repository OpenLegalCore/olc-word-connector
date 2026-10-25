/* global AbortSignal, ReadableStreamDefaultReader */

import type { CompletionObserver, CompletionUsage } from "./ChatGateway";
import { ChatGatewayError } from "./ChatGatewayError";
import { consumeSseEventStream } from "./sseEventStream";

export interface OpenAICompatibleStreamResult {
  readonly text: string;
  readonly usage: CompletionUsage | null;
}

interface ParserState {
  readonly textParts: string[];
  textLength: number;
  sawStop: boolean;
  sawDone: boolean;
  usage: CompletionUsage | null;
}

function invalidResponse(
  reason: import("./diagnostics").DiagnosticReason = "SSE_SCHEMA"
): ChatGatewayError {
  return new ChatGatewayError("INVALID_RESPONSE", reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tokenCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw invalidResponse("SSE_USAGE");
  }
  return value as number;
}

function parseUsage(value: unknown): CompletionUsage | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw invalidResponse("SSE_USAGE");
  }
  return {
    inputTokens: tokenCount(value.prompt_tokens),
    outputTokens: tokenCount(value.completion_tokens),
    totalTokens: tokenCount(value.total_tokens),
  };
}

function sameUsage(left: CompletionUsage | null, right: CompletionUsage | null): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.inputTokens === right.inputTokens &&
      left.outputTokens === right.outputTokens &&
      left.totalTokens === right.totalTokens)
  );
}

function consumeJsonEvent(
  state: ParserState,
  value: unknown,
  expectedModelId: string,
  maxResponseChars: number,
  observer?: CompletionObserver
): void {
  if (isRecord(value) && "error" in value) {
    throw new ChatGatewayError(
      "INVALID_RESPONSE",
      "SSE_ERROR_EVENT",
      isRecord(value.error) ? value.error.code : undefined
    );
  }
  if (!isRecord(value)) {
    throw invalidResponse();
  }
  if (value.model !== undefined && value.model !== expectedModelId) {
    throw invalidResponse("SSE_MODEL");
  }

  if (value.usage !== undefined) {
    const usage = parseUsage(value.usage);
    if (state.usage !== null && !sameUsage(state.usage, usage)) {
      throw invalidResponse("SSE_USAGE");
    }
    state.usage = usage;
  }

  if (!Array.isArray(value.choices)) {
    throw invalidResponse();
  }
  for (const choice of value.choices) {
    if (!isRecord(choice)) {
      throw invalidResponse();
    }
    const finishReason = choice.finish_reason;
    if (finishReason !== undefined && finishReason !== null && finishReason !== "stop") {
      throw invalidResponse("SSE_FINISH_REASON");
    }

    const delta = choice.delta;
    if (delta !== undefined && delta !== null) {
      if (!isRecord(delta)) {
        throw invalidResponse();
      }
      if (delta.role !== undefined && delta.role !== "assistant") {
        throw invalidResponse();
      }
      const content = delta.content;
      if (content !== undefined && content !== null) {
        if (typeof content !== "string" || content.includes("\u0000") || state.sawStop) {
          throw invalidResponse();
        }
        if (content.length > 0) {
          state.textLength += content.length;
          if (state.textLength > maxResponseChars) {
            throw invalidResponse();
          }
          state.textParts.push(content);
          observer?.onTextDelta?.(content);
        }
      }
    }
    if (finishReason === "stop") {
      state.sawStop = true;
    }
  }
}

export async function parseOpenAICompatibleCompletionStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expectedModelId: string,
  signal?: AbortSignal,
  observer?: CompletionObserver,
  maxResponseChars = 50_000,
  maxBytes = 1024 * 1024
): Promise<OpenAICompatibleStreamResult> {
  if (!Number.isSafeInteger(maxResponseChars) || maxResponseChars <= 0) {
    throw invalidResponse();
  }

  const state: ParserState = {
    textParts: [],
    textLength: 0,
    sawStop: false,
    sawDone: false,
    usage: null,
  };
  await consumeSseEventStream(
    reader,
    {
      onData(data) {
        if (data.trim() === "[DONE]") {
          if (!state.sawStop) {
            throw invalidResponse("SSE_DONE_WITHOUT_STOP");
          }
          state.sawDone = true;
          return;
        }
        let value: unknown;
        try {
          value = JSON.parse(data) as unknown;
        } catch {
          throw invalidResponse("SSE_JSON");
        }
        consumeJsonEvent(state, value, expectedModelId, maxResponseChars, observer);
      },
      isComplete: () => state.sawDone,
    },
    signal,
    maxBytes
  );

  const text = state.textParts.join("");
  if (text.trim().length === 0) {
    throw new ChatGatewayError("EMPTY_RESPONSE", "SSE_EMPTY");
  }
  return { text, usage: state.usage };
}
