import { TaskPaneController } from "../../src/app/TaskPaneController";
import type {
  ChatGateway,
  CompletionObserver,
  CompletionRequest,
  CompletionResult,
} from "../../src/chat/ChatGateway";
import { ProductionTaskPaneRuntime } from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import { bindHarness } from "./bindHarness";
import { bindTaskPaneStateGallery } from "./taskPaneGallery";

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

class PreviewGateway implements ChatGateway {
  async checkConnection(): Promise<void> {}

  async complete(
    _request: CompletionRequest,
    signal?: AbortSignal,
    observer?: CompletionObserver
  ): Promise<CompletionResult> {
    const deltas = [
      "## Odgovor\n",
      "Izbrano besedilo je vključeno kot citirani kontekst [Z1].\n\n",
      "## Viri\n- [Z1] [Primer vira](https://pisrs.si/pregledPredpisa?id=ZAKO2008)",
    ];
    for (const delta of deltas) {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 350);
        signal?.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new DOMException("The operation was aborted", "AbortError"));
          },
          { once: true }
        );
      });
      observer?.onTextDelta?.(delta);
    }
    return {
      text: deltas.join(""),
      model: "lexai-engine-local",
      usage: { inputTokens: 84, outputTokens: 47, totalTokens: 131 },
    };
  }
}

const previewRoot = document.getElementById("runtime-preview-pane");
if (previewRoot) {
  const previewSelection = "Najemnik zamuja s plačilom najemnine.";
  const previewWord = new FakeWordAdapter({
    snapshotId: "preview-selection",
    text: previewSelection,
    characterCount: previewSelection.length,
    context: "body",
    capturedAt: new Date(0).toISOString(),
  });
  const previewGateway = new PreviewGateway();
  const previewRuntime = new ProductionTaskPaneRuntime(
    previewRoot,
    new TaskPaneView(previewRoot),
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
