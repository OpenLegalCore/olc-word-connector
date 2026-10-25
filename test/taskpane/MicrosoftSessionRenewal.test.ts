// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { setImmediate } from "node:timers/promises";
import { WordSessionClient } from "../../src/taskpane/WordSessionClient";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
const response = (status = 200, token = "a".repeat(43)) =>
  Response.json(
    { token, expiresAt: Date.now() + 15 * 60_000, scope: "word:models word:complete" },
    { status, headers: { "X-OLC-Word-Gateway": "1" } }
  );
afterEach(() => vi.useRealTimers());
function setup() {
  const identity = {
    acquire: vi.fn<
      (
        interactive?: boolean,
        forceRefresh?: boolean
      ) => Promise<{ accessToken: string; expiresAt: number }>
    >(async () => ({
      accessToken: "synthetic-api-token",
      expiresAt: Date.now() + 3600_000,
    })),
    close: vi.fn(),
  };
  const send = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    response()
  );
  return { identity, send, session: new WordSessionClient(send, identity) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function concurrentRequests() {
  const { session, send, identity } = setup();
  await session.authenticate();
  const renewal = deferred<{ accessToken: string; expiresAt: number }>();
  const started = deferred<void>();
  const originals = [deferred<Response>(), deferred<Response>()];
  const headers: (string | null)[] = [];
  identity.acquire.mockImplementation(async (_interactive?: boolean, force?: boolean) => {
    if (force) {
      started.resolve();
      return renewal.promise;
    }
    return { accessToken: "synthetic-api-token", expiresAt: Date.now() + 3600_000 };
  });
  send.mockClear();
  let original = 0;
  send.mockImplementation(async (url, init) => {
    if (url === "/word-api/session/microsoft") return response(200, "b".repeat(43));
    const authorization = new Headers(init?.headers).get("Authorization");
    headers.push(authorization);
    if (original < 2) return originals[original++].promise;
    return response(authorization === `Bearer ${"b".repeat(43)}` ? 200 : 401);
  });
  const abort = [new AbortController(), new AbortController()];
  const requests = ["/v1/models", "/session"].map((url, index) =>
    session.fetch(url, { signal: abort[index].signal })
  );
  // Attach rejection handlers before releasing responses, including the RED run.
  const results = Promise.allSettled(requests);
  await setImmediate();
  expect(headers).toEqual(Array(2).fill(`Bearer ${"a".repeat(43)}`));
  return {
    session,
    send,
    identity,
    renewal,
    started,
    originals,
    headers,
    abort,
    requests,
    results,
  };
}

describe("renewable Word capability", () => {
  it.each([0, 1])("shares renewal when original GET %i returns 401 first", async (first) => {
    const run = await concurrentRequests();
    run.originals[first].resolve(response(401));
    await run.started.promise;
    run.originals[1 - first].resolve(response(401));
    // Drain both response handlers while Microsoft renewal remains held.
    await setImmediate();
    const beforeRelease = [...run.headers];
    run.renewal.resolve({ accessToken: "renewed-api-token", expiresAt: Date.now() + 3600_000 });
    const results = await run.results;
    expect(beforeRelease).toEqual(Array(2).fill(`Bearer ${"a".repeat(43)}`));
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(run.headers).toEqual([
      `Bearer ${"a".repeat(43)}`,
      `Bearer ${"a".repeat(43)}`,
      `Bearer ${"b".repeat(43)}`,
      `Bearer ${"b".repeat(43)}`,
    ]);
    expect(run.identity.acquire.mock.calls.filter((call) => call[1] === true)).toEqual([
      [false, true],
    ]);
    expect(run.identity.acquire.mock.calls.every((call) => call[0] === false)).toBe(true);
  });
  it("uses the newer capability for a delayed original 401 without another renewal", async () => {
    const run = await concurrentRequests();
    run.originals[0].resolve(response(401));
    await run.started.promise;
    run.renewal.resolve({ accessToken: "renewed-api-token", expiresAt: Date.now() + 3600_000 });
    await run.requests[0];
    run.originals[1].resolve(response(401));
    expect((await run.results).map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(run.headers.slice(2)).toEqual(Array(2).fill(`Bearer ${"b".repeat(43)}`));
    expect(run.identity.acquire.mock.calls.filter((call) => call[1] === true)).toHaveLength(1);
  });
  it.each(["identity", "capability"])(
    "shares a failed %s renewal without retrying either GET",
    async (failure) => {
      const run = await concurrentRequests();
      if (failure === "capability") {
        const send = run.send.getMockImplementation()!;
        run.send.mockImplementation((url, init) =>
          url === "/word-api/session/microsoft" ? Promise.resolve(response(401)) : send(url, init)
        );
      }
      run.originals[0].resolve(response(401));
      await run.started.promise;
      run.originals[1].resolve(response(401));
      await setImmediate();
      if (failure === "identity") run.renewal.reject(new ChatGatewayError("SESSION_EXPIRED"));
      else
        run.renewal.resolve({ accessToken: "renewed-api-token", expiresAt: Date.now() + 3600_000 });
      expect(await run.results).toEqual([
        {
          status: "rejected",
          reason: expect.objectContaining({
            code: failure === "identity" ? "SESSION_EXPIRED" : "ACCESS_DENIED",
          }),
        },
        {
          status: "rejected",
          reason: expect.objectContaining({
            code: failure === "identity" ? "SESSION_EXPIRED" : "ACCESS_DENIED",
          }),
        },
      ]);
      expect(run.headers).toEqual(Array(2).fill(`Bearer ${"a".repeat(43)}`));
      expect(run.identity.acquire.mock.calls.filter((call) => call[1] === true)).toHaveLength(1);
      expect(run.identity.acquire.mock.calls.every((call) => call[0] === false)).toBe(true);
    }
  );
  it.each([0, 1])(
    "cancels waiter %i promptly without cancelling the shared renewal",
    async (cancelled) => {
      const run = await concurrentRequests();
      run.originals[0].resolve(response(401));
      await run.started.promise;
      run.originals[1].resolve(response(401));
      await setImmediate();
      run.abort[cancelled].abort();
      await expect(run.requests[cancelled]).rejects.toMatchObject({ code: "CANCELLED" });
      run.renewal.resolve({ accessToken: "renewed-api-token", expiresAt: Date.now() + 3600_000 });
      const results = await run.results;
      expect(results[1 - cancelled].status).toBe("fulfilled");
      expect(run.headers).toEqual([
        `Bearer ${"a".repeat(43)}`,
        `Bearer ${"a".repeat(43)}`,
        `Bearer ${"b".repeat(43)}`,
      ]);
      expect(run.identity.acquire.mock.calls.filter((call) => call[1] === true)).toHaveLength(1);
    }
  );
  it("does not erase a newer session when an older retry finally returns 401", async () => {
    const { session, send, identity } = setup();
    await session.authenticate();
    const retry = deferred<Response>();
    const retryStarted = deferred<void>();
    const tokens = ["b".repeat(43), "c".repeat(43)];
    let get = 0;
    send.mockImplementation(async (url) => {
      if (url === "/word-api/session/microsoft") return response(200, tokens.shift());
      if (get++ === 0) return response(401);
      retryStarted.resolve();
      return retry.promise;
    });
    const pending = session.fetch("/v1/models");
    const result = Promise.allSettled([pending]);
    await retryStarted.promise;
    await session.authenticate(false, true);
    retry.resolve(response(401));
    expect(await result).toEqual([
      { status: "rejected", reason: expect.objectContaining({ code: "ACCESS_DENIED" }) },
    ]);
    send.mockClear();
    send.mockResolvedValue(response());
    await session.fetch("/session");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe("/word-api/session");
    expect(new Headers(send.mock.calls[0][1]?.headers).get("Authorization")).toBe(
      `Bearer ${"c".repeat(43)}`
    );
    expect(identity.acquire.mock.calls.every((call) => call[0] === false)).toBe(true);
  });
  it("coalesces simultaneous startup/renewals, then silently reacquires after 15 minutes and in a new pane", async () => {
    vi.useFakeTimers();
    const { session, identity, send } = setup();
    await Promise.all(Array.from({ length: 10 }, () => session.authenticate()));
    expect(identity.acquire).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    await Promise.all([session.authenticate(), session.authenticate()]);
    expect(identity.acquire).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    await new WordSessionClient(send, identity).authenticate();
    expect(identity.acquire).toHaveBeenCalledTimes(3);
    expect(
      send.mock.calls.every(
        ([url, init]) =>
          url === "/word-api/session/microsoft" &&
          init?.body === "{}" &&
          init?.credentials === "omit"
      )
    ).toBe(true);
  });
  it("renews a revoked discovery capability once, never an automatic completion replay", async () => {
    const { session, send } = setup();
    await session.authenticate();
    send.mockClear();
    send
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response(401));
    await expect(session.fetch("/v1/models")).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(send).toHaveBeenCalledTimes(3);
    send.mockClear();
    send.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(401));
    await expect(
      session.fetch("/v1/chat/completions", { method: "POST", body: "synthetic-test-only" })
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("requires interaction without a timer retry or completion and rejects late renewal after dispose", async () => {
    const { session, identity, send } = setup();
    identity.acquire.mockRejectedValueOnce(new ChatGatewayError("SESSION_EXPIRED"));
    await expect(session.authenticate()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(send).not.toHaveBeenCalled();
    let finish!: (value: { accessToken: string; expiresAt: number }) => void;
    identity.acquire.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const pending = session.authenticate();
    session.clear();
    finish({ accessToken: "synthetic", expiresAt: Date.now() + 3600_000 });
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    expect(send).not.toHaveBeenCalled();
  });
});
