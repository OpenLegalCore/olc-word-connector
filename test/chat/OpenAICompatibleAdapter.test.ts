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
) {
  return jsonResponse({
    id: "synthetic-completion-id",
    object: "chat.completion",
    ...(model === undefined ? {} : { model }),
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
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
    { contentType: "text/html" },
    { contentType: "application/json", redirected: true },
    { status: 302 },
    { status: 0, type: "opaqueredirect" as const },
    { status: 401 },
    { status: 403 },
  ])(
    "classifies same-origin Access HTML, opaque/manual redirect and denial as SESSION_EXPIRED %#",
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
  it("sends one exact non-stream text-only request and returns normalized plain text", async () => {
    const transport = sequenceFetch(completionResponse());
    const gateway = adapter(transport.fetch);

    const result = await gateway.complete(request);

    expect(result).toEqual({ text: "Completed plain text.", model: modelId });
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(`${baseUrl}/v1/chat/completions`);
    expect(transport.calls[0].init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
    });
    expect(headers(transport.calls[0])).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });

    const payload = body(transport.calls[0]);
    expect(payload).toEqual({
      model: modelId,
      stream: false,
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

  it("adds Bearer only when configured and clears it on disconnect", async () => {
    const transport = sequenceFetch(completionResponse(), completionResponse());
    const gateway = adapter(transport.fetch, { credential });

    await gateway.complete(request);
    gateway.disconnect();
    await gateway.complete(request);

    expect(headers(transport.calls[0]).Authorization).toBe(`Bearer ${credential}`);
    expect(headers(transport.calls[1])).not.toHaveProperty("Authorization");
  });

  it("returns a result without model metadata when the backend omits it", async () => {
    const transport = sequenceFetch(
      jsonResponse({ choices: [{ message: { role: "assistant", content: "Text only." } }] })
    );

    await expect(adapter(transport.fetch).complete(request)).resolves.toEqual({
      text: "Text only.",
    });
  });

  it("treats HTML-looking model output as untrusted plain text without DOM mutation", async () => {
    document.body.innerHTML = "<main>unchanged</main>";
    const transport = sequenceFetch(completionResponse("<strong>plain text</strong>"));

    const result = await adapter(transport.fetch).complete(request);

    expect(result.text).toBe("<strong>plain text</strong>");
    expect(document.body.innerHTML).toBe("<main>unchanged</main>");
  });

  it.each([
    null,
    {},
    { choices: null },
    { choices: [] },
    { choices: [null] },
    { choices: [{}] },
    { choices: [{ message: null }] },
    { choices: [{ message: {} }] },
    { choices: [{ message: { content: null } }] },
    { choices: [{ message: { content: ["multimodal"] } }] },
  ])("rejects malformed completion schema %#", async (payload) => {
    const transport = sequenceFetch(jsonResponse(payload));

    await expectCode(adapter(transport.fetch).complete(request), "INVALID_RESPONSE");
    expect(transport.calls).toHaveLength(1);
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

  it.each([
    { contentType: "text/event-stream" },
    { contentType: "text/html" },
    { contentType: "application/json", redirected: true },
  ])("rejects streaming, HTML or redirect completion %#", async (options) => {
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
