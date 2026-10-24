// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { WordSessionClient } from "../../src/taskpane/WordSessionClient";
const value = "t".repeat(43),
  code = "c".repeat(43),
  verifier = "v".repeat(43),
  state = "s".repeat(43);
const response = (
  status = 200,
  body: unknown = {
    token: value,
    scope: "word:models word:complete",
    expiresAt: Date.now() + 899_000,
  }
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-OLC-Word-Gateway": "1" },
  });
afterEach(() => vi.useRealTimers());
describe("memory-only Word session", () => {
  it("does not call the API before login; authenticates only the exact Word routes, omitting cookies", async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
        response()
      ),
      client = new WordSessionClient(fetch);
    await expect(client.check()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(fetch).not.toHaveBeenCalled();
    await client.exchange(code, verifier, state);
    await client.check();
    await client.fetch("/v1/models");
    for (const [url, init] of fetch.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("manual");
      expect(url).not.toContain(value);
    }
    expect(fetch.mock.calls[1]).toEqual([
      "/word-api/session",
      expect.objectContaining({ headers: expect.any(Headers) }),
    ]);
    expect((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toEqual(
      new Headers({ Accept: "application/json", Authorization: "Bearer " + value })
    );
    await expect(client.fetch("https://other.invalid/v1/models")).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
    client.clear();
    await expect(client.check()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    const reopened = new WordSessionClient(fetch);
    await expect(reopened.check()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
  it.each([
    [401, "SESSION_EXPIRED"],
    [403, "ACCESS_DENIED"],
    [429, "RATE_LIMITED"],
    [503, "SERVICE_UNAVAILABLE"],
    [302, "INVALID_RESPONSE"],
  ])("distinguishes %s as %s", async (status, expected) => {
    const client = new WordSessionClient(async () => response(Number(status)));
    await expect(client.exchange(code, verifier, state)).rejects.toMatchObject({ code: expected });
  });
  it("rejects malformed/oversized tokens, scopes and lifetimes", async () => {
    for (const body of [
      { token: "bad" },
      { token: value, scope: "all", expiresAt: Date.now() + 1000 },
      { token: value, scope: "word:models word:complete", expiresAt: Date.now() + 901_000 },
      { token: value, scope: "word:models word:complete", expiresAt: Date.now() - 1 },
      "x".repeat(2000),
    ]) {
      const client = new WordSessionClient(async () => response(200, body));
      await expect(client.exchange(code, verifier, state)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    }
  });
  it("rejects concurrent exchange, aborts on close and ignores a late successful exchange", async () => {
    let finish!: (result: Response) => void;
    const client = new WordSessionClient(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      ),
      abort = new AbortController();
    const pending = client.exchange(code, verifier, state, abort.signal);
    await expect(client.exchange(code, verifier, state)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
    finish(response());
    await expect(client.check()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
  it("bounds a hung exchange and session check, classifies network errors separately", async () => {
    vi.useFakeTimers();
    let hang = false;
    const client = new WordSessionClient(async () => (hang ? new Promise(() => {}) : response()));
    await client.exchange(code, verifier, state);
    hang = true;
    const pending = expect(client.check()).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15_001);
    await pending;
    const exchange = expect(client.exchange(code, verifier, state)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(15_001);
    await exchange;
    const offline = new WordSessionClient(async () => {
      throw new Error("offline");
    });
    await expect(offline.exchange(code, verifier, state)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});
