import { describe, expect, it, vi } from "vitest";

import { ChatGatewayError, type ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";
import {
  parseOpenWebUICompletionStream,
  type OpenWebUIStreamResult,
} from "../../src/chat/openWebUIContract";

const encoder = new TextEncoder();

function readerFromBytes(chunks: readonly Uint8Array[]): ReadableStreamDefaultReader<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  }).getReader();
}

function readerFromText(...chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  return readerFromBytes(chunks.map((chunk) => encoder.encode(chunk)));
}

async function expectGatewayError(
  completion: Promise<OpenWebUIStreamResult>,
  code: ChatGatewayErrorCode
): Promise<void> {
  try {
    await completion;
    throw new Error("Expected a ChatGatewayError");
  } catch (error) {
    expect(error).toBeInstanceOf(ChatGatewayError);
    expect((error as ChatGatewayError).code).toBe(code);
  }
}

describe("Open WebUI SSE contract", () => {
  it("assembles only delta content across arbitrary LF/CRLF and UTF-8 chunk boundaries", async () => {
    const eventStream = [
      ": keepalive\r\n\r\n",
      'data: {"content":"ignored","choices":[{"delta":{"role":"assistant"}}]}\r\n\r\n',
      'data: {"choices":[{"delta":{"content":"Živ"}},{"delta":{"content":"jo "}}]}\n\n',
      'data: {"choices":[{"message":{"content":"ignored"},"delta":{"content":"🌍"}}]}\r\n\r\n',
      "data: [DONE]\n\n",
    ].join("");
    const bytes = encoder.encode(eventStream);
    const oneByteChunks = Array.from(bytes, (byte) => Uint8Array.of(byte));

    await expect(parseOpenWebUICompletionStream(readerFromBytes(oneByteChunks))).resolves.toEqual({
      text: "Živjo 🌍",
    });
  });

  it("supports a JSON event split across multiple SSE data lines", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":\n',
      'data: {"content":"Večvrstično"}}]}\n\n',
      "data: [DONE]\n\n"
    );

    await expect(parseOpenWebUICompletionStream(reader)).resolves.toEqual({
      text: "Večvrstično",
    });
  });

  it("handles a long content line split across one-byte reader chunks", async () => {
    const content = "x".repeat(8_192);
    const encoded = encoder.encode(
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`
    );
    const chunks = Array.from(encoded, (byte) => Uint8Array.of(byte));

    await expect(parseOpenWebUICompletionStream(readerFromBytes(chunks))).resolves.toEqual({
      text: content,
    });
  });

  it("supports bare CR line and event boundaries", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":{"content":"CR"}}]}\r\rdata: [DONE]\r\r'
    );

    await expect(parseOpenWebUICompletionStream(reader)).resolves.toEqual({ text: "CR" });
  });

  it("stops at DONE, cancels the reader, and ignores malformed late events", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":{"content":"Complete"}}]}\n\n',
      "data: [DONE]\n\ndata: {malformed-in-the-same-chunk}\n\n",
      "data: {malformed}\n\n"
    );
    const cancel = vi.spyOn(reader, "cancel");
    const releaseLock = vi.spyOn(reader, "releaseLock");

    await expect(parseOpenWebUICompletionStream(reader)).resolves.toEqual({ text: "Complete" });
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("does not decode or count invalid bytes after DONE in the same reader chunk", async () => {
    const completed = encoder.encode(
      'data: {"choices":[{"delta":{"content":"Complete"}}]}\n\ndata: [DONE]\n\n'
    );
    const chunk = new Uint8Array(completed.byteLength + 64);
    chunk.set(completed);
    chunk.fill(0xff, completed.byteLength);

    await expect(
      parseOpenWebUICompletionStream(readerFromBytes([chunk]), undefined, 50_000, completed.length)
    ).resolves.toEqual({ text: "Complete" });
  });

  it("stops at a bare-CR DONE boundary before invalid bytes in the same chunk", async () => {
    const completed = encoder.encode(
      'data: {"choices":[{"delta":{"content":"Complete"}}]}\r\rdata: [DONE]\r\r'
    );
    const chunk = new Uint8Array(completed.byteLength + 64);
    chunk.set(completed);
    chunk.fill(0xff, completed.byteLength);

    await expect(
      parseOpenWebUICompletionStream(readerFromBytes([chunk]), undefined, 50_000, completed.length)
    ).resolves.toEqual({ text: "Complete" });
  });

  it("ignores non-content deltas and never falls back to message, text, or reasoning fields", async () => {
    const reader = readerFromText(
      "data: " +
        JSON.stringify({
          content: "top-level",
          choices: [
            {
              text: "legacy",
              message: { content: "message" },
              delta: { reasoning_content: "reasoning" },
            },
          ],
        }) +
        "\n\n",
      "data: [DONE]\n\n"
    );

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "EMPTY_RESPONSE");
  });

  it("rejects malformed JSON data events", async () => {
    const reader = readerFromText("data: {not-json}\n\ndata: [DONE]\n\n");

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it("rejects a detectable HTML response before interpreting SSE fields", async () => {
    const reader = readerFromText("  \n", "<html><body>Sign in</body></html>");

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it("distinguishes an empty stream from an incomplete stream", async () => {
    await expectGatewayError(parseOpenWebUICompletionStream(readerFromBytes([])), "EMPTY_RESPONSE");

    const incomplete = readerFromText('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n');
    await expectGatewayError(parseOpenWebUICompletionStream(incomplete), "INVALID_RESPONSE");
  });

  it.each([
    "data: [DONE]\n\n",
    'data: {"choices":[{"delta":{"content":"   "}}]}\n\ndata: [DONE]\n\n',
  ])("rejects a completed stream without non-whitespace assistant content", async (body) => {
    await expectGatewayError(
      parseOpenWebUICompletionStream(readerFromText(body)),
      "EMPTY_RESPONSE"
    );
  });

  it("requires DONE to be terminated by an SSE blank line", async () => {
    const complete = readerFromText(
      'data: {"choices":[{"delta":{"content":"Complete"}}]}\n\n',
      "data: [DONE]\n\n"
    );
    await expect(parseOpenWebUICompletionStream(complete)).resolves.toEqual({ text: "Complete" });

    const incomplete = readerFromText(
      'data: {"choices":[{"delta":{"content":"Incomplete"}}]}\n\n',
      "data: [DONE]"
    );
    await expectGatewayError(parseOpenWebUICompletionStream(incomplete), "INVALID_RESPONSE");
  });

  it("rejects non-string delta content", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":{"content":["not","text"]}}]}\n\n',
      "data: [DONE]\n\n"
    );

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it("rejects NUL in assistant content", async () => {
    const reader = readerFromText(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "before\u0000after" } }] })}\n\n`,
      "data: [DONE]\n\n"
    );

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it.each(["[]", '{"choices":null}', '{"choices":[null]}', '{"choices":[{"delta":false}]}'])(
    "rejects an incompatible event shape: %s",
    async (payload) => {
      const reader = readerFromText(`data: ${payload}\n\ndata: [DONE]\n\n`);

      await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
    }
  );

  it("accepts extension and role-only events without treating them as assistant text", async () => {
    const reader = readerFromText(
      'data: {"extension":{"content":"ignored"}}\n\n',
      'data: {"choices":[{"delta":null}]}\n\n',
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Accepted"}}]}\n\n',
      "data: [DONE]\n\n"
    );

    await expect(parseOpenWebUICompletionStream(reader)).resolves.toEqual({ text: "Accepted" });
  });

  it("rejects a structured SSE error without exposing its detail", async () => {
    const reader = readerFromText(
      'data: {"error":{"message":"private fixture detail"}}\n\n',
      "data: [DONE]\n\n"
    );

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it("classifies a stream read failure as a network error", async () => {
    const reader = {
      read: async () => {
        throw new TypeError("fixture stream failure");
      },
      cancel: async () => undefined,
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "NETWORK_ERROR");
  });

  it("enforces the configured byte bound before retaining an oversized stream", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":{"content":"bounded"}}]}\n\n',
      "data: [DONE]\n\n"
    );

    await expectGatewayError(
      parseOpenWebUICompletionStream(reader, undefined, 50_000, 16),
      "INVALID_RESPONSE"
    );
  });

  it("enforces the configured assembled-response character bound", async () => {
    const reader = readerFromText(
      'data: {"choices":[{"delta":{"content":"bounded"}}]}\n\n',
      "data: [DONE]\n\n"
    );

    await expectGatewayError(
      parseOpenWebUICompletionStream(reader, undefined, 3),
      "INVALID_RESPONSE"
    );
  });

  it("rejects invalid parser limits before reading", async () => {
    const reader = readerFromText("data: [DONE]\n\n");
    const read = vi.spyOn(reader, "read");

    await expectGatewayError(
      parseOpenWebUICompletionStream(reader, undefined, 0),
      "INVALID_RESPONSE"
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("turns invalid UTF-8 into a controlled invalid response", async () => {
    const reader = readerFromBytes([Uint8Array.of(0xc3, 0x28)]);

    await expectGatewayError(parseOpenWebUICompletionStream(reader), "INVALID_RESPONSE");
  });

  it("cancels a pending reader and returns CANCELLED when its signal aborts", async () => {
    let finishRead: ((result: ReadableStreamReadResult<Uint8Array>) => void) | undefined;
    const reader = {
      read: vi.fn(
        () =>
          new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
            finishRead = resolve;
          })
      ),
      cancel: vi.fn(async () => {
        finishRead?.({ done: true, value: undefined });
      }),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    const abortController = new AbortController();

    const completion = parseOpenWebUICompletionStream(reader, abortController.signal);
    abortController.abort();

    await expectGatewayError(completion, "CANCELLED");
    expect(reader.cancel).toHaveBeenCalledTimes(1);
  });

  it("fails before reading and cancels when the supplied signal is already aborted", async () => {
    const reader = readerFromText("data: [DONE]\n\n");
    const read = vi.spyOn(reader, "read");
    const cancel = vi.spyOn(reader, "cancel");
    const abortController = new AbortController();
    abortController.abort();

    await expectGatewayError(
      parseOpenWebUICompletionStream(reader, abortController.signal),
      "CANCELLED"
    );
    expect(read).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
