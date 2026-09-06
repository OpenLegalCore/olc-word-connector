import { afterEach, expect, it, vi } from "vitest";

import { TaskPaneController } from "../../src/app/TaskPaneController";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import { bindHarness } from "./bindHarness";

afterEach(() => vi.unstubAllGlobals());

function renderHarness(): void {
  document.body.innerHTML = `
    <textarea id="selected-text">Harness selection</textarea>
    <input id="question" value="Harness legal question">
    <input id="selected-context" type="checkbox">
    <textarea id="fake-response">Harness answer</textarea>
    <input id="delay" value="0">
    <input id="gateway-error" type="checkbox">
    <button id="search">Search</button>
    <button id="cancel"></button>
    <button id="reset"></button>
    <div id="answer"></div><div id="state"></div><div id="error"></div><div id="calls"></div>
  `;
}

function setupHarness() {
  renderHarness();
  const word = new FakeWordAdapter({
    snapshotId: "initial",
    text: "",
    characterCount: 0,
    context: "body",
    capturedAt: "2026-08-31T00:00:00.000Z",
  });
  const chat = new FakeChatGateway({ text: "Harness answer" });
  const controller = new TaskPaneController(word, chat);
  const unsubscribe = bindHarness(document, controller, word, chat);
  return { word, chat, controller, unsubscribe };
}

it("binds a no-context beta search without Office.js or HTTP", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { word, chat, unsubscribe } = setupHarness();
  document.getElementById("search")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("answer")!.textContent).toBe("Harness answer")
  );
  expect(word.captureCalls).toBe(0);
  expect(chat.requests[0]).toMatchObject({
    question: "Harness legal question",
    context: { type: "none" },
  });
  expect(fetch).not.toHaveBeenCalled();
  expect((globalThis as { Office?: unknown }).Office).toBeUndefined();
  unsubscribe();
});

it("captures selected context only when explicitly checked and recovers from an error", async () => {
  const { word, controller, unsubscribe } = setupHarness();
  (document.getElementById("selected-context") as HTMLInputElement).checked = true;
  (document.getElementById("gateway-error") as HTMLInputElement).checked = true;
  document.getElementById("search")!.click();
  await vi.waitFor(() => expect(controller.getState().kind).toBe("error"));
  expect(word.captureCalls).toBe(1);

  (document.getElementById("gateway-error") as HTMLInputElement).checked = false;
  document.getElementById("reset")!.click();
  document.getElementById("search")!.click();
  await vi.waitFor(() => expect(controller.getState().kind).toBe("result"));
  expect(word.captureCalls).toBe(2);
  expect(word.applyCalls).toHaveLength(0);
  unsubscribe();
});
