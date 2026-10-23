/* global Office */

import { bootstrapWordHarness } from "./bootstrapWordHarness";
import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import { ProductionTaskPaneRuntime } from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { ProposalPreviewGateway } from "../harness/ProposalPreviewGateway";

void Office.onReady((info) => {
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
