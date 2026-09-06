import { afterEach, describe, expect, it, vi } from "vitest";

import { handleRequest } from "../../infrastructure/cloudflare/word-gateway-example/worker.js";

const publicOrigin = "https://word.example.invalid";
const maxRequestBytes = 64 * 1024;
const maxResponseBytes = 1024 * 1024;
const environment = {
  PUBLIC_HOST: "word.example.invalid",
  OWUI_API_KEY: "synthetic-owui-secret",
  CF_ACCESS_CLIENT_ID: "synthetic-client-id",
  CF_ACCESS_CLIENT_SECRET: "synthetic-client-secret",
  OWUI_ORIGIN: "https://open-webui.example.invalid",
  ENGINE_ORIGIN: "https://olc-engine.example.invalid",
};

function request(path: string, init?: RequestInit): Request {
  return new Request(publicOrigin + path, init);
}

function response(contentType: string, body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { "Content-Type": contentType, ...init?.headers },
  });
}

async function errorCode(result: Response): Promise<string> {
  return ((await result.json()) as { error: { code: string } }).error.code;
}

const sessionCopy = {
  "en-US": [
    '<html lang="en-US">',
    "<title>Sign-in complete</title>",
    "<h1>Sign-in complete</h1>",
    "Return to Word and select “Retry search”.",
    "You can close this tab.",
  ],
  "sl-SI": [
    '<html lang="sl-SI">',
    "<title>Prijava je končana</title>",
    "<h1>Prijava je končana</h1>",
    "Vrnite se v Word in izberite »Ponovi iskanje«.",
    "Ta zavihek lahko zaprete.",
  ],
} as const;

async function expectSessionPage(
  acceptLanguage: string | undefined,
  expectedLocale: keyof typeof sessionCopy
): Promise<void> {
  const fetchMock = vi.fn();
  const result = await handleRequest(
    request("/api/session", {
      ...(acceptLanguage === undefined ? {} : { headers: { "Accept-Language": acceptLanguage } }),
    }),
    environment,
    fetchMock
  );
  const body = await result.text();

  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(result.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
  expect(result.headers.get("Content-Security-Policy")).toBe(
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
  for (const text of sessionCopy[expectedLocale]) {
    expect(body).toContain(text);
  }
  const otherLocale = expectedLocale === "en-US" ? "sl-SI" : "en-US";
  for (const text of sessionCopy[otherLocale]) {
    expect(body).not.toContain(text);
  }
  expect(body).not.toMatch(
    /<script|<form|https?:\/\/|synthetic-|OWUI_|ENGINE_|CF_ACCESS_|credential|exception/i
  );
  expect(fetchMock).not.toHaveBeenCalled();
}

afterEach(() => vi.restoreAllMocks());

describe("Word gateway example routing", () => {
  it.each([
    ["GET", "/api/models", "application/json", "open-webui.example.invalid"],
    ["POST", "/api/chat/completions", "text/event-stream", "open-webui.example.invalid"],
    ["GET", "/v1/models", "application/json", "olc-engine.example.invalid"],
    ["POST", "/v1/chat/completions", "application/json", "olc-engine.example.invalid"],
  ] as const)("allows only %s %s", async (method, path, contentType, hostname) => {
    const fetchMock = vi.fn(async (upstream: Request) => {
      expect(new URL(upstream.url)).toMatchObject({ hostname, pathname: path });
      expect(upstream.method).toBe(method);
      return response(contentType, contentType === "text/event-stream" ? "data: [DONE]\n\n" : "{}");
    });
    const input = request(path, {
      method,
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
    });

    const result = await handleRequest(input, environment, fetchMock as typeof fetch);

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, "en-US"],
    ["en", "en-US"],
    ["en-US", "en-US"],
    ["EN-gb", "en-US"],
    ["sl", "sl-SI"],
    ["sl-SI", "sl-SI"],
    ["SL-si", "sl-SI"],
    ["en;q=0.4, sl;q=0.9", "sl-SI"],
    ["sl;q=0.4, en;q=0.9", "en-US"],
    ["sl;q=0.8, en;q=0.8", "sl-SI"],
    ["en;q=0.8, sl;q=0.8", "en-US"],
    ["", "en-US"],
    ["   ", "en-US"],
    ["\t  ", "en-US"],
    ["sl;q=0.2, sl;q=0.9, en;q=0.8", "sl-SI"],
    ["sl;q=0, sl;q=0.9, en;q=0.8", "sl-SI"],
    ["sl;q=0, en;q=0.5", "en-US"],
    ["de, fr;q=0.5", "en-US"],
    ["*", "en-US"],
    ["*;q=1, sl;q=0.2", "sl-SI"],
    ["sl;q=bogus", "en-US"],
    ["sl;q=0.1234", "en-US"],
    ["sl;level=1", "en-US"],
    ["sl;q=0.9;level=1, en;q=0.8", "en-US"],
    ["sl;q=0.9;q=0.8, en;q=0.7", "en-US"],
    ["sl;level=1;q=0.9, en;q=0.8", "en-US"],
    ["sl;q=1.1, en;q=0.8", "en-US"],
    ["sl;q=-0.1, en;q=0.8", "en-US"],
    ["sl;q=999999, en;q=0.8", "en-US"],
    ["sl;q=0.0000, en;q=0.8", "en-US"],
    [",sl", "en-US"],
    ["sl,,en", "en-US"],
    ["sl,", "en-US"],
    [",,", "en-US"],
  ] as const)("selects %s as %s for the protected session landing", async (header, locale) => {
    await expectSessionPage(header, locale);
  });

  it.each(["HEAD", "POST", "PUT", "DELETE"])(
    "rejects %s on the session landing without an upstream request",
    async (method) => {
      const fetchMock = vi.fn();
      const result = await handleRequest(
        request("/api/session", { method }),
        environment,
        fetchMock
      );

      expect(result.status).toBe(405);
      expect(result.headers.get("Allow")).toBe("GET");
      expect(result.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(result.headers.get("Content-Security-Policy")).toBe(
        "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      );
      expect(await errorCode(result)).toBe("METHOD_NOT_ALLOWED");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("provides the exact content-free readiness response", async () => {
    const fetchMock = vi.fn();
    const result = await handleRequest(request("/api/unsupported"), environment, fetchMock);

    expect(result.status).toBe(404);
    expect(result.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(result.headers.get("X-OLC-Word-Gateway")).toBe("1");
    expect(await errorCode(result)).toBe("ROUTE_NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/api/models", "GET"],
    ["GET", "/api/chat/completions", "POST"],
    ["DELETE", "/v1/models", "GET"],
    ["PUT", "/v1/chat/completions", "POST"],
  ])("rejects %s %s with Allow: %s", async (method, path, allow) => {
    const result = await handleRequest(request(path, { method }), environment, vi.fn());
    expect(result.status).toBe(405);
    expect(result.headers.get("Allow")).toBe(allow);
    expect(await errorCode(result)).toBe("METHOD_NOT_ALLOWED");
  });

  it.each(["/api/models?destination=elsewhere", "/api/session?lang=sl-SI"])(
    "rejects query strings on %s",
    async (path) => {
      const fetchMock = vi.fn();
      const result = await handleRequest(request(path), environment, fetchMock);
      expect(result.status).toBe(400);
      expect(await errorCode(result)).toBe("QUERY_STRING_NOT_ALLOWED");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    "http://word.example.invalid/api/models",
    "https://other.example.invalid/api/models",
    "https://word.example.invalid:444/api/models",
  ])("rejects a request outside the configured public host", async (url) => {
    const fetchMock = vi.fn();
    const result = await handleRequest(new Request(url), environment, fetchMock);
    expect(result.status).toBe(421);
    expect(await errorCode(result)).toBe("PUBLIC_HOST_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Word gateway example request boundary", () => {
  it.each([
    ["text/plain", "{}", 415, "JSON_CONTENT_TYPE_REQUIRED"],
    ["application/json", "{", 400, "INVALID_JSON"],
    ["application/json", "[]", 400, "JSON_OBJECT_REQUIRED"],
  ])("rejects an invalid completion body", async (contentType, body, status, code) => {
    const result = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
      environment,
      vi.fn()
    );
    expect(result.status).toBe(status);
    expect(await errorCode(result)).toBe(code);
  });

  it("rejects declared and measured oversized bodies", async () => {
    const declared = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(maxRequestBytes + 1),
        },
        body: "{}",
      }),
      environment,
      vi.fn()
    );
    const measured = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(maxRequestBytes) }),
      }),
      environment,
      vi.fn()
    );

    expect(declared.status).toBe(413);
    expect(measured.status).toBe(413);
    expect(await errorCode(measured)).toBe("REQUEST_BODY_TOO_LARGE");
  });

  it("requires every binding and rejects ambiguous hosts or upstream origins", async () => {
    for (const key of Object.keys(environment) as (keyof typeof environment)[]) {
      const fetchMock = vi.fn();
      const result = await handleRequest(
        request("/api/models"),
        { ...environment, [key]: "" },
        fetchMock
      );
      expect(result.status).toBe(503);
      expect(await errorCode(result)).toBe("GATEWAY_CONFIGURATION_ERROR");
      expect(fetchMock).not.toHaveBeenCalled();
    }

    for (const overrides of [
      { PUBLIC_HOST: "https://word.example.invalid" },
      { PUBLIC_HOST: "word.example.invalid." },
      { PUBLIC_HOST: "WORD.example.invalid" },
      { OWUI_ORIGIN: "http://open-webui.example.invalid" },
      { OWUI_ORIGIN: "https://user@open-webui.example.invalid" },
      { ENGINE_ORIGIN: "https://olc-engine.example.invalid/path" },
      { ENGINE_ORIGIN: "https://olc-engine.example.invalid:443" },
    ]) {
      const result = await handleRequest(
        request("/v1/models"),
        { ...environment, ...overrides },
        vi.fn()
      );
      expect(result.status).toBe(503);
      expect(await errorCode(result)).toBe("GATEWAY_CONFIGURATION_ERROR");
    }
  });
});

describe("Word gateway example credential and response boundary", () => {
  it("rebuilds OWUI headers from trusted bindings", async () => {
    const fetchMock = vi.fn(async (upstream: Request) => {
      expect(upstream.headers.get("Authorization")).toBe("Bearer synthetic-owui-secret");
      expect(upstream.headers.get("CF-Access-Client-ID")).toBe("synthetic-client-id");
      expect(upstream.headers.get("CF-Access-Client-Secret")).toBe("synthetic-client-secret");
      expect(upstream.headers.get("Cookie")).toBeNull();
      expect(upstream.headers.get("X-Untrusted")).toBeNull();
      return response("application/json", "{}");
    });
    const result = await handleRequest(
      request("/api/models", {
        headers: {
          Authorization: "Bearer browser-supplied",
          Cookie: "browser-cookie=forbidden",
          "CF-Access-Client-ID": "browser-client",
          "CF-Access-Client-Secret": "browser-secret",
          "X-Untrusted": "forbidden",
        },
      }),
      environment,
      fetchMock as typeof fetch
    );
    expect(result.status).toBe(200);
  });

  it("never sends the OWUI credential to the Engine", async () => {
    const fetchMock = vi.fn(async (upstream: Request) => {
      expect(upstream.headers.get("Authorization")).toBeNull();
      expect(upstream.headers.get("CF-Access-Client-ID")).toBe("synthetic-client-id");
      expect(upstream.headers.get("CF-Access-Client-Secret")).toBe("synthetic-client-secret");
      return response("application/json", "{}");
    });
    await handleRequest(request("/v1/models"), environment, fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes SSE through while stripping upstream metadata", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const result = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      environment,
      vi.fn(async () =>
        response("text/event-stream; charset=utf-8", stream, {
          headers: { "Set-Cookie": "forbidden", Server: "private-origin" },
        })
      )
    );
    expect(result.status).toBe(200);
    expect(await result.text()).toBe("data: [DONE]\n\n");
    expect(result.headers.get("Set-Cookie")).toBeNull();
    expect(result.headers.get("Server")).toBeNull();
  });

  it("passes Engine JSON through while stripping upstream metadata", async () => {
    const result = await handleRequest(
      request("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      environment,
      vi.fn(async () =>
        response("application/json", '{"choices":[]}', {
          headers: { "Set-Cookie": "forbidden", "X-Origin-ID": "private" },
        })
      )
    );
    expect(await result.json()).toEqual({ choices: [] });
    expect(result.headers.get("Set-Cookie")).toBeNull();
    expect(result.headers.get("X-Origin-ID")).toBeNull();
  });

  it("bounds declared and measured upstream response bodies", async () => {
    const declared = await handleRequest(
      request("/v1/models"),
      environment,
      vi.fn(async () =>
        response("application/json", "{}", {
          headers: { "Content-Length": String(maxResponseBytes + 1) },
        })
      )
    );
    expect(declared.status).toBe(502);
    expect(await errorCode(declared)).toBe("UPSTREAM_RESPONSE_TOO_LARGE");

    const measured = await handleRequest(
      request("/v1/models"),
      environment,
      vi.fn(async () =>
        response("application/json", JSON.stringify({ padding: "x".repeat(maxResponseBytes) }))
      )
    );
    expect(measured.status).toBe(502);
    expect(await errorCode(measured)).toBe("UPSTREAM_RESPONSE_TOO_LARGE");

    const streamed = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      environment,
      vi.fn(async () => response("text/event-stream", "x".repeat(maxResponseBytes + 1)))
    );
    await expect(streamed.text()).rejects.toThrow();
  });

  it.each([
    [new Response("raw upstream", { status: 401 }), "UPSTREAM_REJECTED"],
    [response("text/html", "<html></html>"), "UPSTREAM_PROTOCOL_ERROR"],
    [response("application/json", "{"), "UPSTREAM_PROTOCOL_ERROR"],
  ])("normalizes an upstream response failure", async (upstream, code) => {
    const result = await handleRequest(
      request("/api/models"),
      environment,
      vi.fn(async () => upstream)
    );
    expect(result.status).toBe(502);
    expect(await errorCode(result)).toBe(code);
  });

  it("normalizes transport failure without logging private data", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((name) =>
      vi.spyOn(console, name as "log").mockImplementation(() => undefined)
    );
    const result = await handleRequest(
      request("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"selectedText":"synthetic-sensitive-fixture"}',
      }),
      environment,
      vi.fn(async () => {
        throw new Error("raw upstream diagnostic");
      })
    );
    expect(result.status).toBe(502);
    expect(await errorCode(result)).toBe("UPSTREAM_UNAVAILABLE");
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it("propagates cancellation to the upstream request", async () => {
    const controller = new AbortController();
    const pending = handleRequest(
      new Request(publicOrigin + "/v1/models", { signal: controller.signal }),
      environment,
      vi.fn(
        (upstream: Request) =>
          new Promise<Response>((_resolve, reject) =>
            upstream.signal.addEventListener(
              "abort",
              () => reject(new DOMException("", "AbortError")),
              { once: true }
            )
          )
      ) as typeof fetch
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
