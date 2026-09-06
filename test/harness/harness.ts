import { TaskPaneController } from "../../src/app/TaskPaneController";
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

bindTaskPaneStateGallery(document, window);
bindHarness(document, controller, word, chat);
