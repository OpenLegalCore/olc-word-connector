import { TaskPaneController } from "../../src/app/TaskPaneController";
import type { AppState } from "../../src/app/state";
import { FakeChatGateway } from "../fakes/FakeChatGateway";

export interface ControllerHarnessOptions {
  readonly prepareSearch?: () => void;
  readonly describeCalls?: () => readonly string[];
}

function element<T extends HTMLElement>(root: Document, id: string): T {
  const value = root.getElementById(id);
  if (!value) {
    throw new Error(`Harness element is missing: ${id}`);
  }
  return value as T;
}

function optionalElement<T extends HTMLElement>(root: Document, id: string): T | undefined {
  return (root.getElementById(id) as T | null) ?? undefined;
}

export function bindControllerHarness(
  root: Document,
  controller: TaskPaneController,
  chat: FakeChatGateway,
  options: ControllerHarnessOptions = {}
): () => void {
  const question = element<HTMLInputElement>(root, "question");
  const selectedContext = element<HTMLInputElement>(root, "selected-context");
  const fakeResponse = element<HTMLTextAreaElement>(root, "fake-response");
  const delay = element<HTMLInputElement>(root, "delay");
  const gatewayError = element<HTMLInputElement>(root, "gateway-error");
  const search = element<HTMLButtonElement>(root, "search");
  const cancel = element<HTMLButtonElement>(root, "cancel");
  const reset = element<HTMLButtonElement>(root, "reset");
  const answer = element<HTMLElement>(root, "answer");
  const stateOutput = element<HTMLElement>(root, "state");
  const errorOutput = element<HTMLElement>(root, "error");
  const calls = optionalElement<HTMLElement>(root, "calls");

  const showCalls = (): void => {
    if (calls) {
      calls.textContent = options.describeCalls?.().join("\n") ?? "";
    }
  };

  const render = (state: AppState): void => {
    stateOutput.textContent = state.kind;
    errorOutput.textContent = state.kind === "error" ? state.error.code : "";
    answer.textContent = state.kind === "result" ? state.result.text : "";
    search.disabled = state.kind !== "ready";
    cancel.disabled = state.kind !== "capturing" && state.kind !== "searching";
    reset.disabled = state.kind !== "error" && state.kind !== "result";
    showCalls();
  };

  const finish = (operation: Promise<unknown>): void => {
    void operation.catch(() => undefined).then(showCalls);
  };
  const unsubscribe = controller.subscribe(render);

  search.addEventListener("click", () => {
    options.prepareSearch?.();
    chat.result = { text: fakeResponse.value };
    chat.delayMs = Number(delay.value) || 0;
    chat.error = gatewayError.checked ? new Error("Controlled harness failure") : undefined;
    finish(
      controller.search({
        question: question.value,
        contextMode: selectedContext.checked ? "selected-text" : "none",
        uiLocale: "en-US",
      })
    );
  });
  cancel.addEventListener("click", () => finish(controller.cancel()));
  reset.addEventListener("click", () => {
    controller.reset();
    showCalls();
  });

  return unsubscribe;
}
