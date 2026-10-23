import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkProtectedSession,
  requestPaneCookieAccess,
} from "../../src/taskpane/protectedSession";

afterEach(() => vi.useRealTimers());
describe("pane access boundary", () => {
  it("times out even when a transport ignores abort and cancels a late body", async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    const pending = checkProtectedSession(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const failure = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15000);
    await failure;
    const cancel = vi.fn();
    finish(new Response(new ReadableStream({ cancel })));
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("requires a gateway-marked landing from the pane, cancels the body and sends no credentials in headers", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), {
      headers: { "Content-Type": "text/html", "X-OLC-Word-Gateway": "1" },
    });
    const fetch = vi.fn(async () => response);
    await checkProtectedSession(fetch);
    expect(fetch).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        redirect: "manual",
        cache: "no-store",
        headers: { Accept: "text/html" },
      })
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it.each([
    [302, {}, "SESSION_EXPIRED"],
    [401, {}, "SESSION_EXPIRED"],
    [403, { "Content-Type": "text/plain" }, "ACCESS_DENIED"],
    [200, { "Content-Type": "text/html" }, "SESSION_EXPIRED"],
    [200, { "Content-Type": "application/json", "X-OLC-Word-Gateway": "1" }, "INVALID_RESPONSE"],
  ])(
    "fails closed on %s without treating cookie permission as authentication",
    async (status, headers, code) => {
      const fetch = vi.fn(
        async () =>
          new Response(null, { status: status as number, headers: headers as HeadersInit })
      );
      await expect(checkProtectedSession(fetch)).rejects.toMatchObject({ code });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it("does not fetch after cancellation and bounds an outstanding read", async () => {
    const abort = new AbortController();
    abort.abort();
    const fetch = vi.fn(async () => new Response());
    await expect(checkProtectedSession(fetch, abort.signal)).rejects.toMatchObject({
      code: "CANCELLED",
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.useFakeTimers();
    const pending = checkProtectedSession(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(new Error("abort")))
        )
    );
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
  it("requests only app cookie access on a direct call, verifies the grant, and fails closed on denial/unsupported hosts", async () => {
    const request = vi.fn(async () => undefined);
    const has = vi.fn(async () => true);
    const document = {
      requestStorageAccess: request,
      hasStorageAccess: has,
    } as unknown as Document;
    const result = requestPaneCookieAccess(document);
    expect(request).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toBe(true);
    request.mockRejectedValueOnce(new Error("denied"));
    await expect(requestPaneCookieAccess(document)).resolves.toBe(false);
    await expect(requestPaneCookieAccess({} as Document)).resolves.toBe(false);
    has.mockResolvedValueOnce(false);
    await expect(requestPaneCookieAccess(document)).resolves.toBe(false);
  });
});
