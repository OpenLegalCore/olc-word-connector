import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeSignInDialog, secureSignInOrigin } from "../../src/taskpane/OfficeSignInDialog";

const origin = "https://word.example.invalid";
const nonce = "ab".repeat(16);
const originalOffice = Object.getOwnPropertyDescriptor(globalThis, "Office");
const handlers = new Map<string, (event: unknown) => void>();
const close = vi.fn();
let callback: (result: unknown) => void;
const display = vi.fn((_url, _options, done) => {
  callback = done;
});
const ui = { displayDialogAsync: display } as unknown as Pick<Office.UI, "displayDialogAsync">;
function opened(): void {
  callback({
    status: "succeeded",
    value: {
      close,
      addEventHandler: (type: string, handler: (event: unknown) => void) =>
        handlers.set(type, handler),
    },
  });
}
function message(overrides = {}): void {
  handlers.get("message")?.({
    origin,
    message: JSON.stringify({ type: "olc-word-session-landing", nonce }),
    ...overrides,
  });
}
beforeEach(() => {
  handlers.clear();
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "Office", {
    configurable: true,
    value: {
      AsyncResultStatus: { Succeeded: "succeeded" },
      EventType: { DialogMessageReceived: "message", DialogEventReceived: "event" },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  if (originalOffice) Object.defineProperty(globalThis, "Office", originalOffice);
  else Reflect.deleteProperty(globalThis, "Office");
});
describe("Office sign-in lifecycle", () => {
  it("opens only same-origin HTTPS in a top-level Office dialog and accepts a bound landing message", async () => {
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const result = signIn.open();
    opened();
    expect(display).toHaveBeenCalledWith(
      `${origin}/signin.html#${nonce}`,
      expect.objectContaining({ displayInIframe: false, promptBeforeOpen: true }),
      expect.any(Function)
    );
    message();
    await expect(result).resolves.toBe("completed");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("ignores wrong/missing origins, nonce, extra fields and malformed messages", async () => {
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const result = signIn.open();
    opened();
    message({ origin: "https://other.example.invalid" });
    message({ origin: undefined });
    message({
      message: JSON.stringify({ type: "olc-word-session-landing", nonce: "00".repeat(16) }),
    });
    message({
      message: JSON.stringify({ type: "olc-word-session-landing", nonce, success: true }),
    });
    message({ message: "null" });
    message({ message: "[" });
    expect(close).not.toHaveBeenCalled();
    message();
    await expect(result).resolves.toBe("completed");
  });
  it("closes a late-created dialog after cancellation, without accepting its messages", async () => {
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const result = signIn.open();
    signIn.close();
    opened();
    await expect(result).resolves.toBe("closed");
    expect(close).toHaveBeenCalledTimes(1);
    expect(handlers.size).toBe(0);
  });
  it("bounds the wait, permits one dialog, and handles user close/error without claiming authentication", async () => {
    vi.useFakeTimers();
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const first = signIn.open();
    opened();
    await expect(signIn.open()).resolves.toBe("failed");
    await vi.advanceTimersByTimeAsync(300000);
    await expect(first).resolves.toBe("failed");
    const second = signIn.open();
    opened();
    handlers.get("event")?.({ error: 12006 });
    await expect(second).resolves.toBe("closed");
    const third = signIn.open();
    callback({ status: "failed" });
    await expect(third).resolves.toBe("failed");
  });
  it.each([
    "http://example.invalid",
    "https://user@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid:8443",
  ])("rejects unsafe origin %s without opening anything", async (unsafe) => {
    expect(() => secureSignInOrigin(unsafe)).toThrow();
    await expect(new OfficeSignInDialog(unsafe, ui).open()).resolves.toBe("failed");
    expect(display).not.toHaveBeenCalled();
  });
});
