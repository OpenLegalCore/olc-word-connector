import { afterEach, expect, it, vi } from "vitest";
import { FakeOfficeWordRuntime } from "../office/FakeOfficeWordRuntime";
import { bindReadOnlyReplaceExport } from "./ReadOnlyReplaceExport";
import { createReadOnlyReplaceProbe } from "./ReadOnlyReplaceProbe";

afterEach(() => {
  document.body.replaceChildren();
  document.querySelector('meta[name="olc74-readonly-export"]')?.remove();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function render(): void {
  document.body.innerHTML = '<main><p id="bootstrap-error"></p><button>Apply</button></main>';
}

it("exports the exact first triple as plain DOM text and a local Blob without writes", async () => {
  render();
  const host = new FakeOfficeWordRuntime({ text: "Synthetic private selection" });
  const probe = createReadOnlyReplaceProbe(host);
  const capture = vi.spyOn(host, "run");
  let exported: Blob | undefined;
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn((blob: Blob | MediaSource) => {
        exported = blob as Blob;
        return "blob:private-test";
      });
    }
  );
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  bindReadOnlyReplaceExport(document, probe);
  const button = document.querySelector("button")!;
  button.click();
  button.dispatchEvent(new Event("click"));
  await vi.waitFor(() =>
    expect(document.getElementById("readonly-export-status")?.textContent).toBe("ready-download")
  );
  expect(capture).toHaveBeenCalledTimes(1);
  expect(exported?.type).toBe("application/json");
  const data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(exported!);
  });
  expect(JSON.parse(data)).toEqual(probe.readOoxml());
  const evidenceElement = document.getElementById("readonly-export-evidence-json")!;
  expect(JSON.parse(evidenceElement.textContent!)).toEqual(probe.readOoxml());
  expect(evidenceElement.childElementCount).toBe(0);
  expect(document.querySelector("a")?.getAttribute("download")).toBe(
    "olc74-readonly-ooxml-evidence.json"
  );
  expect(document.querySelector("a")?.hidden).toBe(false);
  expect((await probe.inspect()).lifecycle).toBe("active");
  expect(host.mutationCount).toBe(0);
  expect(host.untrackCalls).toBe(0);
  expect(host.selectCalls).toBe(0);
  expect(host.searchCalls).toBe(0);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("does not export, recapture or disclose a private exception after capture fails", async () => {
  render();
  const host = new FakeOfficeWordRuntime({ text: "Synthetic" });
  const probe = createReadOnlyReplaceProbe(host);
  host.failNextSync(new Error("private Office message"));
  bindReadOnlyReplaceExport(document, probe);
  document.querySelector("button")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("readonly-export-status")?.textContent).toBe(
      "error-capture-or-export"
    )
  );
  expect(document.querySelector("button")!.disabled).toBe(true);
  expect(document.querySelector("a")?.hidden).toBe(true);
  expect(document.getElementById("readonly-export-evidence-json")?.textContent).toBe("");
  expect(document.body.textContent).not.toContain("private Office message");
  expect(host.mutationCount).toBe(0);
});

it("stops on an inspect failure without evidence, retaining the diagnostic entry", async () => {
  render();
  const host = new FakeOfficeWordRuntime({ text: "Synthetic" });
  const originalRun = host.runWithRange.bind(host);
  vi.spyOn(host, "runWithRange").mockImplementation(async (range, batch) => {
    host.failNextSync(new Error("controlled"));
    return originalRun(range, batch);
  });
  bindReadOnlyReplaceExport(document, createReadOnlyReplaceProbe(host));
  document.querySelector("button")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("readonly-export-status")?.textContent).toBe(
      "error-no-ooxml-evidence"
    )
  );
  expect(document.querySelector("a")?.hidden).toBe(true);
  expect(host.untrackCalls).toBe(0);
  expect(host.mutationCount).toBe(0);
});

it.each(["query", "local-package-marker"])(
  "delegates to stubbed Word.run in %s mode and excludes normal harness controls",
  async (mode) => {
    render();
    window.history.replaceState(
      null,
      "",
      mode === "query" ? "/?replaceProbe=export&proposal=explicit" : "/?proposal=explicit"
    );
    if (mode === "local-package-marker") {
      const marker = document.createElement("meta");
      marker.name = "olc74-readonly-export";
      marker.content = "1";
      document.head.append(marker);
    }
    const host = new FakeOfficeWordRuntime({ text: "Synthetic" });
    const run = vi.fn(host.run.bind(host));
    const retained = vi.fn(host.runWithRange.bind(host));
    vi.stubGlobal("Word", {
      run: (rangeOrBatch: unknown, batch?: unknown) =>
        batch ? retained(rangeOrBatch as never, batch as never) : run(rangeOrBatch as never),
    });
    vi.stubGlobal("Office", {
      HostType: { Word: "Word" },
      onReady: (callback: (info: { host: string }) => void) => callback({ host: "Word" }),
    });
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:private-test");
      }
    );
    await import("./wordHarness.js");
    expect(document.body.textContent).not.toContain("Apply");
    document.querySelector("button")!.click();
    await vi.waitFor(() =>
      expect(document.getElementById("readonly-export-status")?.textContent).toBe("ready-download")
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(retained).toHaveBeenCalledTimes(1);
    expect(host.mutationCount).toBe(0);
    expect(host.untrackCalls).toBe(0);
  }
);

it("does not compose the exporter outside a Word host", async () => {
  render();
  window.history.replaceState(null, "", "/?replaceProbe=export");
  vi.stubGlobal("Office", {
    HostType: { Word: "Word" },
    onReady: (callback: (info: { host: string }) => void) => callback({ host: "Excel" }),
  });
  await import("./wordHarness.js");
  expect(document.getElementById("bootstrap-error")?.textContent).toBe("WORD_HOST_REQUIRED");
  expect(document.getElementById("readonly-export-status")).toBeNull();
});
