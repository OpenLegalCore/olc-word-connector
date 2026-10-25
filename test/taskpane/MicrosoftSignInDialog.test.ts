// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicrosoftSignInDialog } from "../../src/taskpane/MicrosoftSignInDialog";
afterEach(() => vi.unstubAllGlobals());
describe("Microsoft Office dialog fallback channel", () => {
  it("accepts only exact origin/state/shape, closes once and ignores late responses", async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const dialog = {
      close: vi.fn(),
      messageChild: vi.fn(),
      addEventHandler: vi.fn((name: string, fn: (event: unknown) => void) => {
        handlers[name] = fn;
      }),
    };
    vi.stubGlobal("Office", {
      context: { requirements: { isSetSupported: () => true } },
      AsyncResultStatus: { Succeeded: "ok" },
      EventType: { DialogMessageReceived: "message", DialogEventReceived: "closed" },
    });
    const display = vi.fn((_url, _options, callback) => callback({ status: "ok", value: dialog }));
    const flow = new MicrosoftSignInDialog("https://word.example.invalid", {
      displayDialogAsync: display,
    } as unknown as Office.UI);
    const result = flow.open();
    handlers.message({
      origin: "https://word.example.invalid",
      message: JSON.stringify({ type: "olc-microsoft-ready" }),
    });
    const { state } = JSON.parse(dialog.messageChild.mock.calls[0][0]);
    const message = {
      type: "olc-microsoft-token",
      state,
      accessToken: "synthetic-api-token",
      expiresAt: Date.now() + 3600_000,
    };
    handlers.message({ origin: "https://other.example.invalid", message: JSON.stringify(message) });
    handlers.message({
      origin: "https://word.example.invalid",
      message: JSON.stringify({ ...message, state: "wrong" }),
    });
    expect(dialog.close).not.toHaveBeenCalled();
    handlers.message({ origin: "https://word.example.invalid", message: JSON.stringify(message) });
    expect(await result).toEqual({
      accessToken: message.accessToken,
      expiresAt: message.expiresAt,
    });
    handlers.closed({ error: 12006 });
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(display.mock.calls[0][0]).toBe("https://word.example.invalid/microsoft-signin.html");
  });
  it("treats Office Ignore as cancellation without creating another dialog", async () => {
    vi.stubGlobal("Office", {
      context: { requirements: { isSetSupported: () => true } },
      AsyncResultStatus: { Succeeded: "ok" },
    });
    const display = vi.fn((_url, _options, callback) =>
      callback({ status: "failed", error: { code: 12009 } })
    );
    const flow = new MicrosoftSignInDialog("https://word.example.invalid", {
      displayDialogAsync: display,
    } as unknown as Office.UI);
    await expect(flow.open()).rejects.toMatchObject({ code: "CANCELLED" });
    expect(display).toHaveBeenCalledOnce();
  });
});
