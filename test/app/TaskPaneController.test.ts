import { describe, expect, it } from "vitest";

import { TaskPaneController, type SearchInput } from "../../src/app/TaskPaneController";
import type { ChatGateway, CompletionRequest, CompletionResult } from "../../src/chat/ChatGateway";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import { WordAdapterError, type SelectionSnapshot } from "../../src/office/WordAdapter";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";

const snapshot: SelectionSnapshot = {
  snapshotId: "snapshot-1",
  text: "Izbrano besedilo je citirani podatek.",
  characterCount: 36,
  context: "body",
  capturedAt: "2026-08-31T00:00:00.000Z",
};

const noContextInput: SearchInput = {
  question: "Kateri zakon velja za ta primer?",
  contextMode: "none",
  uiLocale: "sl-SI",
};

const selectedTextInput: SearchInput = {
  ...noContextInput,
  contextMode: "selected-text",
};

function setup(result: CompletionResult = { text: "Odgovor [Z1]\n\n## Sources\n- [Z1] Vir" }) {
  const word = new FakeWordAdapter(snapshot);
  const chat = new FakeChatGateway(result);
  const controller = new TaskPaneController(word, chat);
  return { word, chat, controller };
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("TaskPaneController legal-source contract", () => {
  it("searches with no document context by default without reading Word", async () => {
    const { word, chat, controller } = setup();

    expect(await controller.search(noContextInput)).toBe(true);
    expect(word.captureCalls).toBe(0);
    expect(word.releaseCalls).toHaveLength(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(chat.requests).toEqual([
      {
        question: noContextInput.question,
        context: { type: "none" },
        uiLocale: "sl-SI",
      },
    ]);
    expect(controller.getState()).toMatchObject({ kind: "result" });
  });

  it("captures only after an explicit selected-text search and sends quoted context", async () => {
    const { word, chat, controller } = setup();
    expect(word.captureCalls).toBe(0);

    expect(await controller.search(selectedTextInput)).toBe(true);

    expect(word.captureCalls).toBe(1);
    expect(word.releaseCalls).toEqual([snapshot]);
    expect(chat.requests).toEqual([
      {
        question: selectedTextInput.question,
        context: { type: "selected_text", quotedText: snapshot.text },
        uiLocale: "sl-SI",
      },
    ]);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("keeps the exact legal question unchanged", async () => {
    const { chat, controller } = setup();
    const exactQuestion = "  Ali je veljal Zakon A leta 2012?\nPrimerjaj s sodbo.  ";

    await controller.search({ ...noContextInput, question: exactQuestion });

    expect(chat.requests[0].question).toBe(exactQuestion);
  });

  it("publishes independent copies of request and result state", async () => {
    const { controller } = setup({
      text: "Varen odgovor",
      model: "fixture-model",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });
    const observed: string[] = [];
    controller.subscribe((state) => {
      if (state.kind === "result") {
        (state.result as { text: string }).text = "mutated";
      }
    });
    controller.subscribe((state) => {
      if (state.kind === "result") {
        observed.push(state.result.text);
      }
    });

    await controller.search(noContextInput);

    expect(observed).toEqual(["Varen odgovor"]);
    expect(controller.getState()).toMatchObject({
      kind: "result",
      result: { text: "Varen odgovor", model: "fixture-model" },
    });
  });

  it("contains capture and completion failures without mutating Word", async () => {
    const capture = setup();
    capture.word.captureError = new WordAdapterError("NO_SELECTION");
    expect(await capture.controller.search(selectedTextInput)).toBe(false);
    expect(capture.controller.getState()).toEqual({
      kind: "error",
      error: { code: "NO_SELECTION" },
    });

    for (const code of ["SESSION_EXPIRED", "TIMEOUT", "SERVICE_UNAVAILABLE"] as const) {
      const completion = setup();
      completion.chat.error = new ChatGatewayError(code);
      expect(await completion.controller.search(noContextInput)).toBe(false);
      expect(completion.controller.getState()).toEqual({ kind: "error", error: { code } });
      expect(completion.word.applyCalls).toHaveLength(0);
    }
  });

  it("cancels an active search and releases selected context", async () => {
    const { word, chat, controller } = setup();
    chat.delayMs = 50;
    const search = controller.search(selectedTextInput);
    await settle();
    expect(controller.getState().kind).toBe("searching");

    expect(await controller.cancel()).toBe(true);

    expect(chat.completionSignals[0]?.aborted).toBe(true);
    expect(await search).toBe(false);
    expect(controller.getState()).toEqual({ kind: "ready" });
    expect(word.releaseCalls).toEqual([snapshot]);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("ignores a late completion after cancellation", async () => {
    let resolveCompletion: (result: CompletionResult) => void = () => undefined;
    const requests: CompletionRequest[] = [];
    const chat: ChatGateway = {
      async checkConnection() {},
      complete(request) {
        requests.push(request);
        return new Promise((resolve) => {
          resolveCompletion = resolve;
        });
      },
    };
    const word = new FakeWordAdapter(snapshot);
    const controller = new TaskPaneController(word, chat);
    const search = controller.search(noContextInput);
    await settle();

    await controller.cancel();
    resolveCompletion({ text: "Late answer" });

    expect(await search).toBe(false);
    expect(requests).toHaveLength(1);
    expect(controller.getState()).toEqual({ kind: "ready" });
    expect(word.applyCalls).toHaveLength(0);
  });

  it("rejects overlapping searches and resets only terminal states", async () => {
    const { chat, controller } = setup();
    chat.delayMs = 20;
    const first = controller.search(noContextInput);

    expect(await controller.search(noContextInput)).toBe(false);
    expect(controller.reset()).toBe(false);
    expect(await first).toBe(true);
    expect(controller.reset()).toBe(true);
    expect(controller.getState()).toEqual({ kind: "ready" });
  });

  it("removes a subscriber that throws without disrupting the search", async () => {
    const { controller } = setup();
    let calls = 0;
    controller.subscribe(() => {
      calls++;
      throw new Error("controlled subscriber failure");
    });

    expect(await controller.search(noContextInput)).toBe(true);
    expect(calls).toBe(1);
    expect(controller.getState().kind).toBe("result");
  });
});
