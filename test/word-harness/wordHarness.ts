/* global Office */

import { bootstrapWordHarness } from "./bootstrapWordHarness";
import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import { ProductionTaskPaneRuntime } from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { ProposalPreviewGateway } from "../harness/ProposalPreviewGateway";
import { bindReadOnlyReplaceExport } from "./ReadOnlyReplaceExport";

void Office.onReady((info) => {
  // This mode returns before the normal harness or proposal runtime is composed.
  if (
    new URLSearchParams(window.location.search).get("replaceProbe") === "export" ||
    document.querySelector('meta[name="olc74-readonly-export"]')?.getAttribute("content") === "1"
  ) {
    if (info.host !== Office.HostType.Word) {
      document.getElementById("bootstrap-error")!.textContent = "WORD_HOST_REQUIRED";
      return;
    }
    bindReadOnlyReplaceExport(document);
    return;
  }
  const proposalRoot = document.getElementById("word-proposal-runtime");
  if (new URLSearchParams(window.location.search).get("proposal") === "explicit" && proposalRoot) {
    if (info.host !== Office.HostType.Word) return;
    document.getElementById("harness-content")!.hidden = true;
    proposalRoot.hidden = false;
    new ProductionTaskPaneRuntime(
      proposalRoot,
      new TaskPaneView(proposalRoot),
      new OfficeWordAdapter(),
      { olcEngine: new ProposalPreviewGateway(true) },
      "DEVELOPMENT",
      undefined,
      () => false,
      "sl-SI"
    ).start();
    return;
  }
  bootstrapWordHarness(document, {
    wordHost: Office.HostType.Word,
    onReady: (callback) => callback({ host: info.host }),
  });
});
