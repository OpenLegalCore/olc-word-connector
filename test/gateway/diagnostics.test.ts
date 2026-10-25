// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse } from "miniflare";
import { DiagnosticTrace } from "../../infrastructure/cloudflare/word-session/diagnostics.js";
import { wordApi } from "../../infrastructure/cloudflare/word-session/api-worker.js";
import { digest, random, store } from "../../infrastructure/cloudflare/word-session/common.js";
import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { WordSessionClient } from "../../src/taskpane/WordSessionClient";
import { diagnosticReceipt } from "../../src/chat/diagnostics";
import { contentEvent, documentOnlyFixture, successTerminal } from "../fixtures/documentReview";
const origin = "https://word.example.invalid";
const request = {
  question: "PRIVATE_QUESTION_SENTINEL",
  context: { type: "selected_text" as const, quotedText: "PRIVATE_SELECTION_SENTINEL" },
  uiLocale: "sl-SI" as const,
};
const sse = (text: string) =>
  new Response(text, { headers: { "Content-Type": "text/event-stream" } });
let mf: Miniflare;
let env: Record<string, unknown>;
const tasks: Promise<unknown>[] = [];
const context = {
  waitUntil: (pending: Promise<unknown>) => {
    tasks.push(pending);
  },
};
async function flushed() {
  while (tasks.length) await Promise.all(tasks.splice(0));
}
beforeAll(async () => {
  const result = await build({
    stdin: {
      contents:
        'export { WordSessionStore } from "./infrastructure/cloudflare/word-session/store.js"; export { default } from "./infrastructure/cloudflare/word-session/api-worker.js";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    write: false,
  });
  env = {
    PUBLIC_ORIGIN: origin,
    ENGINE_ORIGIN: "https://engine.example.invalid",
    ENGINE_API_KEY: "PRIVATE_ENGINE_KEY_SENTINEL",
    CF_ACCESS_CLIENT_ID: "synthetic-client",
    CF_ACCESS_CLIENT_SECRET: "PRIVATE_ACCESS_SECRET_SENTINEL",
  };
  mf = new Miniflare({
    modules: true,
    script: result.outputFiles[0].text,
    compatibilityDate: "2026-07-30",
    durableObjects: { WORD_SESSIONS: { className: "WordSessionStore", useSQLite: true } },
    bindings: env,
    outboundService: async () =>
      new WorkerResponse(contentEvent("{}"), { headers: { "Content-Type": "text/event-stream" } }),
  });
  env.WORD_SESSIONS = await mf.getDurableObjectNamespace("WORD_SESSIONS");
}, 30_000);
afterAll(async () => {
  await flushed();
  await mf?.dispose();
});
async function capability() {
  const verifier = random(),
    state = random();
  const issued = await store(env, "issue", {
    origin,
    challenge: await digest(verifier),
    state,
    identityExpiresAt: Date.now() + 3600_000,
    client: random(),
  });
  expect(issued.status).toBe(200);
  const code = (await issued.json()).code;
  return { code, verifier, state };
}
async function fixture(upstream: (request: Request) => Promise<Response>) {
  const upstreamFetch = vi.fn(upstream);
  const calls: { path: string; method: string; attemptId: string | null }[] = [];
  const send = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Origin", origin);
    headers.set("CF-Connecting-IP", random());
    calls.push({ path, method: init.method ?? "GET", attemptId: headers.get("X-OLC-Attempt-ID") });
    return wordApi(
      new Request(origin + path, { ...init, headers }),
      env,
      upstreamFetch as typeof fetch,
      undefined,
      context
    );
  };
  const client = new WordSessionClient(send);
  await client.exchange(...(Object.values(await capability()) as [string, string, string]));
  const adapter = new OpenAICompatibleAdapter(
    {
      transport: "same-origin",
      modelId: "lexai-engine-local",
      responseProfile: "document-review",
      requestTimeoutMs: 1000,
    },
    { fetch: client.fetch }
  );
  return { adapter, client, calls, upstreamFetch };
}
describe("bounded authenticated diagnostics using actual adapters, API gateway and SQLite store", () => {
  it.each([
    [
      "upstream HTTP",
      () => new Response("PRIVATE_UPSTREAM_BODY", { status: 503 }),
      "HTTP_STATUS",
      "http",
      502,
      "upstream_http",
      503,
    ],
    [
      "upstream network",
      () => {
        throw new Error("PRIVATE_NETWORK_MESSAGE");
      },
      "HTTP_STATUS",
      "http",
      502,
      "upstream_unavailable",
      undefined,
    ],
    [
      "SSE error after delta",
      () =>
        sse(
          contentEvent('{"status":"ANSWER","claims":[],"notice":"PRIVATE_MODEL_SENTINEL"') +
            'data: {"error":{"code":"PRIVATE_ERROR_MESSAGE"}}\n\n'
        ),
      "SSE_ERROR_EVENT",
      "sse",
      200,
      "upstream_http",
      200,
    ],
    [
      "missing DONE",
      () => sse(contentEvent("{}")),
      "SSE_INCOMPLETE",
      "sse",
      200,
      "upstream_http",
      200,
    ],
    [
      "DONE without stop",
      () => sse("data: [DONE]\n\n"),
      "SSE_DONE_WITHOUT_STOP",
      "sse",
      200,
      "upstream_http",
      200,
    ],
    [
      "invalid result",
      () => sse(contentEvent("{}") + successTerminal),
      "DOC_SCHEMA_KEYS",
      "result_validation",
      200,
      "upstream_http",
      200,
    ],
    [
      "wrong language",
      () => sse(contentEvent(JSON.stringify(documentOnlyFixture("en", false))) + successTerminal),
      "PROPOSAL_LANGUAGE",
      "result_validation",
      200,
      "upstream_http",
      200,
    ],
  ] as const)(
    "joins %s without leaking content or claiming transport/model equivalence",
    async (_label, response, reason, phase, status, stage, upstreamStatus) => {
      const { adapter, client, calls, upstreamFetch } = await fixture(async (upstream) => {
        expect(upstream.headers.has("X-OLC-Attempt-ID")).toBe(false);
        expect(upstream.headers.has("X-OLC-Frontend-Version")).toBe(false);
        expect(upstream.headers.has("Cookie")).toBe(false);
        expect(upstream.headers.get("Authorization")).toBe("Bearer PRIVATE_ENGINE_KEY_SENTINEL");
        return response();
      });
      await expect(adapter.complete(request)).rejects.toMatchObject({ code: expect.any(String) });
      await flushed();
      const diagnostic = adapter.diagnostics.latestFailure()!;
      expect(diagnostic).toMatchObject({
        reason,
        phase,
        httpStatus: status,
        frontendVersion: "unbundled-test",
      });
      expect(calls.find((call) => call.path.endsWith("completions"))?.attemptId).toBe(
        diagnostic.attemptId
      );
      const receipt = await client.diagnostic(diagnostic.attemptId, diagnostic.frontendVersion);
      expect(receipt?.attemptId).toBe(diagnostic.attemptId);
      expect(receipt?.events).toContainEqual(
        expect.objectContaining({
          stage,
          ...(upstreamStatus === undefined ? {} : { httpStatus: upstreamStatus }),
        })
      );
      if (status === 200)
        expect(receipt?.events.some((event) => event.stage.startsWith("transfer_"))).toBe(true);
      const text = JSON.stringify({ diagnostic, receipt });
      for (const sentinel of [
        request.question,
        request.context.quotedText,
        "PRIVATE_MODEL_SENTINEL",
        "PRIVATE_ERROR_MESSAGE",
        "PRIVATE_NETWORK_MESSAGE",
        "PRIVATE_ENGINE_KEY_SENTINEL",
        "PRIVATE_ACCESS_SECRET_SENTINEL",
        "PRIVATE_UPSTREAM_BODY",
      ])
        expect(text).not.toContain(sentinel);
      expect(upstreamFetch).toHaveBeenCalledTimes(1);
      expect(
        calls.filter((call) => call.method === "POST" && call.path.endsWith("completions"))
      ).toHaveLength(1);
      const other = await fixture(async () => sse(""));
      expect(
        await other.client.diagnostic(diagnostic.attemptId, diagnostic.frontendVersion)
      ).toBeUndefined();
    }
  );
  it("records validated stop/DONE success separately from the observed transport end", async () => {
    const { adapter, client } = await fixture(async () =>
      sse(contentEvent(JSON.stringify(documentOnlyFixture("sl", false))) + successTerminal)
    );
    const result = await adapter.complete(request);
    expect(result.proposal?.text).toBeTruthy();
    expect(result.text).toBe("");
    expect(adapter.diagnostics.latestFailure()).toBeUndefined();
    const success = adapter.diagnostics.snapshot()[0];
    expect(success).toMatchObject({
      outcome: "validated",
      code: "OK",
      phase: "complete",
      reason: "VALIDATED_STOP_DONE",
    });
    await flushed();
    const receipt = await client.diagnostic(success.attemptId, success.frontendVersion);
    expect(receipt?.events.map((event) => event.stage)).toContain("upstream_http");
    expect(JSON.stringify(receipt)).not.toContain("VALIDATED");
  });
  it("serves the metadata endpoint through the real workerd default handler, with no unauthenticated lookup", async () => {
    const id = crypto.randomUUID();
    const issued = await store(env, "microsoft", {
      origin,
      client: random(),
      principal: "synthetic",
      clientId: "synthetic",
      audience: "synthetic",
      identityExpiresAt: Date.now() + 3600_000,
    });
    const token = (await issued.json()).token;
    const headers = {
      Origin: origin,
      Authorization: `Bearer ${token}`,
      "X-OLC-Attempt-ID": id,
      "X-OLC-Frontend-Version": "unbundled-test",
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    const response = await mf.dispatchFetch(origin + "/word-api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "lexai-engine-local",
        stream: true,
        response_language: "sl",
        messages: [{ role: "user", content: "PRIVATE_REAL_RUNTIME_SENTINEL" }],
      }),
    });
    expect(response.status).toBe(200);
    await response.text();
    await vi.waitFor(async () => {
      const read = await mf.dispatchFetch(origin + "/word-api/diagnostic", { headers });
      const value = (await read.json()) as { record: unknown };
      const receipt = diagnosticReceipt(value.record, id, "unbundled-test");
      expect(receipt?.events.map((event) => event.stage)).toEqual([
        "accepted",
        "upstream_http",
        "response_http",
        "transfer_closed",
      ]);
      expect(read.headers.get("Cache-Control")).toBe("no-store");
      expect(JSON.stringify(value)).not.toContain("PRIVATE_REAL_RUNTIME_SENTINEL");
    });
    expect(
      (
        await mf.dispatchFetch(origin + "/word-api/diagnostic", {
          headers: { "X-OLC-Attempt-ID": id },
        })
      ).status
    ).toBe(401);
    await store(env, "revoke", { token, origin });
    expect((await mf.dispatchFetch(origin + "/word-api/diagnostic", { headers })).status).toBe(401);
  });
});

describe("diagnostic retention and transfer boundaries", () => {
  it("observes downstream cancellation and body read errors without persisting either error text or bytes", async () => {
    for (const failure of [false, true]) {
      let pulls = 0;
      const setup = await fixture(
        async () =>
          new Response(
            new ReadableStream({
              pull(controller) {
                if (++pulls === 1)
                  controller.enqueue(new TextEncoder().encode("data: PRIVATE_TRANSFER\n\n"));
                else if (failure) controller.error(new Error("PRIVATE_STREAM_FAILURE"));
                // Otherwise stay open until the test cancels the downstream body.
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } }
          )
      );
      // Use the authenticated transport directly to observe transport independently of parsing.
      const id = crypto.randomUUID();
      const response = await setup.client.fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-OLC-Attempt-ID": id,
          "X-OLC-Frontend-Version": "unbundled-test",
        },
        body: JSON.stringify({
          model: "lexai-engine-local",
          stream: true,
          response_language: "sl",
          messages: [{ role: "user", content: "PRIVATE_REQUEST" }],
        }),
      });
      if (failure) await expect(response.text()).rejects.toThrow("TRANSFER_ERROR");
      else {
        const reader = response.body!.getReader();
        await reader.read();
        await reader.cancel();
      }
      await flushed();
      const receipt = await setup.client.diagnostic(id, "unbundled-test");
      expect(receipt?.events.map((event) => event.stage)).toContain(
        failure ? "transfer_error" : "transfer_cancelled"
      );
      expect(JSON.stringify(receipt)).not.toContain("PRIVATE_");
    }
  });
  it("caps the actual SQLite receipt collection, rejects content fields, and binds reads to the capability", async () => {
    const session = await store(env, "microsoft", {
      origin,
      client: random(),
      principal: "synthetic",
      clientId: "synthetic",
      audience: "synthetic",
      identityExpiresAt: Date.now() + 3600_000,
    });
    const token = (await session.json()).token;
    const first = crypto.randomUUID();
    let last = first;
    for (let index = 0; index < 66; index++) {
      last = index === 0 ? first : crypto.randomUUID();
      const write = await store(env, "diagnostic-write", {
        token,
        origin,
        attemptId: last,
        frontendVersion: "unbundled-test",
        event: { stage: "accepted", at: new Date().toISOString() },
      });
      expect(write.status).toBe(200);
    }
    const old = await store(env, "diagnostic-read", { token, origin, attemptId: first });
    expect(await old.json()).toEqual({ record: null });
    const read = await store(env, "diagnostic-read", { token, origin, attemptId: last });
    const receipt = (await read.json()).record;
    expect(receipt.expiresAt).toBeGreaterThan(Date.now());
    expect(receipt.expiresAt).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
    const auth = { token, origin, attemptId: last, frontendVersion: "unbundled-test" };
    expect(
      (
        await store(env, "diagnostic-write", {
          ...auth,
          event: { stage: "accepted", at: new Date().toISOString(), text: "PRIVATE_CONTENT" },
        })
      ).status
    ).toBe(400);
    for (let index = 0; index < 4; index++)
      expect(
        (
          await store(env, "diagnostic-write", {
            ...auth,
            event: { stage: "accepted", at: new Date().toISOString() },
          })
        ).status
      ).toBe(200);
    expect(
      (
        await store(env, "diagnostic-write", {
          ...auth,
          event: { stage: "accepted", at: new Date().toISOString() },
        })
      ).status
    ).toBe(400);
    const value = await store(env, "diagnostic-read", { token, origin, attemptId: last });
    expect((await value.json()).record.events).toHaveLength(5);
    await store(env, "revoke", { token, origin });
    expect((await store(env, "diagnostic-read", { token, origin, attemptId: last })).status).toBe(
      401
    );
  });
});

it("contains diagnostic storage/lifecycle failures without throwing into the functional request", async () => {
  const trace = new DiagnosticTrace(
    {
      WORD_SESSIONS: {
        idFromName() {
          throw new Error("PRIVATE_STORAGE_ERROR");
        },
      },
    },
    {
      waitUntil() {
        throw new Error("PRIVATE_CONTEXT_ERROR");
      },
    }
  );
  expect(() =>
    trace.activate("synthetic", origin, crypto.randomUUID(), "unbundled-test")
  ).not.toThrow();
  await expect(trace.pending).resolves.toBeUndefined();
});
