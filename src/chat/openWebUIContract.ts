/* global AbortSignal, ReadableStreamDefaultReader, ReadableStreamReadResult, TextDecoder */

import { ChatGatewayError } from "./ChatGatewayError";

export const DEFAULT_OPENWEBUI_SSE_MAX_BYTES = 1024 * 1024;
export const DEFAULT_OPENWEBUI_RESPONSE_MAX_CHARS = 50_000;

export interface OpenWebUIStreamResult {
  readonly text: string;
}

interface ParserState {
  pendingText: string;
  lineScanOffset: number;
  initialContentPending: boolean;
  dataLines: string[];
  textParts: string[];
  textLength: number;
  sawBytes: boolean;
  completed: boolean;
}

function invalidResponse(): ChatGatewayError {
  return new ChatGatewayError("INVALID_RESPONSE");
}

function emptyResponse(): ChatGatewayError {
  return new ChatGatewayError("EMPTY_RESPONSE");
}

function cancelled(): ChatGatewayError {
  return new ChatGatewayError("CANCELLED");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function appendContentFromEvent(
  state: ParserState,
  value: unknown,
  maxResponseChars: number
): void {
  if (!isRecord(value)) {
    throw invalidResponse();
  }

  if ("error" in value) {
    throw invalidResponse();
  }

  const choices = value.choices;
  if (choices === undefined) {
    return;
  }
  if (!Array.isArray(choices)) {
    throw invalidResponse();
  }

  for (const choice of choices) {
    if (!isRecord(choice)) {
      throw invalidResponse();
    }

    const delta = choice.delta;
    if (delta === undefined || delta === null) {
      continue;
    }
    if (!isRecord(delta)) {
      throw invalidResponse();
    }

    const content = delta.content;
    if (content === undefined || content === null) {
      continue;
    }
    if (typeof content !== "string") {
      throw invalidResponse();
    }
    if (content.includes("\u0000")) {
      throw invalidResponse();
    }

    state.textLength += content.length;
    if (state.textLength > maxResponseChars) {
      throw invalidResponse();
    }
    state.textParts.push(content);
  }
}

function dispatchEvent(state: ParserState, maxResponseChars: number): void {
  if (state.dataLines.length === 0) {
    return;
  }

  const data = state.dataLines.join("\n");
  state.dataLines = [];

  if (data.trim() === "[DONE]") {
    state.completed = true;
    return;
  }

  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalidResponse();
  }

  appendContentFromEvent(state, value, maxResponseChars);
}

function consumeLine(state: ParserState, rawLine: string, maxResponseChars: number): void {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

  if (line === "") {
    dispatchEvent(state, maxResponseChars);
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
  state: ParserState,
  decoded: string,
  completeTrailingCr: boolean,
  maxResponseChars: number
): void {
  if (state.completed) {
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
  let lineBreak = findLineBreak(state.pendingText, completeTrailingCr, state.lineScanOffset);
  while (lineBreak) {
    const line = state.pendingText.slice(0, lineBreak.index);
    state.pendingText = state.pendingText.slice(lineBreak.index + lineBreak.width);
    state.lineScanOffset = 0;
    consumeLine(state, line, maxResponseChars);
    if (state.completed) {
      return;
    }
    lineBreak = findLineBreak(state.pendingText, completeTrailingCr, state.lineScanOffset);
  }
  state.lineScanOffset =
    !completeTrailingCr && state.pendingText.endsWith("\r")
      ? state.pendingText.length - 1
      : state.pendingText.length;
}

interface LineBreak {
  readonly index: number;
  readonly width: number;
}

function findLineBreak(
  value: string,
  completeTrailingCr: boolean,
  startIndex: number
): LineBreak | undefined {
  for (let index = startIndex; index < value.length; index++) {
    if (value[index] === "\n") {
      return { index, width: 1 };
    }
    if (value[index] !== "\r") {
      continue;
    }
    if (index + 1 < value.length) {
      return { index, width: value[index + 1] === "\n" ? 2 : 1 };
    }
    if (completeTrailingCr) {
      return { index, width: 1 };
    }
  }
  return undefined;
}

function validatePositiveLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidResponse();
  }
}

function consumeEncodedChunk(
  state: ParserState,
  decoder: TextDecoder,
  chunk: Uint8Array,
  maxResponseChars: number,
  bytesRead: number,
  maxBytes: number
): number {
  let segmentStart = 0;
  let consumedBytes = 0;

  if (state.pendingText.endsWith("\r") && chunk.byteLength > 0 && chunk[0] !== 0x0a) {
    consumeDecodedText(state, "", true, maxResponseChars);
    if (state.completed) {
      return consumedBytes;
    }
  }

  for (let index = 0; index < chunk.byteLength; index++) {
    let segmentEnd: number;
    let completeTrailingCr = false;
    if (chunk[index] === 0x0a) {
      segmentEnd = index + 1;
    } else if (chunk[index] === 0x0d && index + 1 < chunk.byteLength) {
      if (chunk[index + 1] === 0x0a) {
        segmentEnd = index + 2;
        index++;
      } else {
        segmentEnd = index + 1;
        completeTrailingCr = true;
      }
    } else {
      continue;
    }

    consumedBytes += segmentEnd - segmentStart;
    if (bytesRead + consumedBytes > maxBytes) {
      throw invalidResponse();
    }
    consumeDecodedText(
      state,
      decoder.decode(chunk.subarray(segmentStart, segmentEnd), { stream: true }),
      completeTrailingCr,
      maxResponseChars
    );
    if (state.completed) {
      return consumedBytes;
    }
    segmentStart = segmentEnd;
  }

  if (segmentStart < chunk.byteLength) {
    consumedBytes += chunk.byteLength - segmentStart;
    if (bytesRead + consumedBytes > maxBytes) {
      throw invalidResponse();
    }
    consumeDecodedText(
      state,
      decoder.decode(chunk.subarray(segmentStart), { stream: true }),
      false,
      maxResponseChars
    );
  }

  return consumedBytes;
}

export async function parseOpenWebUICompletionStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
  maxResponseChars = DEFAULT_OPENWEBUI_RESPONSE_MAX_CHARS,
  maxBytes = DEFAULT_OPENWEBUI_SSE_MAX_BYTES
): Promise<OpenWebUIStreamResult> {
  validatePositiveLimit(maxResponseChars);
  validatePositiveLimit(maxBytes);

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
      // Reader cleanup must not replace the parser result or its controlled error.
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
      // Reader cleanup must not replace the parser result or its controlled error.
      releaseReader();
    }
  };

  if (signal?.aborted) {
    cancelReader();
    throw cancelled();
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const state: ParserState = {
    pendingText: "",
    lineScanOffset: 0,
    initialContentPending: true,
    dataLines: [],
    textParts: [],
    textLength: 0,
    sawBytes: false,
    completed: false,
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
    while (!state.completed) {
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
        throw new ChatGatewayError("NETWORK_ERROR");
      }

      if (aborted) {
        throw cancelled();
      }

      if (readResult.done) {
        consumeDecodedText(state, decoder.decode(), true, maxResponseChars);
        break;
      }

      const chunk = readResult.value;
      state.sawBytes ||= chunk.byteLength > 0;
      bytesRead += consumeEncodedChunk(
        state,
        decoder,
        chunk,
        maxResponseChars,
        bytesRead,
        maxBytes
      );
    }

    if (!state.completed) {
      throw state.sawBytes ? invalidResponse() : emptyResponse();
    }

    cancelReader();
    const text = state.textParts.join("");
    if (text.trim().length === 0) {
      throw emptyResponse();
    }

    return { text };
  } catch (error) {
    cancelReader();
    if (error instanceof ChatGatewayError) {
      throw error;
    }
    if (aborted || signal?.aborted) {
      throw cancelled();
    }
    throw invalidResponse();
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
