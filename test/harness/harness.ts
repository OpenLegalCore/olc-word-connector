import { TaskPaneController } from "../../src/app/TaskPaneController";
import { ProductionTaskPaneRuntime } from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import canonicalMarkUrl from "../../assets/openlegalcore-mark-80.png";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import { bindHarness } from "./bindHarness";
import { bindTaskPaneStateGallery } from "./taskPaneGallery";
import { ProposalPreviewGateway } from "./ProposalPreviewGateway";
import { SyntheticProposalWord } from "./SyntheticProposalWord";

const initialText = "Selected text for local development.";
const word = new FakeWordAdapter({
  snapshotId: "harness-0",
  text: initialText,
  characterCount: initialText.length,
  context: "body",
  capturedAt: new Date(0).toISOString(),
});
const chat = new FakeChatGateway({ text: "Synthetic legal-source answer." });
const controller = new TaskPaneController(word, chat);

const previewRoot = document.getElementById("runtime-preview-pane");
if (previewRoot) {
  const previewWord = new SyntheticProposalWord();
  const params = new URLSearchParams(window.location.search);
  const previewGateway = new ProposalPreviewGateway(
    params.get("proposal") === "explicit",
    params.get("scenario") === "partial-error"
  );
  const syntheticDocument = document.getElementById("synthetic-document");
  previewWord.onChange = () => {
    if (syntheticDocument) syntheticDocument.textContent = previewWord.documentText;
  };
  previewWord.onChange();
  for (const mode of ["original", "cursor", "other"] as const) {
    document
      .getElementById(`synthetic-${mode}`)
      ?.addEventListener("click", () => previewWord.choose(mode));
  }
  document.getElementById("synthetic-drift")?.addEventListener("click", () => previewWord.drift());
  document.getElementById("synthetic-undo")?.addEventListener("click", () => previewWord.undo());
  document.getElementById("synthetic-redo")?.addEventListener("click", () => previewWord.redo());
  const previewRuntime = new ProductionTaskPaneRuntime(
    previewRoot,
    new TaskPaneView(previewRoot, canonicalMarkUrl),
    previewWord,
    { olcEngine: Object.assign(previewGateway, { disconnect: () => undefined }) },
    "STAGING",
    undefined,
    () => false,
    "sl-SI"
  );
  previewRuntime.start();
}

bindTaskPaneStateGallery(document, window);
bindHarness(document, controller, word, chat);
