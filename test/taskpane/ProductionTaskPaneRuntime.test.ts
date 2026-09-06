/* global AbortSignal, Element, Event, HTMLAnchorElement, HTMLButtonElement, HTMLElement, HTMLInputElement, HTMLTextAreaElement, Navigator, RequestInit, Response, Window, document, setTimeout, window */

import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "../../src/app/state";
import type { ChatGateway, CompletionRequest, CompletionResult } from "../../src/chat/ChatGateway";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import type { SelectionSnapshot } from "../../src/office/WordAdapter";
import {
  LEGAL_QUESTION_PLACEHOLDER,
  openSecureSignInWindow,
  ProductionTaskPaneRuntime,
  SECURE_SIGN_IN_PATH,
  secureSignInUrlForOrigin,
  DEFAULT_WORD_MODEL_ID,
  createSameOriginProductionGateways,
  type ProductionGateways,
} from "../../src/taskpane/ProductionTaskPaneRuntime";
import type { UiLocale } from "../../src/taskpane/i18n";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";

const snapshot: SelectionSnapshot = {
  snapshotId: "runtime-snapshot",
  text: "Exact selected legal context.",
  characterCount: 29,
  context: "body",
  capturedAt: "2026-08-31T00:00:00.000Z",
};

const ANSWER =
  "## Applicable rule\nThe answer follows **Article 1** [Z1] and judgment [S1].\n\n## Sources\n- [Z1] [Act](https://pisrs.si/pregledPredpisa?id=ZAKO2008)\n- [S1] [Judgment](https://www.sodnapraksa.si/?q=id:example)";
const REFERENCE_ANSWER =
  "## Odgovor\nGlej sodbo [S1].\n\n## Viri\n" +
  "- [VSL sodba III Cp 975/2016][S1]\n" +
  "[S1]: <https://www.sodnapraksa.si/?q=id:example>";

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

class ControlledGateway implements ChatGateway {
  readonly requests: CompletionRequest[] = [];
  readonly signals: Array<AbortSignal | undefined> = [];
  connectionChecks = 0;
  disconnects = 0;
  connectionError?: Error;
  completionError?: Error;
  result: CompletionResult = { text: ANSWER };
  pending = false;
  private lateResolve?: (result: CompletionResult) => void;
  private lateReject?: (reason?: unknown) => void;

  async checkConnection(): Promise<void> {
    this.connectionChecks++;
    if (this.connectionError) {
      throw this.connectionError;
    }
  }

  complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    this.requests.push(request);
    this.signals.push(signal);
    if (this.completionError) {
      return Promise.reject(this.completionError);
    }
    if (this.pending) {
      return new Promise((resolve, reject) => {
        this.lateResolve = resolve;
        this.lateReject = reject;
      });
    }
    return Promise.resolve(this.result);
  }

  resolveLate(): void {
    this.lateResolve?.({ text: "Late answer" });
  }

  rejectLate(reason: unknown): void {
    this.lateReject?.(reason);
  }

  disconnect(): void {
    this.disconnects++;
  }
}

function root(): HTMLElement {
  return document.getElementById("taskpane-root")!;
}

function click(actionId: string): void {
  const button = root().querySelector<HTMLButtonElement>(`button[data-action-id="${actionId}"]`);
  if (!button) {
    throw new Error(`Missing runtime action: ${actionId}`);
  }
  button.click();
}

function viewState(): string | undefined {
  return root().querySelector<HTMLElement>(".olc-app")?.dataset.viewState;
}

function setQuestion(value: string): void {
  root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")!.value = value;
}

function selectContext(value: "none" | "selected-text"): void {
  const input = root().querySelector<HTMLInputElement>(
    `input[name="runtime-context"][value="${value}"]`
  )!;
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setup(
  options: {
    readonly clipboard?: Pick<Navigator["clipboard"], "writeText">;
    readonly openSignIn?: () => boolean;
    readonly locale?: UiLocale;
  } = {}
) {
  const word = new FakeWordAdapter({
    ...snapshot,
    officeProxy: { forbidden: true },
  } as SelectionSnapshot);
  const openWebUI = new ControlledGateway();
  const olcEngine = new ControlledGateway();
  const gateways: ProductionGateways = { openWebUI, olcEngine };
  const runtime = new ProductionTaskPaneRuntime(
    root(),
    new TaskPaneView(root()),
    word,
    gateways,
    "STAGING",
    options.clipboard,
    options.openSignIn,
    options.locale
  );
  runtime.start();
  return { word, openWebUI, olcEngine, runtime };
}

function selectLocale(locale: UiLocale): void {
  root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();
  const input = root().querySelector<HTMLInputElement>(
    `input[name="olc-ui-language"][value="${locale}"]`
  )!;
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function focusSettingsControl(selector: string): HTMLElement {
  root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();
  const control = root().querySelector<HTMLElement>(selector)!;
  control.focus();
  expect(document.activeElement).toBe(control);
  return control;
}

function emitControllerState(runtime: ProductionTaskPaneRuntime, state: AppState): void {
  const controller = (
    runtime as unknown as {
      readonly controller?: { setState(nextState: AppState): void };
    }
  ).controller;
  if (!controller) {
    throw new Error("Production runtime controller is not connected");
  }
  controller.setState(state);
}

let activeRuntime: ProductionTaskPaneRuntime | undefined;
let originalExecCommand: PropertyDescriptor | undefined;

function installExecCommand(implementation: (commandId: string) => boolean) {
  const execCommand = vi.fn(implementation);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

function installResultWorkspaceGeometry(): void {
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
    return this.classList.contains("olc-workspace") ? 300 : 0;
  });
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
    if (!this.classList.contains("olc-workspace")) {
      return 0;
    }
    return this.querySelector(".olc-notice") ? 980 : 900;
  });
}

function focusCopyActionAtWorkspaceBottom(): {
  readonly button: HTMLButtonElement;
  readonly workspace: HTMLElement;
} {
  const workspace = root().querySelector<HTMLElement>(".olc-workspace")!;
  const button = root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')!;
  workspace.scrollTop = workspace.scrollHeight - workspace.clientHeight;
  button.focus();
  return { button, workspace };
}

function expectPreservedCopyFeedbackPosition(
  previous: { readonly button: HTMLButtonElement; readonly workspace: HTMLElement },
  label: "Copied" | "Copy answer"
): void {
  const currentWorkspace = root().querySelector<HTMLElement>(".olc-workspace")!;
  const currentButton = root().querySelector<HTMLButtonElement>(
    'button[data-action-id="copy-answer"]'
  )!;
  expect(currentWorkspace).not.toBe(previous.workspace);
  expect(currentWorkspace.scrollTop).toBe(
    currentWorkspace.scrollHeight - currentWorkspace.clientHeight
  );
  expect(currentButton.textContent).toBe(label);
  expect(document.activeElement).toBe(currentButton);
  expect(previous.button.isConnected).toBe(false);
  expect(document.activeElement).not.toBe(previous.button);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="taskpane-root"></div>';
  originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
});

afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("production legal-source runtime", () => {
  it("switches a ready view to sl-SI without changing provider, input, context, Word, or gateway", async () => {
    const { word, openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Nespremenjeno vprašanje");
    selectContext("selected-text");
    const connectionChecks = openWebUI.connectionChecks;

    selectLocale("sl-SI");

    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");
    expect(root().querySelector(".olc-product-title")?.textContent).toBe("OpenLegalCore za Word");
    expect(root().querySelector("h1")?.textContent).toBe("Iskanje pravnih virov");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Nespremenjeno vprašanje"
    );
    expect(root().querySelector<HTMLInputElement>('input[value="selected-text"]')?.checked).toBe(
      true
    );
    expect(root().textContent).toContain("Open WebUI je povezan");
    expect(openWebUI.connectionChecks).toBe(connectionChecks);
    expect(openWebUI.requests).toHaveLength(0);
    expect(olcEngine.connectionChecks).toBe(0);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("does not carry a manual locale into a new runtime instance", () => {
    const first = setup({ locale: "en-US" });
    activeRuntime = first.runtime;

    selectLocale("sl-SI");
    expect(document.documentElement.lang).toBe("sl-SI");

    first.runtime.dispose();
    activeRuntime = undefined;
    document.body.innerHTML = '<div id="taskpane-root"></div>';
    const second = setup({ locale: "en-US" });
    activeRuntime = second.runtime;

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
    expect(root().querySelector("h1")?.textContent).toBe("Choose a legal source service");
    expect(first.word.captureCalls).toBe(0);
    expect(second.word.captureCalls).toBe(0);
    expect(first.openWebUI.requests).toHaveLength(0);
    expect(second.openWebUI.requests).toHaveLength(0);
  });

  it("renders Slovenian provider selection, connection failure, and validation states", async () => {
    const first = setup({ locale: "sl-SI" });
    activeRuntime = first.runtime;
    expect(viewState()).toBe("backend-selection");
    expect(root().querySelector("h1")?.textContent).toBe(
      "Izberite storitev za iskanje pravnih virov"
    );
    first.openWebUI.connectionError = new ChatGatewayError("NETWORK_ERROR");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("connection-error"));
    expect(root().textContent).toContain("Preverjanje povezave ni uspelo");
    expect(first.word.captureCalls).toBe(0);
    first.runtime.dispose();
    activeRuntime = undefined;

    document.body.innerHTML = '<div id="taskpane-root"></div>';
    const second = setup({ locale: "sl-SI" });
    activeRuntime = second.runtime;
    click("select-olc-engine");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    click("search");
    expect(root().querySelector("[role='alert']")?.textContent).toContain(
      "Vnesite pravno vprašanje"
    );
    expect(second.olcEngine.requests).toHaveLength(0);
    expect(second.word.captureCalls).toBe(0);
  });

  it("preserves searching state and request contract while changing locale", async () => {
    const { word, openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    openWebUI.pending = true;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Exact question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    const request = structuredClone(openWebUI.requests[0]);

    selectLocale("sl-SI");

    expect(viewState()).toBe("searching");
    expect(root().querySelector("h1")?.textContent).toBe("Iskanje po zakonodaji in sodni praksi …");
    expect(openWebUI.requests).toEqual([request]);
    expect(olcEngine.requests).toHaveLength(0);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("preserves selected-text through a searching locale render and Refine", async () => {
    const { word, openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    openWebUI.pending = true;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Exact selected-context question");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    const wordCallsBeforeLocale = word.captureCalls;
    const requestsBeforeLocale = openWebUI.requests.length;

    selectLocale("sl-SI");

    expect(word.captureCalls).toBe(wordCallsBeforeLocale);
    expect(openWebUI.requests).toHaveLength(requestsBeforeLocale);
    expect(olcEngine.requests).toHaveLength(0);
    openWebUI.resolveLate();
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    click("refine-question");
    expect(root().querySelector<HTMLInputElement>('input[value="selected-text"]')?.checked).toBe(
      true
    );
  });

  it("preserves selected-text through result and error locale renders before Refine", async () => {
    const first = setup();
    activeRuntime = first.runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Result context");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const firstWordCalls = first.word.captureCalls;
    const firstRequests = first.openWebUI.requests.length;
    selectLocale("sl-SI");
    expect(first.word.captureCalls).toBe(firstWordCalls);
    expect(first.openWebUI.requests).toHaveLength(firstRequests);
    click("refine-question");
    expect(root().querySelector<HTMLInputElement>('input[value="selected-text"]')?.checked).toBe(
      true
    );
    first.runtime.dispose();
    activeRuntime = undefined;

    document.body.innerHTML = '<div id="taskpane-root"></div>';
    const second = setup();
    activeRuntime = second.runtime;
    second.openWebUI.completionError = new ChatGatewayError("NETWORK_ERROR");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Error context");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("error"));
    const secondWordCalls = second.word.captureCalls;
    const secondRequests = second.openWebUI.requests.length;
    selectLocale("sl-SI");
    expect(second.word.captureCalls).toBe(secondWordCalls);
    expect(second.openWebUI.requests).toHaveLength(secondRequests);
    click("refine-question");
    expect(root().querySelector<HTMLInputElement>('input[value="selected-text"]')?.checked).toBe(
      true
    );
    expect(second.olcEngine.requests).toHaveLength(0);
  });

  it("preserves selected-text through an expired-session locale render and explicit Retry", async () => {
    const openSignIn = vi.fn(() => true);
    const { word, openWebUI, olcEngine, runtime } = setup({ openSignIn });
    activeRuntime = runtime;
    openWebUI.completionError = new ChatGatewayError("SESSION_EXPIRED");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Expired selected context");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    const wordCallsBeforeLocale = word.captureCalls;
    const requestsBeforeLocale = openWebUI.requests.length;

    selectLocale("sl-SI");

    expect(word.captureCalls).toBe(wordCallsBeforeLocale);
    expect(openWebUI.requests).toHaveLength(requestsBeforeLocale);
    click("open-secure-sign-in");
    openWebUI.completionError = undefined;
    click("retry-search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    expect(openWebUI.requests[1]).toEqual(openWebUI.requests[0]);
    expect(openWebUI.requests[1].context.type).toBe("selected_text");
    expect(word.captureCalls).toBe(wordCallsBeforeLocale + 1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("keeps settings focus through deferred search completion and session expiry", async () => {
    const { openWebUI, runtime } = setup();
    activeRuntime = runtime;
    openWebUI.pending = true;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Deferred answer");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    const searchingRadio = focusSettingsControl('input[value="en-US"]');

    openWebUI.resolveLate();
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const resultRadio = root().querySelector<HTMLInputElement>('input[value="en-US"]')!;
    expect(searchingRadio.isConnected).toBe(false);
    expect(document.activeElement).toBe(resultRadio);
    expect(document.activeElement).not.toBe(document.body);

    emitControllerState(runtime, {
      kind: "error",
      error: { code: "SESSION_EXPIRED" },
    });
    const sessionRadio = root().querySelector<HTMLInputElement>('input[value="en-US"]')!;
    expect(resultRadio.isConnected).toBe(false);
    expect(viewState()).toBe("session-expired");
    expect(document.activeElement).toBe(sessionRadio);
    expect(document.activeElement).not.toBe(document.body);
  });

  it("keeps settings focus and search state through a deferred ordinary failure", async () => {
    const { word, openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    openWebUI.pending = true;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Deferred ordinary failure");
    selectContext("none");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    const searchingRadio = focusSettingsControl('input[value="en-US"]');

    openWebUI.rejectLate(new ChatGatewayError("SERVICE_UNAVAILABLE"));

    await vi.waitFor(() => expect(viewState()).toBe("error"));
    const errorRadio = root().querySelector<HTMLInputElement>('input[value="en-US"]')!;
    expect(searchingRadio.isConnected).toBe(false);
    expect(document.activeElement).toBe(errorRadio);
    expect(document.activeElement).not.toBe(document.body);
    expect(root().textContent).toContain("SERVICE_UNAVAILABLE");
    expect(openWebUI.requests).toHaveLength(1);
    expect(openWebUI.requests[0].context).toEqual({ type: "none" });
    expect(olcEngine.requests).toHaveLength(0);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);

    click("refine-question");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Deferred ordinary failure"
    );
    expect(root().querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
  });

  it.each([
    ["clipboard success", false],
    ["clipboard failure", true],
  ] as const)("keeps settings focus through %s feedback", async (_label, rejectClipboard) => {
    const operation = deferred<void>();
    const writeText = vi.fn(() => operation.promise);
    const execCommand = installExecCommand(() => false);
    const { openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Copy focus");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    click("copy-answer");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const oldClose = focusSettingsControl('button[data-action-id="close-settings"]');

    if (rejectClipboard) {
      operation.reject(new Error("clipboard blocked"));
    } else {
      operation.resolve();
    }
    await vi.waitFor(() =>
      expect(root().querySelector(".olc-notice")?.textContent).toContain(
        rejectClipboard ? "Copy failed" : "Copied"
      )
    );

    const currentClose = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="close-settings"]'
    )!;
    expect(oldClose.isConnected).toBe(false);
    expect(document.activeElement).toBe(currentClose);
    expect(document.activeElement).not.toBe(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(execCommand).toHaveBeenCalledTimes(rejectClipboard ? 1 : 0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("preserves exact provider result, citations, URLs, copy feedback, timer, focus, and scroll", async () => {
    vi.useFakeTimers();
    installResultWorkspaceGeometry();
    const writeText = vi.fn(async () => undefined);
    const { word, openWebUI, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await Promise.resolve();
    setQuestion("Question");
    click("search");
    await Promise.resolve();
    await Promise.resolve();
    const originalRequest = structuredClone(openWebUI.requests[0]);
    const answerText = root().querySelector(".olc-legal-answer")?.textContent;
    const sourceItems = Array.from(
      root().querySelectorAll<HTMLElement>(".olc-legal-sources li"),
      (item) => item.textContent
    );
    const sourceUrls = Array.from(
      root().querySelectorAll<HTMLAnchorElement>(".olc-legal-sources a"),
      (link) => link.href
    );
    const previous = focusCopyActionAtWorkspaceBottom();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    selectLocale("sl-SI");

    expect(viewState()).toBe("result");
    expect(root().querySelector(".olc-legal-answer")?.textContent).toBe(answerText);
    expect(
      Array.from(
        root().querySelectorAll<HTMLElement>(".olc-legal-sources li"),
        (item) => item.textContent
      )
    ).toEqual(sourceItems);
    expect(
      Array.from(
        root().querySelectorAll<HTMLAnchorElement>(".olc-legal-sources a"),
        (link) => link.href
      )
    ).toEqual(sourceUrls);
    expect(root().querySelector(".olc-legal-sources h2")?.textContent).toBe("Viri");
    expect(root().textContent).toContain("Kopirano");
    const localizedWorkspace = root().querySelector<HTMLElement>(".olc-workspace")!;
    expect(localizedWorkspace.scrollTop).toBe(
      localizedWorkspace.scrollHeight - localizedWorkspace.clientHeight
    );
    expect(openWebUI.requests).toEqual([originalRequest]);
    expect(writeText).toHaveBeenCalledWith(ANSWER);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(999);
    expect(root().textContent).toContain("Kopirano");
    await vi.advanceTimersByTimeAsync(1);
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Kopiraj odgovor");
  });

  it("localizes error and session-expired states without retry or provider fallback", async () => {
    const openSignIn = vi.fn(() => true);
    const state = setup({ openSignIn });
    activeRuntime = state.runtime;
    state.openWebUI.completionError = new ChatGatewayError("NETWORK_ERROR");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("error"));

    selectLocale("sl-SI");
    expect(viewState()).toBe("error");
    expect(root().textContent).toContain(
      "Ponovni poskus se izvede samo na vašo zahtevo. Samodejnega preklopa na drugo storitev ni."
    );
    expect(state.openWebUI.requests).toHaveLength(1);
    expect(state.olcEngine.requests).toHaveLength(0);

    state.openWebUI.completionError = new ChatGatewayError("SESSION_EXPIRED");
    click("retry-search");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    expect(root().textContent).toContain("Seja je potekla");
    expect(openSignIn).not.toHaveBeenCalled();
    expect(state.olcEngine.requests).toHaveLength(0);
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("creates semantically identical requests in en-US and sl-SI", async () => {
    const english = setup({ locale: "en-US" });
    activeRuntime = english.runtime;
    click("select-olc-engine");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Isto vprašanje");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const englishRequest = structuredClone(english.olcEngine.requests[0]);
    english.runtime.dispose();
    activeRuntime = undefined;

    document.body.innerHTML = '<div id="taskpane-root"></div>';
    const slovenian = setup({ locale: "sl-SI" });
    activeRuntime = slovenian.runtime;
    click("select-olc-engine");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Isto vprašanje");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(slovenian.olcEngine.requests[0]).toEqual(englishRequest);
    expect(slovenian.olcEngine.requests[0].uiLocale).toBe("en-US");
    expect(slovenian.word.captureCalls).toBe(0);
    expect(slovenian.word.applyCalls).toHaveLength(0);
  });

  it.each([
    "https://word.openlegalcore.org",
    "https://word.example.invalid",
    "https://partner.example.invalid",
  ])("builds the exact same-origin secure sign-in URL for %s", (origin) => {
    expect(secureSignInUrlForOrigin(origin)).toBe(`${origin}/api/session`);
    expect(secureSignInUrlForOrigin(origin)).not.toContain("/api/unsupported");
  });

  it.each([
    "http://word.example.invalid",
    "https://word.example.invalid:443",
    "https://word.example.invalid/path",
    "https://word.example.invalid/",
    "https://word.example.invalid@evil.example",
    "not-a-url",
  ])("rejects an unsafe secure sign-in origin: %s", (origin) => {
    expect(() => secureSignInUrlForOrigin(origin)).toThrow("secure sign-in origin");
  });

  it("opens the exact sign-in target in a disowned no-referrer tab", () => {
    const popupDocument = document.implementation.createHTMLDocument("Secure sign-in");
    const popup = {
      close: vi.fn(),
      document: popupDocument,
      opener: window,
    } as unknown as Window;
    const openWindow = vi.fn(() => popup);
    const navigation: Array<Record<string, string>> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      navigation.push({
        href: this.href,
        referrerPolicy: this.referrerPolicy,
        rel: this.rel,
        target: this.target,
      });
    });

    expect(openSecureSignInWindow("https://word.example.invalid", openWindow)).toBe(true);
    expect(openWindow).toHaveBeenCalledWith("", "_blank");
    expect(popup.opener).toBeNull();
    expect(navigation).toEqual([
      {
        href: "https://word.example.invalid/api/session",
        referrerPolicy: "no-referrer",
        rel: "noopener noreferrer",
        target: "_self",
      },
    ]);
    expect(popupDocument.querySelector("a")).toBeNull();
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("fails closed when a secure sign-in tab is blocked or the origin is unsafe", () => {
    const blocked = vi.fn(() => null);
    expect(openSecureSignInWindow("https://word.openlegalcore.org", blocked)).toBe(false);
    expect(blocked).toHaveBeenCalledOnce();

    const unsafe = vi.fn();
    expect(openSecureSignInWindow("http://word.example.invalid", unsafe)).toBe(false);
    expect(unsafe).not.toHaveBeenCalled();
  });

  it("closes a disowned tab when secure navigation cannot be started", () => {
    const popupDocument = document.implementation.createHTMLDocument("Secure sign-in");
    const popup = {
      close: vi.fn(),
      document: popupDocument,
      opener: window,
    } as unknown as Window;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("navigation failed");
    });

    expect(openSecureSignInWindow("https://word.example.invalid", () => popup)).toBe(false);
    expect(popup.opener).toBeNull();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it("configures exact same-origin routes and browser-session credentials only", async () => {
    const fetch = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
      void init;
      return new Response(
        JSON.stringify(
          input === "/v1/models"
            ? { object: "list", data: [{ id: DEFAULT_WORD_MODEL_ID }] }
            : { data: [{ id: DEFAULT_WORD_MODEL_ID }] }
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const gateways = createSameOriginProductionGateways({ fetch });

    await gateways.openWebUI.checkConnection();
    await gateways.olcEngine.checkConnection();

    expect(fetch.mock.calls.map(([input]) => input)).toEqual(["/api/models", "/v1/models"]);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ credentials: "same-origin", redirect: "manual" });
      expect(init?.headers).not.toHaveProperty("Authorization");
      expect(init?.headers).not.toHaveProperty("CF-Access-Client-ID");
      expect(init?.headers).not.toHaveProperty("CF-Access-Client-Secret");
    }
  });

  it("uses an operator-supplied model ID for both provider paths", async () => {
    const modelId = "partner-legal-model";
    const fetch = vi.fn(async (input: string): Promise<Response> => {
      return new Response(
        JSON.stringify(
          input === "/v1/models"
            ? { object: "list", data: [{ id: modelId }] }
            : { data: [{ id: modelId }] }
        ),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const gateways = createSameOriginProductionGateways({ fetch, modelId });

    await gateways.openWebUI.checkConnection();
    await gateways.olcEngine.checkConnection();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("defaults to no document context and reads nothing before Search", async () => {
    const { word, openWebUI, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));

    expect(root().textContent).toContain("Search legal sources");
    expect(root().textContent).toContain("No document context");
    expect(root().querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.placeholder).toBe(
      LEGAL_QUESTION_PLACEHOLDER
    );
    expect(word.captureCalls).toBe(0);
    expect(openWebUI.requests).toHaveLength(0);
  });

  it("updates the document boundary in both directions without reading or sending content", async () => {
    const { word, openWebUI, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));

    selectContext("selected-text");
    expect(root().querySelector(".olc-action-region-message")?.textContent).toBe(
      "Only the exact selection will be read and sent when you start the search."
    );
    expect(word.captureCalls).toBe(0);
    expect(openWebUI.connectionChecks).toBe(1);
    expect(openWebUI.requests).toHaveLength(0);

    selectContext("none");
    expect(root().querySelector(".olc-action-region-message")?.textContent).toBe(
      "No document content will be read or sent."
    );
    expect(word.captureCalls).toBe(0);
    expect(openWebUI.connectionChecks).toBe(1);
    expect(openWebUI.requests).toHaveLength(0);
  });

  it("sends the exact legal question without rewrite fields or Word access", async () => {
    const { word, openWebUI, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    const question = "  Kateri zakon je veljal leta 2012?  ";
    setQuestion(question);
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(openWebUI.requests).toEqual([
      { question, context: { type: "none" }, uiLocale: "en-US" },
    ]);
    expect(Object.keys(openWebUI.requests[0]).sort()).toEqual(["context", "question", "uiLocale"]);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("captures selected text only on Search and keeps it quoted from the question", async () => {
    const { word, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    click("select-olc-engine");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Kako se zakon uporabi?");
    selectContext("selected-text");
    expect(root().querySelector(".olc-action-region-message")?.textContent).toBe(
      "Only the exact selection will be read and sent when you start the search."
    );
    expect(word.captureCalls).toBe(0);
    expect(olcEngine.requests).toHaveLength(0);

    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(olcEngine.requests).toEqual([
      {
        question: "Kako se zakon uporabi?",
        context: { type: "selected_text", quotedText: snapshot.text },
        uiLocale: "en-US",
      },
    ]);
    expect(word.captureCalls).toBe(1);
    expect(word.releaseCalls).toHaveLength(1);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("renders an analysis-only answer with separate safe sources and no rewrite controls", async () => {
    const { runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(root().textContent).toContain("Answer ready");
    expect(root().querySelector(".olc-legal-sources h2")?.textContent).toBe("Sources");
    expect(root().querySelectorAll("a")).toHaveLength(2);
    expect(root().textContent).not.toMatch(
      /Original|Proposed|Apply to document|Discard|Regenerate|Improve|Shorten|Formalize/
    );
  });

  it.each([
    ["Open WebUI", "select-open-webui", "openWebUI", "olcEngine"],
    ["OLC Engine", "select-olc-engine", "olcEngine", "openWebUI"],
  ] as const)(
    "renders the same safe reference-style result for %s without fallback or Word mutation",
    async (_provider, actionId, selectedKey, otherKey) => {
      const state = setup();
      activeRuntime = state.runtime;
      state[selectedKey].result = { text: REFERENCE_ANSWER };
      click(actionId);
      await vi.waitFor(() => expect(viewState()).toBe("ready"));
      setQuestion("Question");
      click("search");
      await vi.waitFor(() => expect(viewState()).toBe("result"));

      expect(
        Array.from(root().querySelectorAll<HTMLAnchorElement>("a"), (link) => [
          link.textContent,
          link.href,
        ])
      ).toEqual([
        ["[S1]", "https://www.sodnapraksa.si/?q=id:example"],
        ["VSL sodba III Cp 975/2016", "https://www.sodnapraksa.si/?q=id:example"],
      ]);
      expect(root().textContent).not.toContain("[S1]:");
      expect(state[selectedKey].requests).toHaveLength(1);
      expect(state[otherKey].connectionChecks).toBe(0);
      expect(state[otherKey].requests).toHaveLength(0);
      expect(state.word.captureCalls).toBe(0);
      expect(state.word.applyCalls).toHaveLength(0);
    }
  );

  it("copies the exact plain-text answer with the Clipboard API and reports success", async () => {
    installResultWorkspaceGeometry();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const writeText = vi.fn(async () => undefined);
    const execCommand = installExecCommand(() => true);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Preserved question");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const previous = focusCopyActionAtWorkspaceBottom();
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(ANSWER);
    expect(root().querySelector(".olc-notice[role='status']")?.textContent).toContain("Copied");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copied");
    expectPreservedCopyFeedbackPosition(previous, "Copied");
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(execCommand).not.toHaveBeenCalled();
    expect(word.captureCalls).toBe(1);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(root().querySelector(".olc-notice[role='status']")?.textContent).toContain("Copied");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copied");

    await vi.advanceTimersByTimeAsync(1);
    expect(root().querySelector(".olc-notice")).toBeNull();
    const resetButton = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="copy-answer"]'
    );
    expect(resetButton?.textContent).toBe("Copy answer");
    expect(resetButton?.className).toBe("olc-action olc-action-primary");
    expect(resetButton?.disabled).toBe(false);
    expect(resetButton?.getAttribute("aria-disabled")).toBeNull();
    expect(document.activeElement).toBe(resetButton);
    expect(root().querySelector(".olc-status-row")?.getAttribute("aria-live")).toBe("polite");
    expect(word.captureCalls).toBe(1);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("restarts one copy confirmation timer after a second successful copy", async () => {
    const writeText = vi.fn(async () => undefined);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_500);

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(root().querySelector(".olc-notice")?.textContent).toContain("Copied");
    await vi.advanceTimersByTimeAsync(1);
    expect(root().querySelector(".olc-notice")).toBeNull();
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copy answer");
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("ignores an older clipboard success without changing the newer timer", async () => {
    const firstCopy = deferred<void>();
    const secondCopy = deferred<void>();
    const writeText = vi
      .fn<Pick<Navigator["clipboard"], "writeText">["writeText"]>()
      .mockImplementationOnce(() => firstCopy.promise)
      .mockImplementationOnce(() => secondCopy.promise);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    click("copy-answer");
    await Promise.resolve();
    secondCopy.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(root().querySelector(".olc-notice")?.textContent).toContain("Copied");

    await vi.advanceTimersByTimeAsync(1_500);
    firstCopy.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(499);
    expect(root().querySelector(".olc-notice")?.textContent).toContain("Copied");
    await vi.advanceTimersByTimeAsync(1);
    expect(root().querySelector(".olc-notice")).toBeNull();
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copy answer");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("ignores an older clipboard rejection without fallback or failure feedback", async () => {
    const firstCopy = deferred<void>();
    const secondCopy = deferred<void>();
    const writeText = vi
      .fn<Pick<Navigator["clipboard"], "writeText">["writeText"]>()
      .mockImplementationOnce(() => firstCopy.promise)
      .mockImplementationOnce(() => secondCopy.promise);
    const execCommand = installExecCommand(() => true);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    click("copy-answer");
    await Promise.resolve();
    secondCopy.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_500);

    firstCopy.reject(new Error("older clipboard rejection"));
    await Promise.resolve();
    await Promise.resolve();
    expect(execCommand).not.toHaveBeenCalled();
    expect(root().querySelector("[role='alert']")).toBeNull();
    expect(root().querySelector(".olc-notice")?.textContent).toContain("Copied");
    await vi.advanceTimersByTimeAsync(500);
    expect(root().querySelector(".olc-notice")).toBeNull();
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copy answer");
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("preserves result DOM identity, focus, and scroll when confirmation expires", async () => {
    const writeText = vi.fn(async () => undefined);
    const { runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    const workspace = root().querySelector<HTMLElement>(".olc-workspace")!;
    const copyButton = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="copy-answer"]'
    )!;
    const refineButton = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="refine-question"]'
    )!;
    const citation = root().querySelector<HTMLAnchorElement>(".olc-legal-sources a")!;
    workspace.scrollTop = 137;
    citation.focus();

    await vi.advanceTimersByTimeAsync(1_999);
    expect(copyButton.textContent).toBe("Copied");
    expect(document.activeElement).toBe(citation);
    await vi.advanceTimersByTimeAsync(1);

    expect(root().querySelector(".olc-workspace")).toBe(workspace);
    expect(root().querySelector('button[data-action-id="copy-answer"]')).toBe(copyButton);
    expect(root().querySelector('button[data-action-id="refine-question"]')).toBe(refineButton);
    expect(root().querySelector(".olc-legal-sources a")).toBe(citation);
    expect(document.activeElement).toBe(citation);
    expect(workspace.scrollTop).toBe(137);
    expect(copyButton.textContent).toBe("Copy answer");
    expect(copyButton.className).toBe("olc-action olc-action-primary");
    expect(copyButton.disabled).toBe(false);
    expect(copyButton.getAttribute("aria-disabled")).toBeNull();
    expect(root().querySelector(".olc-notice")).toBeNull();
    expect(root().querySelector(".olc-status-row")?.getAttribute("aria-live")).toBe("polite");
  });

  it("invalidates pending clipboard work through controller non-result notifications", async () => {
    const pendingCopy = deferred<void>();
    const writeText = vi.fn(() => pendingCopy.promise);
    const execCommand = installExecCommand(() => true);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(ANSWER);
    expect(vi.getTimerCount()).toBe(0);

    emitControllerState(runtime, { kind: "ready" });
    const nonResultScreen = root().querySelector<HTMLElement>(".olc-app")!;
    expect(viewState()).toBe("ready");

    const replacementAnswer = "## Different answer\nThis is the replacement legal result.";
    emitControllerState(runtime, {
      kind: "result",
      request: {
        question: "Different legal question",
        context: { type: "none" },
        uiLocale: "en-US",
      },
      result: { text: replacementAnswer },
    });
    const replacementScreen = root().querySelector<HTMLElement>(".olc-app")!;
    const replacementMarkup = root().innerHTML;
    const providerRequestsBeforeResolution = openWebUI.requests.length;
    expect(replacementScreen).not.toBe(nonResultScreen);
    expect(viewState()).toBe("result");
    expect(root().textContent).toContain("This is the replacement legal result.");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copy answer");
    expect(root().textContent).not.toContain("Copied");
    expect(vi.getTimerCount()).toBe(0);

    pendingCopy.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(viewState()).toBe("result");
    expect(root().querySelector(".olc-app")).toBe(replacementScreen);
    expect(root().innerHTML).toBe(replacementMarkup);
    expect(root().textContent).toContain("This is the replacement legal result.");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="copy-answer"]')?.textContent
    ).toBe("Copy answer");
    expect(root().textContent).not.toContain("Copied");
    expect(root().textContent).not.toContain("Copy failed");
    expect(vi.getTimerCount()).toBe(0);
    expect(execCommand).not.toHaveBeenCalled();
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(providerRequestsBeforeResolution);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it.each(["refine-question", "new-search", "change-backend", "lifecycle-reset"])(
    "cancels pending copy feedback when %s leaves the answer",
    async (actionId) => {
      const writeText = vi.fn(async () => undefined);
      const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
      activeRuntime = runtime;
      click("select-open-webui");
      await vi.waitFor(() => expect(viewState()).toBe("ready"));
      setQuestion("Question");
      click("search");
      await vi.waitFor(() => expect(viewState()).toBe("result"));
      vi.useFakeTimers();

      click("copy-answer");
      await Promise.resolve();
      await Promise.resolve();
      if (actionId === "lifecycle-reset") {
        runtime.start();
      } else {
        click(actionId);
      }
      const stateAfterAction = root().innerHTML;

      await vi.advanceTimersByTimeAsync(2_000);
      expect(root().innerHTML).toBe(stateAfterAction);
      expect(root().textContent).not.toContain("Copied");
      expect(word.captureCalls).toBe(0);
      expect(word.applyCalls).toHaveLength(0);
      expect(openWebUI.requests).toHaveLength(1);
      expect(olcEngine.requests).toHaveLength(0);
    }
  );

  it("cancels pending copy feedback on dispose without a stale render", async () => {
    const writeText = vi.fn(async () => undefined);
    const { runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    runtime.dispose();
    activeRuntime = undefined;
    const disposedState = root().innerHTML;

    await vi.advanceTimersByTimeAsync(2_000);
    expect(root().innerHTML).toBe(disposedState);
  });

  it("uses a removable plain-text fallback when the Clipboard API is unavailable", async () => {
    installResultWorkspaceGeometry();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const copiedValues: string[] = [];
    const execCommand = installExecCommand((commandId) => {
      expect(commandId).toBe("copy");
      const textarea = document.body.querySelector<HTMLTextAreaElement>(
        'textarea[aria-hidden="true"]'
      );
      expect(textarea?.readOnly).toBe(true);
      copiedValues.push(textarea?.value ?? "");
      return true;
    });
    const { word, openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const previous = focusCopyActionAtWorkspaceBottom();

    click("copy-answer");
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledOnce());

    expect(copiedValues).toEqual([ANSWER]);
    expect(document.body.querySelector('textarea[aria-hidden="true"]')).toBeNull();
    expect(root().querySelector(".olc-notice[role='status']")?.textContent).toContain("Copied");
    expectPreservedCopyFeedbackPosition(previous, "Copied");
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.requests).toHaveLength(0);
  });

  it("falls back after Clipboard API rejection and removes the temporary textarea", async () => {
    const writeText = vi.fn(async () => Promise.reject(new Error("clipboard denied")));
    const execCommand = installExecCommand(() => true);
    const { runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    click("copy-answer");
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));

    expect(writeText).toHaveBeenCalledWith(ANSWER);
    expect(document.body.querySelector('textarea[aria-hidden="true"]')).toBeNull();
    expect(root().querySelector(".olc-notice[role='status']")?.textContent).toContain("Copied");
  });

  it("reports an accessible error when both clipboard mechanisms fail without side effects", async () => {
    installResultWorkspaceGeometry();
    const nativeFocus = HTMLElement.prototype.focus;
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      this: HTMLElement,
      options
    ) {
      if (options) {
        throw new TypeError("focus options unsupported");
      }
      nativeFocus.call(this);
    });
    const writeText = vi.fn(async () => Promise.reject(new Error("clipboard denied")));
    const execCommand = installExecCommand(() => false);
    const { word, openWebUI, olcEngine, runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const previous = focusCopyActionAtWorkspaceBottom();
    vi.useFakeTimers();

    click("copy-answer");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root().querySelector("[role='alert']")?.textContent).toContain("Copy failed");
    expect(root().textContent).not.toContain("Copied");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('textarea[aria-hidden="true"]')).toBeNull();
    expectPreservedCopyFeedbackPosition(previous, "Copy answer");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
    expect(openWebUI.requests).toHaveLength(1);
    expect(olcEngine.connectionChecks).toBe(0);
    expect(olcEngine.requests).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(root().querySelector("[role='alert']")?.textContent).toContain("Copy failed");
    expect(root().textContent).not.toContain("Copied");
  });

  it("removes action listeners on dispose", async () => {
    const writeText = vi.fn(async () => undefined);
    const { runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const copyButton = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="copy-answer"]'
    )!;

    runtime.dispose();
    activeRuntime = undefined;
    copyButton.click();
    await Promise.resolve();

    expect(writeText).not.toHaveBeenCalled();
  });

  it("does not run the fallback or render feedback after dispose during clipboard work", async () => {
    let rejectWrite: ((error: Error) => void) | undefined;
    const writeText = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        })
    );
    const execCommand = installExecCommand(() => true);
    const { runtime } = setup({ clipboard: { writeText } });
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    click("copy-answer");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    runtime.dispose();
    activeRuntime = undefined;
    rejectWrite?.(new Error("clipboard denied"));
    await Promise.resolve();

    expect(execCommand).not.toHaveBeenCalled();
    expect(document.body.querySelector('textarea[aria-hidden="true"]')).toBeNull();
    expect(root().querySelector(".olc-notice")).toBeNull();
  });

  it("supports refine and new-search state transitions after a result", async () => {
    const { runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Preserved question");
    selectContext("selected-text");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    click("refine-question");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Preserved question"
    );
    expect(root().querySelector<HTMLInputElement>('input[value="selected-text"]')?.checked).toBe(
      true
    );
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    click("new-search");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe("");
    expect(root().querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);
  });

  it("cancels and ignores a late response without mutating Word", async () => {
    const { word, openWebUI, runtime } = setup();
    activeRuntime = runtime;
    openWebUI.pending = true;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    setQuestion("Question");
    click("search");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    expect(root().textContent).toContain("Searching legislation and case law…");

    click("cancel");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    expect(openWebUI.signals[0]?.aborted).toBe(true);
    openWebUI.resolveLate();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(root().textContent).not.toContain("Late answer");
    expect(word.applyCalls).toHaveLength(0);
  });

  it.each([
    ["Open WebUI", "select-open-webui", "openWebUI", "olcEngine"],
    ["OLC Engine", "select-olc-engine", "olcEngine", "openWebUI"],
  ] as const)(
    "recovers explicitly from an expired %s session while preserving search state",
    async (_provider, actionId, selectedKey, otherKey) => {
      const openSignIn = vi.fn(() => true);
      const state = setup({ openSignIn });
      activeRuntime = state.runtime;
      state[selectedKey].completionError = new ChatGatewayError("SESSION_EXPIRED");
      click(actionId);
      await vi.waitFor(() => expect(viewState()).toBe("ready"));
      setQuestion("Preserve this question");
      selectContext("selected-text");
      click("search");
      await vi.waitFor(() => expect(viewState()).toBe("session-expired"));

      expect(root().textContent).toContain("Your protected session has expired.");
      expect(state.word.captureCalls).toBe(1);
      expect(state[selectedKey].requests).toHaveLength(1);
      click("open-secure-sign-in");
      expect(openSignIn).toHaveBeenCalledTimes(1);
      expect(root().textContent).toContain("Secure sign-in opened");
      expect(root().textContent).toContain("Retry search");
      expect(state.word.captureCalls).toBe(1);
      expect(state.word.applyCalls).toHaveLength(0);
      expect(state[selectedKey].requests).toHaveLength(1);
      expect(state[otherKey].connectionChecks).toBe(0);
      expect(state[otherKey].requests).toHaveLength(0);

      state[selectedKey].completionError = undefined;
      click("retry-search");
      await vi.waitFor(() => expect(viewState()).toBe("result"));

      expect(state[selectedKey].requests).toHaveLength(2);
      expect(state[selectedKey].requests[1]).toEqual(state[selectedKey].requests[0]);
      expect(state[otherKey].connectionChecks).toBe(0);
      expect(state[otherKey].requests).toHaveLength(0);
      expect(state.word.applyCalls).toHaveLength(0);
    }
  );

  it("reports a blocked secure sign-in without retrying or touching Word", async () => {
    const openSignIn = vi.fn(() => false);
    const { word, openWebUI, olcEngine, runtime } = setup({ openSignIn });
    activeRuntime = runtime;
    openWebUI.connectionError = new ChatGatewayError("SESSION_EXPIRED");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));

    click("open-secure-sign-in");

    expect(root().querySelector("[role='alert']")?.textContent).toContain(
      "Secure sign-in could not open"
    );
    expect(root().textContent).not.toContain("Retry search");
    expect(openSignIn).toHaveBeenCalledOnce();
    expect(openWebUI.connectionChecks).toBe(1);
    expect(openWebUI.requests).toHaveLength(0);
    expect(olcEngine.connectionChecks).toBe(0);
    expect(olcEngine.requests).toHaveLength(0);
    expect(word.captureCalls).toBe(0);
    expect(word.applyCalls).toHaveLength(0);
  });

  it("removes the secure sign-in action on dispose", async () => {
    const openSignIn = vi.fn(() => true);
    const { openWebUI, runtime } = setup({ openSignIn });
    activeRuntime = runtime;
    openWebUI.connectionError = new ChatGatewayError("SESSION_EXPIRED");
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    const signInButton = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="open-secure-sign-in"]'
    )!;

    runtime.dispose();
    activeRuntime = undefined;
    signInButton.click();

    expect(openSignIn).not.toHaveBeenCalled();
  });

  it("keeps provider selection explicit and never falls back", async () => {
    const { openWebUI, olcEngine, runtime } = setup();
    activeRuntime = runtime;
    click("select-open-webui");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    click("change-backend");
    expect(viewState()).toBe("backend-selection");
    expect(openWebUI.disconnects).toBe(1);
    expect(olcEngine.connectionChecks).toBe(0);
  });
});

describe("production frontend security boundary", () => {
  it("contains no frontend credential, storage, rewrite, or Apply path", () => {
    const productionComposition = [
      "src/taskpane/taskpane.ts",
      "src/taskpane/ProductionTaskPaneRuntime.ts",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(productionComposition).not.toMatch(/CF-Access-Client-(?:ID|Secret)/);
    expect(productionComposition).not.toMatch(/\bAuthorization\b|\bBearer\b/);
    expect(productionComposition).not.toMatch(
      /localStorage|sessionStorage|indexedDB|document\.settings/
    );
    expect(productionComposition).not.toMatch(/applyReplacement|Apply to document|Regenerate/);
    expect(SECURE_SIGN_IN_PATH).toBe("/api/session");
    expect(productionComposition).not.toContain("/api/unsupported");
  });
});
