/* global Blob, URL */

import { createReadOnlyReplaceProbe } from "./ReadOnlyReplaceProbe";

// Opt-in native Word harness only. No controller, gateway, Apply or clipboard.
export function bindReadOnlyReplaceExport(
  root: Document,
  probe = createReadOnlyReplaceProbe()
): void {
  const main = root.querySelector("main");
  if (!main) throw new Error("WORD_HARNESS_ROOT_MISSING");
  const heading = root.createElement("h1");
  heading.textContent = "Read-only Replace OOXML export — new diagnostic capture";
  const capture = root.createElement("button");
  capture.textContent = "Capture read-only OOXML once";
  const status = root.createElement("p");
  status.id = "readonly-export-status";
  status.textContent = "ready";
  const result = root.createElement("pre");
  result.id = "readonly-export-observation";
  const evidenceText = root.createElement("pre");
  evidenceText.id = "readonly-export-evidence-json";
  const download = root.createElement("a");
  download.textContent = "Download private OOXML evidence JSON";
  download.download = "olc74-readonly-ooxml-evidence.json";
  download.hidden = true;
  main.replaceChildren(heading, capture, status, result, evidenceText, download);

  // One capture per page instance, even after an error. No implicit cleanup.
  let attempted = false;
  capture.addEventListener("click", () => {
    if (attempted) return;
    attempted = true;
    capture.disabled = true;
    status.textContent = "capturing";
    void (async () => {
      try {
        await probe.capture();
        const observation = await probe.inspect();
        result.textContent = JSON.stringify(observation);
        const evidence = probe.readOoxml();
        if (!evidence) {
          status.textContent = "error-no-ooxml-evidence";
          return;
        }
        // Synthetic test document only: expose the first exact triple as plain text.
        const json = JSON.stringify(evidence);
        evidenceText.textContent = json;
        const file = new Blob([json], { type: "application/json" });
        download.href = URL.createObjectURL(file);
        download.hidden = false;
        status.textContent = "ready-download";
      } catch {
        // Office exception messages can contain private data.
        status.textContent = "error-capture-or-export";
      }
    })();
  });
}
