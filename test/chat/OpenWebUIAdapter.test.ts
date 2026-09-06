import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompletionRequest } from "../../src/chat/ChatGateway";
import { OpenWebUIAdapter, type OpenWebUIFetch } from "../../src/chat/OpenWebUIAdapter";

const baseUrl = "https://open-webui.example.invalid/base";
const modelId = "configured-model";
const credential = "fixture-credential";
const firstUuid = "7d444840-9dc0-4ef8-b2d8-fad47f2b72cb";
const secondUuid = "107e6ea8-46f5-4db6-8c2c-51822f30d6d2";
const request: CompletionRequest = {
  question: "Which law applies?",
  context: { type: "selected_text", quotedText: "Selected text" },
  uiLocale: "en-US",
};

interface FetchCall {
  readonly input: string;
  readonly init: RequestInit | undefined;
}

interface FakeReader extends ReadableStreamDefaultReader<Uint8Array> {
  readonly cancelCalls: number;
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function streamEvent(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function readerFromChunks(chunks: readonly Uint8Array[]): FakeReader {
  let index = 0;
  let cancelled = false;
  let cancelCalls = 0;
  const reader = {
    get cancelCalls(): number {
      return cancelCalls;
    },
    closed: Promise.resolve(undefined),
    async cancel(): Promise<void> {
      cancelCalls++;
      cancelled = true;
    },
    async read(): Promise<ReadableStreamReadResult<Uint8Array>> {
      if (cancelled || index >= chunks.length) {
        return { done: true, value: undefined };
      }
      return { done: false, value: chunks[index++] };
    },
    releaseLock(): void {
      return undefined;
    },
  };
  return reader as FakeReader;
}

function jsonResponse(payload: unknown, status = 200, contentType = "application/json"): Response {
  return {
    body: null,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    json: async () => payload,
    ok: status >= 200 && status < 300,
    redirected: false,
    status,
  } as unknown as Response;
}

function sseResponse(
  chunks: readonly Uint8Array[],
  options: {
    readonly status?: number;
    readonly contentType?: string;
    readonly redirected?: boolean;
    readonly type?: Response["type"];
    readonly cancel?: () => Promise<void>;
  } = {}
): Response {
  const status = options.status ?? 200;
  return {
    body: {
      cancel: options.cancel ?? (async () => undefined),
      getReader: () => readerFromChunks(chunks),
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? (options.contentType ?? "text/event-stream; charset=utf-8")
          : null,
    },
    json: async () => {
      throw new Error("JSON is unavailable for an SSE fixture");
    },
    ok: status >= 200 && status < 300,
    redirected: options.redirected ?? false,
    status,
    type: options.type ?? "basic",
  } as unknown as Response;
}

function sequenceFetch(...responses: readonly Response[]): {
  readonly calls: FetchCall[];
  readonly fetch: OpenWebUIFetch;
} {
  const calls: FetchCall[] = [];
  const fetch: OpenWebUIFetch = async (input, init) => {
    calls.push({ input, init });
    const response = responses[calls.length - 1];
    if (!response) {
      throw new Error("Unexpected fetch call");
    }
    return response;
  };
  return { calls, fetch };
}

function adapter(
  fetch: OpenWebUIFetch,
  uuidV4: () => string = () => firstUuid,
  requestTimeoutMs = 1_000
): OpenWebUIAdapter {
  return new OpenWebUIAdapter(
    { baseUrl, modelId, credential, requestTimeoutMs },
    { fetch, uuidV4 }
  );
}

function completionResponse(content = "Completed text"): Response {
  return sseResponse([bytes(`${streamEvent(content)}data: [DONE]\n\n`)]);
}

function headers(call: FetchCall): Record<string, string> {
  return call.init?.headers as Record<string, string>;
}

function parsedBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(call.init?.body as string) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OpenWebUIAdapter configuration", () => {
  it.each([
    {
      configured: "https://open-webui.example.invalid/base/",
      expected: "https://open-webui.example.invalid/base/api/models",
    },
    {
      configured: "http://localhost:3000",
      expected: "http://localhost:3000/api/models",
    },
    {
      configured: "HTTP://LOCALHOST:3000/base/",
      expected: "http://localhost:3000/base/api/models",
    },
    {
      configured: "http://127.0.0.1:3000/base///",
      expected: "http://127.0.0.1:3000/base/api/models",
    },
    {
      configured: "http://[::1]:3000/base/",
      expected: "http://[::1]:3000/base/api/models",
    },
    {
      configured: "http://localhost",
      expected: "http://localhost/api/models",
    },
    {
      configured: "http://127.0.0.1:80/",
      expected: "http://127.0.0.1/api/models",
    },
  ])("accepts an approved HTTPS or exact loopback base URL", async ({ configured, expected }) => {
    const transport = sequenceFetch(jsonResponse({ data: [{ id: modelId }] }));
    const gateway = new OpenWebUIAdapter(
      { baseUrl: configured, modelId, credential },
      { fetch: transport.fetch, uuidV4: () => firstUuid }
    );

    await gateway.checkConnection();

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(expected);
  });

  it.each([
    "not a URL",
    " https://open-webui.example.invalid",
    "https://open-webui.example.invalid\n",
    "http://open-webui.example.invalid",
    "http://10.0.0.1:3000",
    "http://172.16.0.1:3000",
    "http://192.168.1.1:3000",
    "http://169.254.1.1:3000",
    "http://0.0.0.0:3000",
    "http://[::]:3000",
    "http://localhost.example.com:3000",
    "http://example.localhost:3000",
    "http://evil-localhost:3000",
    "http://localhost.:3000",
    "http://%6cocalhost:3000",
    "http://127.1:3000",
    "http://2130706433:3000",
    "http://0x7f000001:3000",
    "http://0177.0.0.1:3000",
    "http://[0:0:0:0:0:0:0:1]:3000",
    "http://[::ffff:127.0.0.1]:3000",
    "http://user@localhost:3000",
    "http://user:password@localhost:3000",
    "http://@localhost:3000/base",
    "http://:@localhost:3000/base",
    "https://user@open-webui.example.invalid",
    "https://user:password@open-webui.example.invalid",
    "https://@open-webui.example.invalid/base",
    "https://:@open-webui.example.invalid/base",
    "ftp://localhost:3000",
    "file://localhost/tmp",
    "ws://localhost:3000",
    "wss://localhost:3000",
    "//localhost:3000",
    "http://localhost:not-a-port",
    "http://localhost:65536",
    "https://open-webui.example.invalid?mode=unsafe",
    "https://open-webui.example.invalid#fragment",
    "http://localhost:3000/base?",
    "http://localhost:3000/base#",
    "https://open-webui.example.invalid/base?",
    "https://open-webui.example.invalid/base#",
  ])("rejects an invalid base URL without making a request", (invalidUrl) => {
    const fetch = vi.fn<OpenWebUIFetch>();

    expect(
      () =>
        new OpenWebUIAdapter(
          { baseUrl: invalidUrl, modelId, credential },
          { fetch, uuidV4: () => firstUuid }
        )
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid model, credential, timeout and response limits", () => {
    const fetch = vi.fn<OpenWebUIFetch>();
    const dependency = { fetch, uuidV4: () => firstUuid };

    expect(() => new OpenWebUIAdapter({ baseUrl, modelId: "", credential }, dependency)).toThrow(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" })
    );
    expect(() => new OpenWebUIAdapter({ baseUrl, modelId, credential: "\n" }, dependency)).toThrow(
      expect.objectContaining({ code: "INVALID_CONFIGURATION" })
    );
    expect(
      () => new OpenWebUIAdapter({ baseUrl, modelId, credential, requestTimeoutMs: 0 }, dependency)
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(
      () => new OpenWebUIAdapter({ baseUrl, modelId, credential, maxResponseChars: -1 }, dependency)
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps same-origin mode free of direct URL and credential configuration", () => {
    const fetch = vi.fn<OpenWebUIFetch>();
    const dependency = { fetch, uuidV4: () => firstUuid };

    expect(
      () => new OpenWebUIAdapter({ transport: "same-origin", baseUrl, modelId }, dependency)
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(
      () => new OpenWebUIAdapter({ transport: "same-origin", modelId, credential }, dependency)
    ).toThrow(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses browser fetch and secure randomness when test seams are not supplied", async () => {
    const fetch = vi.fn<OpenWebUIFetch>(async () => completionResponse("Default dependencies"));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint8Array): Uint8Array => {
        target.fill(0);
        return target;
      },
    });
    const gateway = new OpenWebUIAdapter({ baseUrl, modelId, credential });

    await expect(gateway.complete(request)).resolves.toEqual({ text: "Default dependencies" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const call = fetch.mock.calls[0];
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      chat_id: "local:00000000-0000-4000-8000-000000000000",
    });
  });

  it("fails closed when browser fetch or secure randomness is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    const noFetch = new OpenWebUIAdapter(
      { baseUrl, modelId, credential },
      { uuidV4: () => firstUuid }
    );
    await expect(noFetch.complete(request)).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });

    const fetch = vi.fn<OpenWebUIFetch>();
    vi.stubGlobal("crypto", undefined);
    const noCrypto = new OpenWebUIAdapter({ baseUrl, modelId, credential }, { fetch });
    await expect(noCrypto.complete(request)).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("OpenWebUIAdapter model preflight", () => {
  it("uses one exact /api/models request with Bearer authentication", async () => {
    const transport = sequenceFetch(
      jsonResponse(
        { data: [{ id: "other-model" }, { id: modelId }] },
        200,
        "application/json; charset=utf-8"
      )
    );
    const gateway = adapter(transport.fetch);

    await expect(gateway.checkConnection()).resolves.toBeUndefined();

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].input).toBe(`${baseUrl}/api/models`);
    expect(transport.calls[0].init).toMatchObject({
      method: "GET",
      credentials: "omit",
      redirect: "error",
    });
    expect(headers(transport.calls[0])).toEqual({
      Accept: "application/json",
      Authorization: `Bearer ${credential}`,
    });
  });

  it("normalizes a trailing base-URL slash without changing its path", async () => {
    const transport = sequenceFetch(jsonResponse({ data: [{ id: modelId }] }));
    const gateway = new OpenWebUIAdapter(
      { baseUrl: `${baseUrl}/`, modelId, credential },
      { fetch: transport.fetch, uuidV4: () => firstUuid }
    );

    await gateway.checkConnection();

    expect(transport.calls[0].input).toBe(`${baseUrl}/api/models`);
  });

  it("rejects a valid inventory that lacks the exact configured model", async () => {
    const transport = sequenceFetch(jsonResponse({ data: [{ id: `${modelId}-extended` }] }));

    await expect(adapter(transport.fetch).checkConnection()).rejects.toMatchObject({
      code: "MODEL_NOT_AVAILABLE",
    });
    expect(transport.calls).toHaveLength(1);
  });

  it("rejects an invalid models schema or JSON response", async () => {
    const invalidSchema = sequenceFetch(jsonResponse({ data: [{ name: modelId }] }));
    await expect(adapter(invalidSchema.fetch).checkConnection()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const invalidJsonResponse = jsonResponse({});
    Object.assign(invalidJsonResponse, {
      json: async () => {
        throw new SyntaxError("fixture");
      },
    });
    const invalidJson = sequenceFetch(invalidJsonResponse);
    await expect(adapter(invalidJson.fetch).checkConnection()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const missingData = sequenceFetch(jsonResponse(null));
    await expect(adapter(missingData.fetch).checkConnection()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("classifies a models body read failure as a network error", async () => {
    const response = jsonResponse({});
    Object.assign(response, {
      json: async () => {
        throw new TypeError("fixture body read failure");
      },
    });
    const transport = sequenceFetch(response);

    await expect(adapter(transport.fetch).checkConnection()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(transport.calls).toHaveLength(1);
  });
});

describe("OpenWebUIAdapter completion transport", () => {
  it("uses only same-origin gateway paths, cookies and no browser authorization headers", async () => {
    const transport = sequenceFetch(
      jsonResponse({ data: [{ id: modelId }] }),
      completionResponse("Same-origin completion")
    );
    const gateway = new OpenWebUIAdapter(
      { transport: "same-origin", modelId },
      { fetch: transport.fetch, uuidV4: () => firstUuid }
    );

    await gateway.checkConnection();
    await expect(gateway.complete(request)).resolves.toEqual({ text: "Same-origin completion" });

    expect(transport.calls.map((call) => call.input)).toEqual([
      "/api/models",
      "/api/chat/completions",
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
    sseResponse([bytes("<html>Access</html>")], { contentType: "text/html" }),
    sseResponse([bytes("data: [DONE]\n\n")], { redirected: true }),
    sseResponse([], { status: 302 }),
    sseResponse([], { status: 0, type: "opaqueredirect" }),
    sseResponse([], { status: 401 }),
    sseResponse([], { status: 403 }),
  ])(
    "classifies same-origin Access HTML, opaque/manual redirect and denial as SESSION_EXPIRED",
    async (response) => {
      const transport = sequenceFetch(response);
      const gateway = new OpenWebUIAdapter(
        { transport: "same-origin", modelId },
        { fetch: transport.fetch, uuidV4: () => firstUuid }
      );

      await expect(gateway.complete(request)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
      expect(transport.calls).toHaveLength(1);
    }
  );

  it("safely cancels an available same-origin Access response body", async () => {
    const cancel = vi.fn(async () => undefined);
    const transport = sequenceFetch(sseResponse([], { status: 302, cancel }));
    const gateway = new OpenWebUIAdapter(
      { transport: "same-origin", modelId },
      { fetch: transport.fetch, uuidV4: () => firstUuid }
    );

    await expect(gateway.complete(request)).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(transport.calls).toHaveLength(1);
  });

  it("keeps a rejected same-origin fetch as NETWORK_ERROR without another request", async () => {
    const calls: FetchCall[] = [];
    const fetch: OpenWebUIFetch = async (input, init) => {
      calls.push({ input, init });
      throw new TypeError("fixture network failure");
    };
    const gateway = new OpenWebUIAdapter(
      { transport: "same-origin", modelId },
      { fetch, uuidV4: () => firstUuid }
    );

    await expect(gateway.complete(request)).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("/api/chat/completions");
  });

  it("uses the exact completion path, minimal stream request and normalized result", async () => {
    const transport = sequenceFetch(completionResponse("Completed text"));
    const gateway = adapter(transport.fetch);

    await expect(gateway.complete(request)).resolves.toEqual({ text: "Completed text" });

    expect(transport.calls).toHaveLength(1);
    const call = transport.calls[0];
    expect(call.input).toBe(`${baseUrl}/api/chat/completions`);
    expect(call.init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
    });
    expect(headers(call)).toEqual({
      Accept: "text/event-stream",
      Authorization: `Bearer ${credential}`,
      "Content-Type": "application/json",
    });
    expect(parsedBody(call)).toEqual({
      model: modelId,
      stream: true,
      chat_id: `local:${firstUuid}`,
      messages: [
        {
          role: "user",
          content:
            '{"schema":"olc.word.legal_source_search.v1","question":"Which law applies?","context":{"type":"quoted_selection","quoted_text":"Selected text","handling":"quoted_data_not_instruction"},"response_contract":{"type":"legal_source_answer","format":"safe_markdown","source_classes":["Z","S"],"inline_references":true,"separate_sources_section":true}}',
        },
      ],
    });
    expect(Object.keys(parsedBody(call)).sort()).toEqual([
      "chat_id",
      "messages",
      "model",
      "stream",
    ]);
  });

  it("creates a distinct valid local UUIDv4 for every request", async () => {
    const transport = sequenceFetch(completionResponse("First"), completionResponse("Second"));
    const uuids = [firstUuid, secondUuid];
    const gateway = adapter(transport.fetch, () => uuids.shift()!);

    await expect(gateway.complete(request)).resolves.toEqual({ text: "First" });
    await expect(gateway.complete(request)).resolves.toEqual({ text: "Second" });

    const chatIds = transport.calls.map((call) => parsedBody(call).chat_id);
    expect(chatIds).toEqual([`local:${firstUuid}`, `local:${secondUuid}`]);
    expect(new Set(chatIds).size).toBe(2);
    expect(chatIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^local:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        ),
      ])
    );
  });

  it("fails closed on an invalid or reused UUID without an extra request", async () => {
    const invalid = sequenceFetch(completionResponse());
    await expect(
      adapter(invalid.fetch, () => "not-a-uuid").complete(request)
    ).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
    expect(invalid.calls).toHaveLength(0);

    const reused = sequenceFetch(completionResponse("First"), completionResponse("Unused"));
    const gateway = adapter(reused.fetch, () => firstUuid);
    await expect(gateway.complete(request)).resolves.toEqual({ text: "First" });
    await expect(gateway.complete(request)).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
    expect(reused.calls).toHaveLength(1);

    const throwing = sequenceFetch(completionResponse("Unused"));
    await expect(
      adapter(throwing.fetch, () => {
        throw new Error("fixture UUID failure");
      }).complete(request)
    ).rejects.toMatchObject({ code: "INVALID_CONFIGURATION" });
    expect(throwing.calls).toHaveLength(0);
  });

  it("clears its session credential on disconnect", async () => {
    const transport = sequenceFetch(completionResponse());
    const gateway = adapter(transport.fetch);

    gateway.disconnect();

    await expect(gateway.checkConnection()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(transport.calls).toHaveLength(0);
  });

  it("checks disconnected auth before allocating or serializing a completion request", async () => {
    const fetch = vi.fn<OpenWebUIFetch>();
    const uuidV4 = vi.fn(() => firstUuid);
    const gateway = adapter(fetch, uuidV4);
    gateway.disconnect();

    await expect(gateway.complete(request)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(gateway.complete(request)).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(uuidV4).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disconnect cancels an active request without retry", async () => {
    const calls: FetchCall[] = [];
    const fetch: OpenWebUIFetch = (input, init) => {
      calls.push({ input, init });
      return new Promise<Response>(() => undefined);
    };
    const gateway = adapter(fetch);
    const completion = gateway.complete(request);

    gateway.disconnect();

    await expect(completion).rejects.toMatchObject({ code: "CANCELLED" });
    expect(calls).toHaveLength(1);
  });
});

describe("OpenWebUIAdapter controlled failures", () => {
  it.each([
    [401, "AUTH_REQUIRED"],
    [403, "ACCESS_DENIED"],
    [404, "MODEL_NOT_AVAILABLE"],
    [408, "TIMEOUT"],
    [429, "RATE_LIMITED"],
    [422, "INVALID_RESPONSE"],
    [500, "SERVICE_UNAVAILABLE"],
    [503, "SERVICE_UNAVAILABLE"],
    [206, "INVALID_RESPONSE"],
  ] as const)("maps HTTP %i without retry", async (status, code) => {
    const transport = sequenceFetch(sseResponse([], { status }));

    await expect(adapter(transport.fetch).complete(request)).rejects.toMatchObject({ code });
    expect(transport.calls).toHaveLength(1);
  });

  it("rejects HTML and redirected success responses", async () => {
    const html = sequenceFetch(sseResponse([bytes("<html></html>")], { contentType: "text/html" }));
    await expect(adapter(html.fetch).complete(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const redirected = sequenceFetch(
      sseResponse([bytes("data: [DONE]\n\n")], { redirected: true })
    );
    await expect(adapter(redirected.fetch).complete(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const missingContentType = sequenceFetch(sseResponse([], { contentType: "" }));
    await expect(adapter(missingContentType.fetch).complete(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects a successful response without a readable stream body", async () => {
    const transport = sequenceFetch(jsonResponse({}, 200, "text/event-stream"));

    await expect(adapter(transport.fetch).complete(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(transport.calls).toHaveLength(1);
  });

  it("maps a body reader acquisition failure to INVALID_RESPONSE", async () => {
    const response = sseResponse([]);
    const cancel = vi.fn(async () => undefined);
    Object.assign(response, {
      body: {
        cancel,
        getReader: () => {
          throw new TypeError("fixture locked stream");
        },
      },
    });
    const transport = sequenceFetch(response);

    await expect(adapter(transport.fetch).complete(request)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(transport.calls).toHaveLength(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("maps a network failure without retry or fallback", async () => {
    const calls: FetchCall[] = [];
    const fetch: OpenWebUIFetch = async (input, init) => {
      calls.push({ input, init });
      throw new TypeError("fixture network failure");
    };

    await expect(adapter(fetch).complete(request)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe(`${baseUrl}/api/chat/completions`);
  });

  it("classifies timeout and makes no retry", async () => {
    vi.useFakeTimers();
    const calls: FetchCall[] = [];
    const fetch: OpenWebUIFetch = (input, init) => {
      calls.push({ input, init });
      return new Promise<Response>(() => undefined);
    };
    const gateway = adapter(fetch, () => firstUuid, 10);

    const completion = gateway.complete(request);
    const rejection = expect(completion).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10);

    await rejection;
    expect(calls).toHaveLength(1);
  });

  it("cancels before a pending response and ignores the late response", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const calls: FetchCall[] = [];
    const fetch: OpenWebUIFetch = (input, init) => {
      calls.push({ input, init });
      return new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
    };
    const abortController = new AbortController();
    const completion = adapter(fetch).complete(request, abortController.signal);

    abortController.abort();

    await expect(completion).rejects.toMatchObject({ code: "CANCELLED" });
    resolveResponse(completionResponse("Late text"));
    await Promise.resolve();
    expect(calls).toHaveLength(1);
  });

  it("does not allocate a chat ID or call fetch for an already-cancelled request", async () => {
    const fetch = vi.fn<OpenWebUIFetch>();
    const uuidV4 = vi.fn(() => firstUuid);
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      adapter(fetch, uuidV4).complete(request, abortController.signal)
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(uuidV4).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels during stream consumption and a late chunk cannot produce a result", async () => {
    let resolveRead: (result: ReadableStreamReadResult<Uint8Array>) => void = () => undefined;
    let reads = 0;
    let cancelCalls = 0;
    const controlledReader = {
      get cancelCalls(): number {
        return cancelCalls;
      },
      closed: Promise.resolve(undefined),
      async cancel(): Promise<void> {
        cancelCalls++;
      },
      read(): Promise<ReadableStreamReadResult<Uint8Array>> {
        reads++;
        if (reads === 1) {
          return Promise.resolve({ done: false, value: bytes(streamEvent("Partial")) });
        }
        return new Promise((resolve) => {
          resolveRead = resolve;
        });
      },
      releaseLock(): void {
        return undefined;
      },
    } as FakeReader;
    const response = sseResponse([]);
    Object.assign(response, { body: { getReader: () => controlledReader } });
    const transport = sequenceFetch(response);
    const abortController = new AbortController();
    const completion = adapter(transport.fetch).complete(request, abortController.signal);
    await Promise.resolve();
    await Promise.resolve();

    abortController.abort();

    await expect(completion).rejects.toMatchObject({ code: "CANCELLED" });
    resolveRead({ done: false, value: bytes(`${streamEvent("Late")}data: [DONE]\n\n`) });
    await Promise.resolve();
    expect(transport.calls).toHaveLength(1);
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });

  it("does not log content or touch Office or the document on success and failure", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const originalBody = document.body.innerHTML;
    const originalWord = (globalThis as { Word?: unknown }).Word;
    Object.defineProperty(globalThis, "Word", {
      configurable: true,
      value: new Proxy(
        {},
        {
          get: () => {
            throw new Error("Office access is forbidden");
          },
        }
      ),
    });
    try {
      const success = sequenceFetch(completionResponse("Private fixture result"));
      await adapter(success.fetch).complete({
        ...request,
        context: { type: "selected_text", quotedText: "Private fixture input" },
      });
      const failure = sequenceFetch(sseResponse([], { status: 500 }));
      await expect(adapter(failure.fetch).complete(request)).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });

      expect(document.body.innerHTML).toBe(originalBody);
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(debug).not.toHaveBeenCalled();
    } finally {
      if (originalWord === undefined) {
        Reflect.deleteProperty(globalThis, "Word");
      } else {
        Object.defineProperty(globalThis, "Word", {
          configurable: true,
          value: originalWord,
        });
      }
    }
  });
});
