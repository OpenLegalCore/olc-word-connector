import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("navigates only after an exact-origin native challenge to the fixed auth path", async () => {
  let receive!: (event: Record<string, unknown>) => void;
  const replace = vi.fn();
  vi.stubGlobal("Office", {
    onReady: async () => {},
    EventType: { DialogParentMessageReceived: "message" },
    context: {
      ui: {
        addHandlerAsync: (_type: string, handler: typeof receive) => {
          receive = handler;
        },
      },
    },
  });
  const origin = "https://word.example.invalid";
  vi.stubGlobal("location", {
    origin,
    replace,
    search: "?return=https://other.invalid",
    hash: "#ignored",
  });
  await import("../../src/taskpane/signin.js");
  await vi.waitFor(() => expect(receive).toBeTypeOf("function"));
  const value = { type: "olc-word-authorize", challenge: "c".repeat(43), state: "s".repeat(43) };
  receive({ origin: "https://other.invalid", message: JSON.stringify(value) });
  receive({ origin, message: JSON.stringify({ ...value, redirect: "https://other.invalid" }) });
  expect(replace).not.toHaveBeenCalled();
  receive({ origin, message: JSON.stringify(value) });
  receive({ origin, message: JSON.stringify(value) });
  expect(replace).toHaveBeenCalledExactlyOnceWith(
    origin + `/word-auth/authorize?challenge=${value.challenge}&state=${value.state}`
  );
});
