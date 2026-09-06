import { TaskPaneController } from "../../src/app/TaskPaneController";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import { bindControllerHarness } from "./bindControllerHarness";

function element<T extends HTMLElement>(root: Document, id: string): T {
  const value = root.getElementById(id);
  if (!value) {
    throw new Error(`Harness element is missing: ${id}`);
  }
  return value as T;
}

export function bindHarness(
  root: Document,
  controller: TaskPaneController,
  word: FakeWordAdapter,
  chat: FakeChatGateway
): () => void {
  const selectedText = element<HTMLTextAreaElement>(root, "selected-text");
  return bindControllerHarness(root, controller, chat, {
    prepareSearch: () => {
      word.snapshot = {
        snapshotId: `harness-${word.captureCalls + 1}`,
        text: selectedText.value,
        characterCount: selectedText.value.length,
        context: "body",
        capturedAt: new Date(0).toISOString(),
      };
    },
    describeCalls: () => [
      `captureSelection: ${word.captureCalls}`,
      `complete: ${chat.requests.length}`,
    ],
  });
}
