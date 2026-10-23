import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("same-origin sign-in bootstrap", () => {
  it("waits for Office then uses only the fixed session path, ignoring URL query/fragment inputs", async () => {
    vi.resetModules();
    let ready!: () => void;
    const replace = vi.fn();
    vi.stubGlobal("Office", {
      onReady: () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        }),
    });
    vi.stubGlobal("location", {
      origin: "https://word.example.invalid",
      search: "?return_url=https://other.example.invalid",
      hash: "#old-fragment",
      replace,
    });
    await import("../../src/taskpane/signin.js");
    expect(replace).not.toHaveBeenCalled();
    ready();
    await vi.waitFor(() =>
      expect(replace).toHaveBeenCalledWith("https://word.example.invalid/api/session")
    );
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
