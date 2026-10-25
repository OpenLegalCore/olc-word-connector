/* global AbortSignal, ReadableStreamDefaultReader, ReadableStreamReadResult, TextDecoder */

import { ChatGatewayError } from "./ChatGatewayError";

export interface SseEventConsumer {
  readonly onData: (data: string) => void;
  readonly isComplete: () => boolean;
}

interface DecoderState {
  pendingText: string;
  dataLines: string[];
  initialContentPending: boolean;
  sawBytes: boolean;
}

function invalidResponse(
  reason: import("./diagnostics").DiagnosticReason = "SSE_FRAMING"
): ChatGatewayError {
  return new ChatGatewayError("INVALID_RESPONSE", reason);
}

function cancelled(): ChatGatewayError {
  return new ChatGatewayError("CANCELLED");
}

function dispatchEvent(state: DecoderState, consumer: SseEventConsumer): void {
  if (state.dataLines.length === 0) {
    return;
  }
  const data = state.dataLines.join("\n");
  state.dataLines = [];
  consumer.onData(data);
}

function consumeLine(state: DecoderState, line: string, consumer: SseEventConsumer): void {
  if (line === "") {
    dispatchEvent(state, consumer);
    return;
  }
  if (line.startsWith(":")) {
    return;
  }

  const separator = line.indexOf(":");
  const field = separator === -1 ? line : line.slice(0, separator);
  let fieldValue = separator === -1 ? "" : line.slice(separator + 1);
  if (fieldValue.startsWith(" ")) {
    fieldValue = fieldValue.slice(1);
  }
  if (field === "data") {
    state.dataLines.push(fieldValue);
  }
}

function consumeDecodedText(
  state: DecoderState,
  decoded: string,
  completeTrailingCr: boolean,
  consumer: SseEventConsumer
): void {
  if (consumer.isComplete()) {
    return;
  }

  if (state.initialContentPending) {
    for (const character of decoded) {
      if (character.trim().length === 0) {
        continue;
      }
      state.initialContentPending = false;
      if (character === "<") {
        throw invalidResponse();
      }
      break;
    }
  }

  state.pendingText += decoded;
  let index = 0;
  while (index < state.pendingText.length && !consumer.isComplete()) {
    const character = state.pendingText[index];
    if (character !== "\n" && character !== "\r") {
      index++;
      continue;
    }
    if (character === "\r" && index + 1 === state.pendingText.length && !completeTrailingCr) {
      break;
    }

    const width = character === "\r" && state.pendingText[index + 1] === "\n" ? 2 : 1;
    const line = state.pendingText.slice(0, index);
    state.pendingText = state.pendingText.slice(index + width);
    index = 0;
    consumeLine(state, line, consumer);
  }
}

function validateLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidResponse();
  }
}

function isByteChunk(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]"
  );
}

export async function consumeSseEventStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  consumer: SseEventConsumer,
  signal: AbortSignal | undefined,
  maxBytes: number
): Promise<void> {
  validateLimit(maxBytes);

  let readerCancelled = false;
  let readerReleased = false;
  const releaseReader = (): void => {
    if (readerReleased) {
      return;
    }
    readerReleased = true;
    try {
      reader.releaseLock();
    } catch {
      // Cleanup must not replace the controlled parser result.
    }
  };
  const cancelReader = (): void => {
    if (readerCancelled) {
      return;
    }
    readerCancelled = true;
    try {
      void reader
        .cancel()
        .catch(() => undefined)
        .then(releaseReader);
    } catch {
      releaseReader();
    }
  };

  if (signal?.aborted) {
    cancelReader();
    throw cancelled();
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const state: DecoderState = {
    pendingText: "",
    dataLines: [],
    initialContentPending: true,
    sawBytes: false,
  };
  let bytesRead = 0;
  let aborted = false;
  let rejectAbort: ((reason: ChatGatewayError) => void) | undefined;
  const abortPromise = signal
    ? new Promise<never>((_resolve, reject) => {
        rejectAbort = reject;
      })
    : undefined;
  const onAbort = (): void => {
    if (aborted) {
      return;
    }
    aborted = true;
    cancelReader();
    rejectAbort?.(cancelled());
  };

  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) {
    onAbort();
  }

  try {
    while (!consumer.isComplete()) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        const readPromise = reader.read();
        readResult = abortPromise
          ? await Promise.race([readPromise, abortPromise])
          : await readPromise;
      } catch (error) {
        if (error instanceof ChatGatewayError) {
          throw error;
        }
        throw new ChatGatewayError("NETWORK_ERROR", "STREAM_READ_FAILED");
      }

      if (aborted) {
        throw cancelled();
      }
      if (readResult.done) {
        consumeDecodedText(state, decoder.decode(), true, consumer);
        break;
      }
      if (!isByteChunk(readResult.value)) {
        throw invalidResponse();
      }

      state.sawBytes ||= readResult.value.byteLength > 0;
      bytesRead += readResult.value.byteLength;
      if (bytesRead > maxBytes) {
        throw invalidResponse("SSE_LIMIT");
      }
      consumeDecodedText(
        state,
        decoder.decode(readResult.value, { stream: true }),
        false,
        consumer
      );
    }

    if (!consumer.isComplete()) {
      throw new ChatGatewayError(
        state.sawBytes ? "INVALID_RESPONSE" : "EMPTY_RESPONSE",
        state.sawBytes ? "SSE_INCOMPLETE" : "SSE_EMPTY"
      );
    }
    cancelReader();
  } catch (error) {
    cancelReader();
    if (error instanceof ChatGatewayError) {
      throw error;
    }
    if (aborted || signal?.aborted) {
      throw cancelled();
    }
    throw invalidResponse("SSE_ENCODING");
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
