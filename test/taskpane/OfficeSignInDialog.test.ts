// @vitest-environment node
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OfficeSignInDialog,
  secureSignInOrigin,
  type CodeExchange,
} from "../../src/taskpane/OfficeSignInDialog";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";

const origin = "https://word.example.invalid";
let handlers: Record<string, (event: Record<string, unknown>) => void>;
let dialog: {
  close: ReturnType<typeof vi.fn>;
  messageChild: ReturnType<typeof vi.fn>;
  addEventHandler: ReturnType<typeof vi.fn>;
};
let ui: Pick<Office.UI, "displayDialogAsync">;
beforeEach(() => {
  handlers = {};
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: () => true } },
    AsyncResultStatus: { Succeeded: "succeeded" },
    EventType: { DialogMessageReceived: "message", DialogEventReceived: "event" },
  });
  dialog = {
    close: vi.fn(),
    messageChild: vi.fn(),
    addEventHandler: vi.fn((type, handler) => {
      handlers[type] = handler;
    }),
  };
  ui = {
    displayDialogAsync: vi.fn((_url, _options, callback) =>
      callback!({
        status: "succeeded",
        value: dialog,
      } as unknown as Office.AsyncResult<Office.Dialog>)
    ) as unknown as Office.UI["displayDialogAsync"],
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function challenge(): Promise<{ type: string; state: string; challenge: string }> {
  await vi.waitFor(() => expect(dialog.messageChild).toHaveBeenCalled());
  return JSON.parse(dialog.messageChild.mock.calls[0][0]);
}
const message = (state: string, extra = {}, source: string | undefined = origin): void =>
  handlers.message({
    origin: source,
    message: JSON.stringify({ type: "olc-word-authorized", state, code: "c".repeat(43), ...extra }),
  });
describe("Office PKCE sign-in", () => {
  it("accepts an origin/state-bound authorization denial without attempting exchange", async () => {
    const exchange = vi.fn<CodeExchange>(async () => {});
    const signIn = new OfficeSignInDialog(origin, ui),
      pending = signIn.open(exchange);
    const value = await challenge();
    handlers.message({
      origin,
      message: JSON.stringify({ type: "olc-word-authorization-denied", state: "x".repeat(43) }),
    });
    handlers.message({
      origin,
      message: JSON.stringify({ type: "olc-word-authorization-denied", state: value.state }),
    });
    await expect(pending).resolves.toBe("denied");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("opens the fixed bootstrap synchronously; exchanges only exact-origin/state/shape and matching S256", async () => {
    const exchange = vi.fn<CodeExchange>(async () => {}),
      signIn = new OfficeSignInDialog(origin, ui);
    const result = signIn.open(exchange);
    expect(ui.displayDialogAsync).toHaveBeenCalledWith(
      origin + "/signin.html",
      expect.objectContaining({ displayInIframe: false, promptBeforeOpen: true }),
      expect.any(Function)
    );
    const value = await challenge();
    handlers.message({
      message: JSON.stringify({
        type: "olc-word-authorized",
        state: value.state,
        code: "c".repeat(43),
      }),
    });
    message(value.state, {}, "https://other.example.invalid");
    message("x".repeat(43));
    message(value.state, { extra: true });
    handlers.message({ origin, message: "invalid" });
    expect(exchange).not.toHaveBeenCalled();
    message(value.state);
    message(value.state);
    await expect(result).resolves.toBe("completed");
    expect(exchange).toHaveBeenCalledTimes(1);
    const verifier = exchange.mock.calls[0]![1];
    expect(
      Buffer.from(
        await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
      ).toString("base64url")
    ).toBe(value.challenge);
    expect(dialog.messageChild.mock.calls[0][1]).toEqual({ targetOrigin: origin });
    expect(dialog.close).toHaveBeenCalledTimes(1);
  });
  it.each(["closed", "denied", "expired", "failed"] as const)(
    "distinguishes %s and never accepts a late message",
    async (outcome) => {
      const exchange = vi.fn(async () => {
        throw new ChatGatewayError(
          outcome === "denied"
            ? "ACCESS_DENIED"
            : outcome === "expired"
              ? "SESSION_EXPIRED"
              : "NETWORK_ERROR"
        );
      });
      const signIn = new OfficeSignInDialog(origin, ui),
        result = signIn.open(exchange),
        value = await challenge();
      if (outcome === "closed") handlers.event({ error: 12006 });
      else message(value.state);
      await expect(result).resolves.toBe(outcome);
      message(value.state);
      expect(exchange).toHaveBeenCalledTimes(outcome === "closed" ? 0 : 1);
    }
  );
  it("rejects concurrent attempts; cancellation aborts an exchange and closes late windows", async () => {
    let signal!: AbortSignal;
    const signIn = new OfficeSignInDialog(origin, ui);
    const result = signIn.open(async (_c, _v, _s, abort) => {
      signal = abort;
      await new Promise(() => {});
    });
    await expect(signIn.open(async () => {})).resolves.toBe("failed");
    const value = await challenge();
    message(value.state);
    signIn.close();
    await expect(result).resolves.toBe("closed");
    expect(signal.aborted).toBe(true);
  });
  it("bounds the login window and treats Office Ignore as closed", async () => {
    vi.useFakeTimers();
    const signIn = new OfficeSignInDialog(origin, ui),
      result = signIn.open(async () => {});
    await vi.advanceTimersByTimeAsync(300_001);
    await expect(result).resolves.toBe("failed");
    ui.displayDialogAsync = vi.fn((_url, _options, callback) =>
      callback!({
        status: "failed",
        error: { code: 12009 },
      } as unknown as Office.AsyncResult<Office.Dialog>)
    ) as unknown as Office.UI["displayDialogAsync"];
    await expect(signIn.open(async () => {})).resolves.toBe("closed");
  });
  it.each([
    "http://word.example.invalid",
    origin + "/",
    origin + ":443",
    "https://user@word.example.invalid",
  ])("rejects unsafe origin %s", (value) => {
    expect(() => secureSignInOrigin(value)).toThrow();
  });
});
