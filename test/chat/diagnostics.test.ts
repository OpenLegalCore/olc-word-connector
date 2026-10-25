/* global RequestInit, Response, ReadableStream, TextEncoder, AbortController */
import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { AttemptDiagnostics, ATTEMPT_TTL_MS, diagnosticReceipt } from "../../src/chat/diagnostics";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import { contentEvent } from "../fixtures/documentReview";
import { upstreamSseErrorCodes } from "../../src/chat/upstreamSseError";
const request = {
  question: "PRIVATE_QUESTION",
  context: { type: "none" as const },
  uiLocale: "sl-SI" as const,
};
const make = (fetch: (url: string, init?: RequestInit) => Promise<Response>, timeout = 1000) =>
  new OpenAICompatibleAdapter(
    { transport: "same-origin", modelId: "lexai-engine-local", requestTimeoutMs: timeout },
    { fetch }
  );
describe("frontend failure diagnostics", () => {
  it.each([...upstreamSseErrorCodes, "UNKNOWN"])(
    "retains only the allowlisted SSE code %s after a delta, without replay",
    async (code) => {
      const fetch = vi.fn(
        async () =>
          new Response(
            contentEvent("PRIVATE_DELTA") +
              `data: ${JSON.stringify({ error: { code, message: "PRIVATE_MESSAGE", type: "PRIVATE_TYPE", param: "PRIVATE_PARAM" } })}\n\n` +
              "data: [DONE]\n\n",
            { headers: { "Content-Type": "text/event-stream" } }
          )
      );
      const adapter = make(fetch);
      await expect(adapter.complete(request)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
        reason: "SSE_ERROR_EVENT",
        upstreamCode: code,
      });
      expect(adapter.diagnostics.latestFailure()).toMatchObject({
        outcome: "failed",
        phase: "sse",
        reason: "SSE_ERROR_EVENT",
        httpStatus: 200,
        upstreamCode: code,
      });
      expect(JSON.stringify(adapter.diagnostics.snapshot())).not.toContain("PRIVATE_");
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it.each([
    undefined,
    null,
    7,
    [],
    {},
    "PRIVATE_CODE",
    "planning_failed PRIVATE_TEXT",
    "PLANNING_FAILED",
    "planning_failed\n",
  ])(
    "maps unknown or malformed SSE codes to UNKNOWN without exposing the envelope",
    async (code) => {
      const adapter = make(
        async () =>
          new Response(
            `data: ${JSON.stringify({ error: { code, message: "PRIVATE_MESSAGE" } })}\n\n`,
            { headers: { "Content-Type": "text/event-stream" } }
          )
      );
      await expect(adapter.complete(request)).rejects.toMatchObject({ upstreamCode: "UNKNOWN" });
      expect(adapter.diagnostics.latestFailure()?.upstreamCode).toBe("UNKNOWN");
      expect(JSON.stringify(adapter.diagnostics.snapshot())).not.toContain("PRIVATE_");
    }
  );
  it.each([null, "PRIVATE_ERROR", [], 7])(
    "rejects a malformed error envelope with UNKNOWN",
    async (error) => {
      const adapter = make(
        async () =>
          new Response(`data: ${JSON.stringify({ error })}\n\n`, {
            headers: { "Content-Type": "text/event-stream" },
          })
      );
      await expect(adapter.complete(request)).rejects.toMatchObject({
        reason: "SSE_ERROR_EVENT",
        upstreamCode: "UNKNOWN",
      });
      expect(JSON.stringify(adapter.diagnostics.snapshot())).not.toContain("PRIVATE_");
    }
  );
  it.each([
    [
      "network",
      () => Promise.reject(new Error("PRIVATE_EXCEPTION")),
      "NETWORK_ERROR",
      "http",
      "FETCH_FAILED",
    ],
    [
      "HTTP",
      () => Promise.resolve(new Response("PRIVATE_BODY", { status: 429 })),
      "RATE_LIMITED",
      "http",
      "HTTP_STATUS",
    ],
    [
      "protocol",
      () =>
        Promise.resolve(new Response("PRIVATE_BODY", { headers: { "Content-Type": "text/html" } })),
      "INVALID_RESPONSE",
      "http",
      "HTTP_CONTENT_TYPE",
    ],
    [
      "SSE JSON",
      () =>
        Promise.resolve(
          new Response("data: PRIVATE_JSON\n\n", {
            headers: { "Content-Type": "text/event-stream" },
          })
        ),
      "INVALID_RESPONSE",
      "sse",
      "SSE_JSON",
    ],
    [
      "stream read",
      () =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("PRIVATE_READ"));
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } }
          )
        ),
      "NETWORK_ERROR",
      "sse",
      "STREAM_READ_FAILED",
    ],
  ] as const)(
    "classifies %s and copies only fixed metadata",
    async (_label, fetch, code, phase, reason) => {
      const adapter = make(fetch);
      await expect(adapter.complete(request)).rejects.toMatchObject({ code });
      const record = adapter.diagnostics.latestFailure();
      expect(record).toMatchObject({ code, phase, reason });
      expect(JSON.stringify(record)).not.toContain("PRIVATE_");
      expect(record?.attemptId).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(record!.startedAt).toISOString()).toBe(record!.startedAt);
    }
  );
  it("distinguishes request timeout from user cancellation after a delta, with one POST each", async () => {
    for (const cancel of [false, true]) {
      const abort = new AbortController();
      const fetch = vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(contentEvent("PRIVATE_DELTA")));
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } }
          )
      );
      const adapter = make(fetch, cancel ? 1000 : 20);
      const promise = adapter.complete(request, abort.signal, {
        onTextDelta() {
          if (cancel) abort.abort();
        },
      });
      await expect(promise).rejects.toMatchObject({ code: cancel ? "CANCELLED" : "TIMEOUT" });
      expect(adapter.diagnostics.latestFailure()).toMatchObject({
        phase: "sse",
        reason: cancel ? "CANCELLED" : "REQUEST_TIMEOUT",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(adapter.diagnostics.snapshot())).not.toContain("PRIVATE_");
    }
  });
  it("bounds memory by count and age, rejects arbitrary error reasons, and clears explicitly", () => {
    const history = new AttemptDiagnostics();
    for (let i = 0; i < 8; i++)
      history.finish({
        ...history.begin(),
        schema: 1,
        finishedAt: new Date().toISOString(),
        outcome: "failed",
        code: "INVALID_RESPONSE",
        phase: "sse",
        reason: "SSE_JSON",
      });
    expect(history.snapshot()).toHaveLength(5);
    expect(
      new ChatGatewayError("INVALID_RESPONSE", "PRIVATE_REASON" as never).reason
    ).toBeUndefined();
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(ATTEMPT_TTL_MS + 1);
      expect(history.snapshot()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
    history.clear();
    expect(history.latestFailure()).toBeUndefined();
  });
});

describe("receipt trust boundary", () => {
  it("rejects extra fields, foreign IDs/versions, expired receipts and unknown event metadata", async () => {
    const id = crypto.randomUUID();
    const receipt = {
      attemptId: id,
      frontendVersion: "unbundled-test",
      expiresAt: Date.now() + 60_000,
      events: [{ stage: "upstream_http", at: new Date().toISOString(), httpStatus: 200 }],
    };
    expect(diagnosticReceipt(receipt, id, "unbundled-test")).toEqual(receipt);
    for (const value of [
      { ...receipt, content: "PRIVATE_RAW" },
      { ...receipt, attemptId: crypto.randomUUID() },
      { ...receipt, frontendVersion: "PRIVATE_VERSION" },
      { ...receipt, expiresAt: Date.now() - 1 },
      { ...receipt, events: [{ ...receipt.events[0], text: "PRIVATE_EVENT" }] },
      { ...receipt, events: [{ ...receipt.events[0], stage: "PRIVATE_STAGE" }] },
      { ...receipt, events: [{ ...receipt.events[0], httpStatus: 999 }] },
    ])
      expect(diagnosticReceipt(value, id, "unbundled-test")).toBeUndefined();
  });
});
