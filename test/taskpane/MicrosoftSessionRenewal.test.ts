// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
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
    acquire: vi.fn(async () => ({
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
describe("renewable Word capability", () => {
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
