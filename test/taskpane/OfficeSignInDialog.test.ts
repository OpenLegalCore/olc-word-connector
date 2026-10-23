import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeSignInDialog, secureSignInOrigin } from "../../src/taskpane/OfficeSignInDialog";
import { handleRequest } from "../../infrastructure/cloudflare/word-gateway-example/worker.js";
import { runInNewContext } from "node:vm";

const origin = "https://word.example.invalid";
const nonce = "ab".repeat(16);
const originalOffice = Object.getOwnPropertyDescriptor(globalThis, "Office");
const handlers = new Map<string, (event: unknown) => void>();
const close = vi.fn();
const messageChild = vi.fn();
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
      messageChild,
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
  messageChild.mockReset();
  Object.defineProperty(globalThis, "Office", {
    configurable: true,
    value: {
      AsyncResultStatus: { Succeeded: "succeeded" },
      EventType: { DialogMessageReceived: "message", DialogEventReceived: "event" },
      context: { requirements: { isSetSupported: () => true } },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  if (originalOffice) Object.defineProperty(globalThis, "Office", originalOffice);
  else Reflect.deleteProperty(globalThis, "Office");
});
describe("Office sign-in lifecycle", () => {
  it("checks native dialog capability before opening, without a storage or popup fallback", async () => {
    const office = globalThis as unknown as {
      Office: { context: { requirements: { isSetSupported: (set: string) => boolean } } };
    };
    office.Office.context.requirements.isSetSupported = (set) => set !== "DialogOrigin";
    await expect(new OfficeSignInDialog(origin, ui, () => nonce).open()).resolves.toBe("failed");
    expect(display).not.toHaveBeenCalled();
  });
  it.each(["parent-first", "child-first"])(
    "completes the actual gateway callback with a lost fragment and %s readiness",
    async (order) => {
      vi.useFakeTimers();
      const page = await handleRequest(
        new Request(origin + "/api/session"),
        {
          PUBLIC_HOST: "word.example.invalid",
          ENGINE_ORIGIN: "https://engine.example.invalid",
          ENGINE_API_KEY: "synthetic",
          CF_ACCESS_CLIENT_ID: "synthetic",
          CF_ACCESS_CLIENT_SECRET: "synthetic",
        },
        vi.fn()
      );
      const script = (await page.text()).match(/<script>([\s\S]+?)<\/script>/)![1];
      let childReceive: ((event: unknown) => void) | undefined;
      const runChild = async (): Promise<void> => {
        runInNewContext(script, {
          location: { origin, hash: "" },
          Office: {
            AsyncResultStatus: { Succeeded: "succeeded" },
            EventType: { DialogParentMessageReceived: "parent" },
            onReady: async () => undefined,
            context: {
              ui: {
                addHandlerAsync: (
                  _type: string,
                  handler: (event: unknown) => void,
                  done: (value: unknown) => void
                ) => {
                  childReceive = handler;
                  done({ status: "succeeded" });
                },
                messageParent: (payload: string, options: { targetOrigin: string }) => {
                  expect(options.targetOrigin).toBe(origin);
                  message({ message: payload });
                },
              },
            },
          },
        });
        await Promise.resolve();
      };
      messageChild.mockImplementation((payload, options) => {
        expect(options.targetOrigin).toBe(origin);
        childReceive?.({ origin, message: payload });
      });
      const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
      let outcome: unknown;
      const pending = signIn.open().then((value) => {
        outcome = value;
      });
      try {
        if (order === "child-first") await runChild();
        opened();
        if (order === "parent-first") await runChild();
        await vi.advanceTimersByTimeAsync(500);
        expect(outcome).toBe("completed");
        await pending;
        expect(close).toHaveBeenCalledTimes(1);
        const count = messageChild.mock.calls.length;
        await vi.advanceTimersByTimeAsync(5000);
        expect(messageChild).toHaveBeenCalledTimes(count);
      } finally {
        signIn.close();
      }
    }
  );

  it("fails closed when the host lacks parent-to-dialog messaging", async () => {
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const result = signIn.open();
    callback({ status: "succeeded", value: { close, addEventHandler: vi.fn() } });
    await expect(result).resolves.toBe("failed");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("opens only same-origin HTTPS in a top-level Office dialog and accepts a bound landing message", async () => {
    const signIn = new OfficeSignInDialog(origin, ui, () => nonce);
    const result = signIn.open();
    opened();
    expect(display).toHaveBeenCalledWith(
      `${origin}/signin.html`,
      expect.objectContaining({ displayInIframe: false, promptBeforeOpen: true }),
      expect.any(Function)
    );
    message();
    await expect(result).resolves.toBe("completed");
    expect(close).toHaveBeenCalledTimes(1);
    expect(messageChild).toHaveBeenCalledWith(
      JSON.stringify({ type: "olc-word-session-challenge", nonce }),
      { targetOrigin: origin }
    );
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
    message({ message: null });
    message({ message: 123 });
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
