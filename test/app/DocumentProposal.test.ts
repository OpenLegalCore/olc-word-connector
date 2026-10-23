import { describe, expect, it, vi } from "vitest";
import { TaskPaneController } from "../../src/app/TaskPaneController";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import type { DocumentProposal } from "../../src/chat/DocumentProposal";
import { WordAdapterError } from "../../src/office/WordAdapter";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import { FakeChatGateway } from "../fakes/FakeChatGateway";

const selection = {
  snapshotId: "original",
  text: "Exact original",
  characterCount: 14,
  context: "body" as const,
  capturedAt: "2026-10-23T00:00:00.000Z",
};
const proposal: DocumentProposal = {
  text: "Exact proposal [literal text]",
  language: "sl",
  changeSummary: "Synthetic change",
};
function setup(value: DocumentProposal | null = proposal) {
  const word = new FakeWordAdapter(selection);
  const writer = { applyReplacement: vi.fn(async () => {}), insertAtCursor: vi.fn(async () => {}) };
  const editingWord = Object.assign(word, { documentWriter: writer });
  const chat = new FakeChatGateway({
    text: "Explanation [Z1] and sources",
    proposal: value,
    usage: null,
  });
  const controller = new TaskPaneController(editingWord, chat);
  const input = {
    question: "Synthetic revision",
    selection: { ...selection },
    uiLocale: "sl-SI" as const,
  };
  return { word, writer, chat, controller, input };
}

describe("explicit document proposal lifecycle", () => {
  it("keeps explanation separate and retains the request target until one explicit replacement", async () => {
    const s = setup();
    await s.controller.search(s.input);
    s.input.selection.text = "Mutated caller copy";
    expect(s.word.releaseCalls).toHaveLength(0);
    expect(s.writer.applyReplacement).not.toHaveBeenCalled();
    expect(await s.controller.applyProposal("replace")).toBe(true);
    expect(s.writer.applyReplacement).toHaveBeenCalledWith(selection, proposal.text);
    expect(s.controller.getState()).toMatchObject({
      kind: "result",
      documentChange: { status: "applied" },
    });
    expect(await s.controller.applyProposal("insert")).toBe(false);
    expect(await s.controller.applyProposal("replace")).toBe(false);
    expect(s.writer.insertAtCursor).not.toHaveBeenCalled();
    expect(s.word.releaseCalls).toHaveLength(1);
  });

  it("uses only the explicit proposal for cursor insertion with no captured selection", async () => {
    const s = setup();
    await s.controller.search({ ...s.input, selection: undefined });
    expect(await s.controller.applyProposal("replace")).toBe(false);
    expect(await s.controller.applyProposal("insert")).toBe(true);
    expect(s.writer.insertAtCursor).toHaveBeenCalledWith(proposal.text);
    expect(s.word.captureCalls).toBe(0);
  });

  it("locks both actions during a write and never repeats an unconfirmed write", async () => {
    const s = setup();
    let fail: () => void = () => {};
    s.writer.insertAtCursor.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = () => reject(new Error("unknown host outcome"));
        })
    );
    await s.controller.search(s.input);
    const pending = s.controller.applyProposal("insert");
    expect(await s.controller.applyProposal("insert")).toBe(false);
    expect(s.controller.reset()).toBe(false);
    fail();
    expect(await pending).toBe(false);
    expect(await s.controller.applyProposal("replace")).toBe(false);
    expect(s.writer.insertAtCursor).toHaveBeenCalledTimes(1);
    expect(s.controller.getState()).toMatchObject({
      documentChange: { status: "failed", error: "WORD_WRITE_FAILED" },
    });
  });

  it.each(["SELECTION_CHANGED", "CURSOR_REQUIRED"] as const)(
    "contains %s without enabling another write",
    async (code) => {
      const s = setup();
      s.writer.applyReplacement.mockRejectedValue(new WordAdapterError(code));
      await s.controller.search(s.input);
      expect(await s.controller.applyProposal("replace")).toBe(false);
      expect(await s.controller.applyProposal("insert")).toBe(false);
      expect(s.controller.getState()).toMatchObject({
        documentChange: { status: "failed", error: code },
      });
    }
  );

  it("does not extract a proposal from headings, citations or a normal answer", async () => {
    const s = setup(null);
    s.chat.result = { text: "## Proposed text\nUse me [Z1]", proposal: null };
    await s.controller.search(s.input);
    expect(await s.controller.applyProposal("replace")).toBe(false);
    expect(s.writer.applyReplacement).not.toHaveBeenCalled();
    expect(s.word.releaseCalls).toHaveLength(1);
  });

  it.each([
    { ...proposal, language: "en" },
    { ...proposal, text: "" },
    { ...proposal, text: "unsafe\u0000" },
    { ...proposal, text: "ž".repeat(16_385) },
    { ...proposal, extra: "not in normalized contract" },
  ])("fails closed on an invalid explicit proposal", async (invalid) => {
    const s = setup(invalid as DocumentProposal);
    expect(await s.controller.search(s.input)).toBe(false);
    expect(s.controller.getState()).toMatchObject({
      kind: "error",
      error: { code: "INVALID_RESPONSE" },
    });
    expect(await s.controller.applyProposal("insert")).toBe(false);
    expect(s.word.releaseCalls).toHaveLength(1);
  });

  it("releases a retained result on reset and disposal", async () => {
    const s = setup();
    await s.controller.search(s.input);
    s.controller.reset();
    expect(s.word.releaseCalls).toHaveLength(1);
    await s.controller.search(s.input);
    s.controller.dispose();
    expect(s.word.releaseCalls).toHaveLength(2);
    expect(await s.controller.applyProposal("insert")).toBe(false);
  });

  it("cannot write after a completion failure", async () => {
    const s = setup();
    s.chat.error = new ChatGatewayError("TIMEOUT");
    await s.controller.search(s.input);
    expect(await s.controller.applyProposal("insert")).toBe(false);
    expect(s.writer.insertAtCursor).not.toHaveBeenCalled();
  });

  it("ignores a late explicit proposal after cancel, including late deltas", async () => {
    const s = setup();
    let finish: (value: { text: string; proposal: DocumentProposal }) => void = () => {};
    s.chat.complete = async (_request, _signal, observer) => {
      observer?.onTextDelta?.("partial explanation");
      return await new Promise((resolve) => {
        finish = (value) => {
          observer?.onTextDelta?.("late delta after cancellation");
          resolve(value);
        };
      });
    };
    const pending = s.controller.search(s.input);
    expect(s.controller.getState()).toMatchObject({ kind: "searching" });
    expect(await s.controller.applyProposal("replace")).toBe(false);
    await s.controller.cancel();
    finish({ text: "late", proposal });
    expect(await pending).toBe(false);
    expect(s.controller.getState()).toEqual({ kind: "ready" });
    expect(await s.controller.applyProposal("insert")).toBe(false);
    expect(s.writer.applyReplacement).not.toHaveBeenCalled();
    expect(s.word.releaseCalls).toHaveLength(1);
  });
});
