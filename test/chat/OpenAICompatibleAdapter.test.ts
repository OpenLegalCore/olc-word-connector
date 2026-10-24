import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompletionRequest } from "../../src/chat/ChatGateway";
import { ChatGatewayError, type ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleAdapterConfig,
  type OpenAICompatibleFetch,
} from "../../src/chat/OpenAICompatibleAdapter";

const baseUrl = "https://engine.example.invalid";
const modelId = "configured-engine-model";
const credential = "synthetic-engine-credential";
const request: CompletionRequest = {
  question: "Which law applies?",
  context: { type: "selected_text", quotedText: "Synthetic selected text." },
  uiLocale: "en-US",
};

interface FetchCall {
  readonly input: string;
  readonly init: RequestInit | undefined;
}

interface FakeResponseOptions {
  readonly status?: number;
  readonly contentType?: string;
  readonly contentLength?: string;
  readonly redirected?: boolean;
  readonly rawBody?: string;
  readonly bodyError?: unknown;
  readonly type?: Response["type"];
  readonly body?: Response["body"];
}

function jsonResponse(payload: unknown, options: FakeResponseOptions = {}): Response {
  const status = options.status ?? 200;
  const rawBody = options.rawBody ?? JSON.stringify(payload) ?? "";
  const response = new Response(rawBody, {
    status: status === 0 ? 200 : status,
    headers: {
      "Content-Type": options.contentType ?? "application/json; charset=utf-8",
      ...(options.contentLength === undefined ? {} : { "Content-Length": options.contentLength }),
    },
  });

  if (options.bodyError !== undefined) {
    Object.defineProperty(response, "body", {
      value: new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(options.bodyError);
        },
      }),
    });
  } else if (options.body !== undefined) {
    Object.defineProperty(response, "body", { value: options.body });
  }
  Object.defineProperties(response, {
    ok: { value: status >= 200 && status < 300 },
    redirected: { value: options.redirected ?? false },
    status: { value: status },
    type: { value: options.type ?? "basic" },
  });
  return response;
}

function sequenceFetch(...responses: readonly Response[]): {
  readonly calls: FetchCall[];
  readonly fetch: OpenAICompatibleFetch;
} {
  const calls: FetchCall[] = [];
  const fetch: OpenAICompatibleFetch = async (input, init) => {
    calls.push({ input, init });
    const response = responses[calls.length - 1];
    if (!response) {
      throw new Error("Unexpected fallback or retry");
    }
    return response;
  };
  return { calls, fetch };
}

function config(overrides: Partial<OpenAICompatibleAdapterConfig> = {}) {
  return { baseUrl, modelId, ...overrides };
}

function adapter(
  fetch: OpenAICompatibleFetch,
  overrides: Partial<OpenAICompatibleAdapterConfig> = {}
): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter(config(overrides), { fetch });
}

function modelsResponse(ids: readonly string[] = [modelId]): Response {
  return jsonResponse({ object: "list", data: ids.map((id) => ({ id, object: "model" })) });
}

function completionResponse(
  content = "Completed plain text.",
  model: string | undefined = modelId
): Response {
  return sseResponse([
    `data: ${JSON.stringify({
      ...(model === undefined ? {} : { model }),
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
    })}\n\n`,
    `data: ${JSON.stringify({
      ...(model === undefined ? {} : { model }),
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    })}\n\n`,
    `data: ${JSON.stringify({
      ...(model === undefined ? {} : { model }),
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n`,
    `data: ${JSON.stringify({
      ...(model === undefined ? {} : { model }),
      choices: [],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    })}\n\n`,
    "data: [DONE]\n\n",
  ]);
}

function sseResponse(
  chunks: readonly (string | Uint8Array)[],
  options: FakeResponseOptions = {}
): Response {
  const encoded = chunks.map((chunk) =>
    typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of encoded) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return jsonResponse(undefined, {
    ...options,
    contentType: options.contentType ?? "text/event-stream; charset=utf-8",
    body: body as Response["body"],
  });
}

function headers(call: FetchCall): Record<string, string> {
  return call.init?.headers as Record<string, string>;
}

function body(call: FetchCall): Record<string, unknown> {
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

async function expectCode(promise: Promise<unknown>, code: ChatGatewayErrorCode): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "ChatGatewayError",
    message: code,
    code,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OpenAICompatibleAdapter configuration", () => {
  it.each([
    ["https://engine.example.invalid", "https://engine.example.invalid/v1/models"],
    ["https://engine.example.invalid/", "https://engine.example.invalid/v1/models"],
    ["http://localhost:8011", "http://localhost:8011/v1/models"],
    ["HTTP://LOCALHOST:8011/", "http://localhost:8011/v1/models"],
    ["http://127.0.0.1:8011", "http://127.0.0.1:8011/v1/models"],
    ["http://[::1]:8011/", "http://[::1]:8011/v1/models"],
  ])("accepts HTTPS or an exact loopback origin", async (configured, expected) => {
    const transport = sequenceFetch(modelsResponse());
    const gateway = new OpenAICompatibleAdapter(
      { baseUrl: configured, modelId },
      { fetch: transport.fetch }
    );

    await gateway.checkConnection();

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(expected);
  });

  it.each([
    "",
    "not a URL",
    " https://engine.example.invalid",
    "https://engine.example.invalid ",
    "https://engine.example.invalid/path",
    "https://engine.example.invalid/v1",
    "https://engine.example.invalid///",
    "https://engine.example.invalid?mode=test",
    "https://engine.example.invalid#fragment",
    "https://user:pass@engine.example.invalid",
    "ftp://engine.example.invalid",
    "http://engine.example.invalid",
    "http://localhost.example.invalid:8011",
    "http://localhost.:8011",
    "http://127.0.0.1.example.invalid:8011",
    "http://2130706433:8011",
    "http://0x7f000001:8011",
    "http://127.0.0.1:0",
    "https://0.0.0.0",
    "https://[::]",
    "https://*",
    "https://engine.example.invalid\n",
    ["http://", [192, 168, 1, 20].join("."), ":8011"].join(""),
    ["http://", [172, 18, 0, 1].join("."), ":8011"].join(""),
  ])("rejects an unsafe or ambiguous base URL", (configured) => {
    expect(
      () => new OpenAICompatibleAdapter({ baseUrl: configured, modelId }, { fetch: vi.fn() })
    ).toThrowError(new ChatGatewayError("INVALID_CONFIGURATION"));
  });

  it.each([
    { modelId: "" },
    { modelId: " configured-model" },
    { modelId: "configured-model\n" },
    { credential: "" },
    { credential: " credential" },
    { credential: "credential\u0000" },
    { requestTimeoutMs: 0 },
    { requestTimeoutMs: 1.5 },
    { maxResponseBytes: 0 },
    { maxResponseBytes: Number.MAX_SAFE_INTEGER + 1 },
    { maxResponseChars: 0 },
    { maxResponseChars: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid bounded configuration %#", (overrides) => {
    expect(() => new OpenAICompatibleAdapter(config(overrides), { fetch: vi.fn() })).toThrowError(
      new ChatGatewayError("INVALID_CONFIGURATION")
    );
  });

  it("keeps same-origin mode free of direct URL and credential configuration", () => {
    const fetch = vi.fn<OpenAICompatibleFetch>();

    expect(
      () => new OpenAICompatibleAdapter({ transport: "same-origin", baseUrl, modelId }, { fetch })
    ).toThrowError(new ChatGatewayError("INVALID_CONFIGURATION"));
    expect(
      () =>
        new OpenAICompatibleAdapter({ transport: "same-origin", modelId, credential }, { fetch })
    ).toThrowError(new ChatGatewayError("INVALID_CONFIGURATION"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when the browser fetch capability is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    const gateway = new OpenAICompatibleAdapter(config());

    await expectCode(gateway.checkConnection(), "INVALID_CONFIGURATION");
  });
});

describe("OpenAICompatibleAdapter model preflight", () => {
  it("uses only same-origin gateway paths, cookies and no browser authorization headers", async () => {
    const transport = sequenceFetch(modelsResponse(), completionResponse("Same-origin result"));
    const gateway = new OpenAICompatibleAdapter(
      { transport: "same-origin", modelId },
      { fetch: transport.fetch }
    );

    await gateway.checkConnection();
    await expect(gateway.complete(request)).resolves.toEqual({
      text: "Same-origin result",
      model: modelId,
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
    });

    expect(transport.calls.map((call) => call.input)).toEqual([
      "/v1/models",
      "/v1/chat/completions",
    ]);
    for (const call of transport.calls) {
      expect(call.init?.credentials).toBe("same-origin");
      expect(call.init?.redirect).toBe("manual");
      expect(headers(call)).not.toHaveProperty("Authorization");
      expect(headers(call)).not.toHaveProperty("CF-Access-Client-ID");
      expect(headers(call)).not.toHaveProperty("CF-Access-Client-Secret");
    }
  });

  it.each([
    { contentType: "application/json", redirected: true },
    { status: 302 },
    { status: 0, type: "opaqueredirect" as const },
    { status: 401 },
  ])(
    "classifies same-origin Access HTML, opaque/manual redirect as unaccepted session %#",
    async (options) => {
      const transport = sequenceFetch(jsonResponse({ private: "not exposed" }, options));
      const gateway = new OpenAICompatibleAdapter(
        { transport: "same-origin", modelId },
        { fetch: transport.fetch }
      );

      await expectCode(gateway.complete(request), "SESSION_EXPIRED");
      expect(transport.calls).toHaveLength(1);
    }
  );

  it.each(["application/json", "text/plain", "text/html"])(
    "keeps same-origin %s 403 distinct from session expiry",
    async (contentType) => {
      const transport = sequenceFetch(jsonResponse({}, { status: 403, contentType }));
      const gateway = new OpenAICompatibleAdapter(
        { transport: "same-origin", modelId },
        { fetch: transport.fetch }
      );
      await expectCode(gateway.complete(request), "ACCESS_DENIED");
      expect(transport.calls).toHaveLength(1);
    }
  );

  it.each([
    [503, "SERVICE_UNAVAILABLE"],
    [408, "TIMEOUT"],
    [429, "RATE_LIMITED"],
    [200, "INVALID_RESPONSE"],
  ] as const)(
    "does not mislabel an HTML %s response as an expired session",
    async (status, code) => {
      const transport = sequenceFetch(jsonResponse({}, { status, contentType: "text/html" }));
      const gateway = new OpenAICompatibleAdapter(
        { transport: "same-origin", modelId },
        { fetch: transport.fetch }
      );
      await expectCode(gateway.checkConnection(), code);
      expect(transport.calls).toHaveLength(1);
    }
  );

  it("safely cancels an available same-origin Access response body", async () => {
    const cancel = vi.fn(async () => undefined);
    const transport = sequenceFetch(
      jsonResponse(
        { private: "not exposed" },
        { status: 302, body: { cancel } as unknown as Response["body"] }
      )
    );
    const gateway = new OpenAICompatibleAdapter(
      { transport: "same-origin", modelId },
      { fetch: transport.fetch }
    );

    await expectCode(gateway.complete(request), "SESSION_EXPIRED");

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(transport.calls).toHaveLength(1);
  });

  it("keeps a rejected same-origin fetch as NETWORK_ERROR without another request", async () => {
    const calls: FetchCall[] = [];
    const fetch: OpenAICompatibleFetch = async (input, init) => {
      calls.push({ input, init });
      throw new TypeError("fixture network failure");
    };
    const gateway = new OpenAICompatibleAdapter({ transport: "same-origin", modelId }, { fetch });

    await expectCode(gateway.complete(request), "NETWORK_ERROR");

    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("/v1/chat/completions");
  });

  it("uses the exact models endpoint, configured model and no Authorization by default", async () => {
    const transport = sequenceFetch(modelsResponse(["other-model", modelId]));
    const gateway = adapter(transport.fetch);
    const caller = new AbortController();

    await gateway.checkConnection(caller.signal);

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(`${baseUrl}/v1/models`);
    expect(transport.calls[0].init).toMatchObject({
      method: "GET",
      credentials: "omit",
      redirect: "error",
    });
    expect(transport.calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(headers(transport.calls[0])).toEqual({ Accept: "application/json" });
  });

  it("adds the optional memory-only Bearer credential when configured", async () => {
    const transport = sequenceFetch(modelsResponse());
    const gateway = adapter(transport.fetch, { credential });

    await gateway.checkConnection();

    expect(headers(transport.calls[0])).toEqual({
      Accept: "application/json",
      Authorization: `Bearer ${credential}`,
    });
  });

  it("fails closed when the exact configured model is absent without another request", async () => {
    const transport = sequenceFetch(modelsResponse(["different-model"]));

    await expectCode(adapter(transport.fetch).checkConnection(), "MODEL_NOT_AVAILABLE");
    expect(transport.calls).toHaveLength(1);
  });

  it.each([
    null,
    {},
    { object: "list" },
    { object: "not-a-list", data: [] },
    { object: "list", data: {} },
    { object: "list", data: [null] },
    { object: "list", data: [{}] },
    { object: "list", data: [{ id: "" }] },
  ])("rejects malformed model inventory %#", async (payload) => {
    const transport = sequenceFetch(jsonResponse(payload));

    await expectCode(adapter(transport.fetch).checkConnection(), "INVALID_RESPONSE");
    expect(transport.calls).toHaveLength(1);
  });

  it.each([
    [401, "AUTH_REQUIRED"],
    [403, "ACCESS_DENIED"],
    [404, "MODEL_NOT_AVAILABLE"],
    [408, "TIMEOUT"],
    [429, "RATE_LIMITED"],
    [500, "SERVICE_UNAVAILABLE"],
    [503, "SERVICE_UNAVAILABLE"],
    [400, "INVALID_RESPONSE"],
    [201, "INVALID_RESPONSE"],
  ] as const)("maps HTTP %i to controlled %s", async (status, code) => {
    const transport = sequenceFetch(jsonResponse({ private: "not exposed" }, { status }));

    await expectCode(adapter(transport.fetch).checkConnection(), code);
    expect(transport.calls).toHaveLength(1);
  });

  it.each([
    { contentType: "text/html" },
    { contentType: "text/event-stream" },
    { contentType: "application/json", redirected: true },
  ])("rejects redirect, HTML or streaming substitution %#", async (options) => {
    const transport = sequenceFetch(jsonResponse({ object: "list", data: [] }, options));

    await expectCode(adapter(transport.fetch).checkConnection(), "INVALID_RESPONSE");
  });

  it("separates malformed JSON from a response-body transport failure", async () => {
    const malformed = sequenceFetch(jsonResponse(undefined, { rawBody: "{" }));
    await expectCode(adapter(malformed.fetch).checkConnection(), "INVALID_RESPONSE");

    const failedBody = sequenceFetch(
      jsonResponse(undefined, { bodyError: new TypeError("private body read failure") })
    );
    await expectCode(adapter(failedBody.fetch).checkConnection(), "NETWORK_ERROR");
  });

  it("rejects invalid, declared-oversized, streamed-oversized and invalid UTF-8 JSON", async () => {
    for (const contentLength of ["-1", "01", "1.5", String(Number.MAX_SAFE_INTEGER + 1)]) {
      const invalidLength = sequenceFetch(
        jsonResponse({ object: "list", data: [{ id: modelId }] }, { contentLength })
      );
      await expectCode(
        adapter(invalidLength.fetch, { maxResponseBytes: 64 }).checkConnection(),
        "INVALID_RESPONSE"
      );
    }

    const declared = sequenceFetch(
      jsonResponse({ object: "list", data: [{ id: modelId }] }, { contentLength: "65" })
    );
    await expectCode(
      adapter(declared.fetch, { maxResponseBytes: 64 }).checkConnection(),
      "INVALID_RESPONSE"
    );

    const streamed = sequenceFetch(
      jsonResponse({ object: "list", data: [{ id: modelId }], padding: "x".repeat(80) })
    );
    await expectCode(
      adapter(streamed.fetch, { maxResponseBytes: 64 }).checkConnection(),
      "INVALID_RESPONSE"
    );

    const invalidUtf8 = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0xff));
        controller.close();
      },
    });
    const invalidEncoding = sequenceFetch(
      jsonResponse({}, { body: invalidUtf8 as Response["body"] })
    );
    await expectCode(
      adapter(invalidEncoding.fetch, { maxResponseBytes: 64 }).checkConnection(),
      "INVALID_RESPONSE"
    );
  });

  it("accepts a valid JSON body exactly at the configured byte limit", async () => {
    const payload = { object: "list", data: [{ id: modelId }] };
    const encodedLength = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    const transport = sequenceFetch(jsonResponse(payload));

    await expect(
      adapter(transport.fetch, { maxResponseBytes: encodedLength }).checkConnection()
    ).resolves.toBeUndefined();
  });
});

describe("OpenAICompatibleAdapter completion", () => {
  it("sends the exact Engine streaming request and returns normalized text and usage", async () => {
    const transport = sequenceFetch(completionResponse());
    const gateway = adapter(transport.fetch);
    const deltas: string[] = [];

    const result = await gateway.complete(request, undefined, {
      onTextDelta: (delta) => deltas.push(delta),
    });

    expect(result).toEqual({
      text: "Completed plain text.",
      model: modelId,
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
    });
    expect(deltas).toEqual(["Completed plain text."]);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(`${baseUrl}/v1/chat/completions`);
    expect(transport.calls[0].init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
    });
    expect(headers(transport.calls[0])).toEqual({
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    });

    const payload = body(transport.calls[0]);
    expect(payload).toEqual({
      model: modelId,
      stream: true,
      stream_options: { include_usage: true },
      response_language: "en",
      messages: [
        {
          role: "user",
          content: expect.any(String),
        },
      ],
    });
    expect(payload).not.toHaveProperty("tools");
    expect(payload).not.toHaveProperty("tool_choice");
    expect(payload).not.toHaveProperty("audio");
    expect(payload).not.toHaveProperty("images");
    expect(payload).not.toHaveProperty("files");

    const messages = payload.messages as Array<{ role: unknown; content: unknown }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(typeof messages[0].content).toBe("string");
    expect(JSON.parse(messages[0].content as string)).toMatchObject({
      schema: "olc.word.legal_source_search.v1",
      question: request.question,
      context: {
        type: "quoted_selection",
        quoted_text: request.context.type === "selected_text" ? request.context.quotedText : "",
      },
    });
  });

  it("freezes Slovenian response_language from the submitted UI locale", async () => {
    const transport = sequenceFetch(completionResponse());
    const gateway = adapter(transport.fetch);

    await gateway.complete({ ...request, uiLocale: "sl-SI" });

    expect(body(transport.calls[0])).toMatchObject({ response_language: "sl" });
  });

  it("adds Bearer only when configured and clears it on disconnect", async () => {
    const transport = sequenceFetch(completionResponse(), completionResponse());
    const gateway = adapter(transport.fetch, { credential });

    await gateway.complete(request);
    gateway.disconnect();
    await gateway.complete(request);

    expect(headers(transport.calls[0]).Authorization).toBe(`Bearer ${credential}`);
    expect(headers(transport.calls[1])).not.toHaveProperty("Authorization");
  });

  it("uses the exact configured model when valid chunks omit model metadata", async () => {
    const transport = sequenceFetch(completionResponse("Text only.", undefined));

    await expect(adapter(transport.fetch).complete(request)).resolves.toEqual({
      text: "Text only.",
      model: modelId,
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
    });
  });

  it("treats HTML-looking model output as untrusted plain text without DOM mutation", async () => {
    document.body.innerHTML = "<main>unchanged</main>";
    const transport = sequenceFetch(completionResponse("<strong>plain text</strong>"));

    const result = await adapter(transport.fetch).complete(request);

    expect(result.text).toBe("<strong>plain text</strong>");
    expect(document.body.innerHTML).toBe("<main>unchanged</main>");
  });

  it("handles split UTF-8 and SSE frames while forwarding deltas in order", async () => {
    const encoder = new TextEncoder();
    const payload =
      `data: ${JSON.stringify({ model: modelId, choices: [{ delta: { content: "Živjo 🌍" }, finish_reason: null }] })}\r\n\r\n` +
      `data: ${JSON.stringify({ model: modelId, choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [], usage: null })}\n\n` +
      "data: [DONE]\n\n";
    const bytes = encoder.encode(payload);
    const globe = encoder.encode("🌍");
    const globeOffset = bytes.findIndex((_byte, index) =>
      globe.every((byte, part) => bytes[index + part] === byte)
    );
    const transport = sequenceFetch(
      sseResponse([
        bytes.slice(0, globeOffset + 1),
        bytes.slice(globeOffset + 1, globeOffset + 3),
        bytes.slice(globeOffset + 3),
      ])
    );
    const deltas: string[] = [];

    await expect(
      adapter(transport.fetch).complete(request, undefined, {
        onTextDelta: (delta) => deltas.push(delta),
      })
    ).resolves.toEqual({ text: "Živjo 🌍", model: modelId, usage: null });
    expect(deltas).toEqual(["Živjo 🌍"]);
  });

  it.each([
    [
      "DONE without stop",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\ndata: [DONE]\n\n',
    ],
    [
      "stop without DONE",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    ],
    [
      "length terminal",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
    ],
    ["structured error", 'data: {"error":{"message":"private detail"}}\n\ndata: [DONE]\n\n'],
    [
      "error after stop",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n' +
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
        'data: {"error":{"message":"private detail"}}\n\n' +
        "data: [DONE]\n\n",
    ],
    [
      "content after stop",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n' +
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"late"},"finish_reason":null}]}\n\n' +
        "data: [DONE]\n\n",
    ],
    [
      "incomplete usage",
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n' +
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
        'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2}}\n\n' +
        "data: [DONE]\n\n",
    ],
    ["malformed JSON", "data: {not-json}\n\ndata: [DONE]\n\n"],
    [
      "wrong model",
      `data: ${JSON.stringify({ model: "other-model", choices: [{ delta: { content: "partial" }, finish_reason: null }] })}\n\n`,
    ],
  ])("rejects an invalid Engine terminal: %s", async (_name, stream) => {
    const transport = sequenceFetch(sseResponse([stream]));

    await expectCode(adapter(transport.fetch).complete(request), "INVALID_RESPONSE");
    expect(transport.calls).toHaveLength(1);
  });

  it("forwards partial text but never promotes an invalid terminal to success", async () => {
    const transport = sequenceFetch(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Visible partial"},"finish_reason":null}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );
    const deltas: string[] = [];

    await expectCode(
      adapter(transport.fetch).complete(request, undefined, {
        onTextDelta: (delta) => deltas.push(delta),
      }),
      "INVALID_RESPONSE"
    );
    expect(deltas).toEqual(["Visible partial"]);
  });

  it.each(["", "   ", "\n\t"])("rejects empty assistant text %#", async (content) => {
    const transport = sequenceFetch(completionResponse(content));

    await expectCode(adapter(transport.fetch).complete(request), "EMPTY_RESPONSE");
  });

  it("rejects NUL and over-limit assistant text", async () => {
    const nul = sequenceFetch(completionResponse("unsafe\u0000text"));
    await expectCode(adapter(nul.fetch).complete(request), "INVALID_RESPONSE");

    const long = sequenceFetch(completionResponse("12345"));
    await expectCode(
      adapter(long.fetch, { maxResponseChars: 4 }).complete(request),
      "INVALID_RESPONSE"
    );
  });

  it("bounds encoded SSE bytes and rejects invalid UTF-8", async () => {
    const oversized = sequenceFetch(sseResponse(["x".repeat(65)]));
    await expectCode(
      adapter(oversized.fetch, { maxResponseBytes: 64 }).complete(request),
      "INVALID_RESPONSE"
    );

    const invalidEncoding = sequenceFetch(sseResponse([new Uint8Array([0xff])]));
    await expectCode(adapter(invalidEncoding.fetch).complete(request), "INVALID_RESPONSE");
  });

  it.each([
    { contentType: "application/json" },
    { contentType: "text/html" },
    { contentType: "text/event-stream", redirected: true },
  ])("rejects JSON, HTML or redirect substitution %#", async (options) => {
    const transport = sequenceFetch(jsonResponse({ choices: [] }, options));

    await expectCode(adapter(transport.fetch).complete(request), "INVALID_RESPONSE");
    expect(transport.calls).toHaveLength(1);
  });

  it("maps a fetch failure to NETWORK_ERROR without retry or fallback", async () => {
    const calls: FetchCall[] = [];
    const fetch: OpenAICompatibleFetch = async (input, init) => {
      calls.push({ input, init });
      throw new Error("private transport detail");
    };

    await expectCode(adapter(fetch).complete(request), "NETWORK_ERROR");
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe(`${baseUrl}/v1/chat/completions`);
  });

  it("rejects a caller-pre-aborted request before fetch", async () => {
    const fetch = vi.fn<OpenAICompatibleFetch>();
    const caller = new AbortController();
    caller.abort();

    await expectCode(adapter(fetch).complete(request, caller.signal), "CANCELLED");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards caller cancellation and keeps a late backend response terminal", async () => {
    let release: ((response: Response) => void) | undefined;
    let internalSignal: AbortSignal | undefined;
    const fetch = vi.fn<OpenAICompatibleFetch>(
      (_input, init) =>
        new Promise<Response>((resolve) => {
          internalSignal = init?.signal as AbortSignal;
          release = resolve;
        })
    );
    const caller = new AbortController();
    const completion = adapter(fetch).complete(request, caller.signal);

    caller.abort();
    await expectCode(completion, "CANCELLED");
    expect(internalSignal?.aborted).toBe(true);
    release?.(completionResponse("late private content"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("cancels the active SSE reader after a delivered partial delta", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cancel = vi.fn(async () => undefined);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      cancel,
    });
    const fetch = vi.fn<OpenAICompatibleFetch>(
      async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
    );
    const caller = new AbortController();
    const deltas: string[] = [];
    const completion = adapter(fetch).complete(request, caller.signal, {
      onTextDelta: (delta) => deltas.push(delta),
    });

    streamController?.enqueue(
      new TextEncoder().encode(
        `data: ${JSON.stringify({ model: modelId, choices: [{ delta: { content: "Partial" }, finish_reason: null }] })}\n\n`
      )
    );
    await vi.waitFor(() => expect(deltas).toEqual(["Partial"]));

    caller.abort();

    await expectCode(completion, "CANCELLED");
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails with TIMEOUT and cancels the SSE reader after partial text", async () => {
    vi.useFakeTimers();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cancel = vi.fn(async () => undefined);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      cancel,
    });
    const fetch = vi.fn<OpenAICompatibleFetch>(
      async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
    );
    const deltas: string[] = [];
    const completion = adapter(fetch, { requestTimeoutMs: 25 }).complete(request, undefined, {
      onTextDelta: (delta) => deltas.push(delta),
    });
    const expectation = expectCode(completion, "TIMEOUT");

    streamController?.enqueue(
      new TextEncoder().encode(
        `data: ${JSON.stringify({ model: modelId, choices: [{ delta: { content: "Partial" }, finish_reason: null }] })}\n\n`
      )
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(deltas).toEqual(["Partial"]);

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts an active request on timeout without retry", async () => {
    vi.useFakeTimers();
    let internalSignal: AbortSignal | undefined;
    const fetch = vi.fn<OpenAICompatibleFetch>(
      (_input, init) =>
        new Promise<Response>(() => {
          internalSignal = init?.signal as AbortSignal;
        })
    );
    const completion = adapter(fetch, { requestTimeoutMs: 25 }).complete(request);
    const expectation = expectCode(completion, "TIMEOUT");

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    expect(internalSignal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts all active requests on disconnect", async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn<OpenAICompatibleFetch>(
      (_input, init) =>
        new Promise<Response>(() => {
          signals.push(init?.signal as AbortSignal);
        })
    );
    const gateway = adapter(fetch, { credential });
    const first = gateway.checkConnection();
    const second = gateway.complete(request);

    gateway.disconnect();

    await expectCode(first, "CANCELLED");
    await expectCode(second, "CANCELLED");
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
