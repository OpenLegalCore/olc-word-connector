/* global AbortSignal, Event, HTMLButtonElement, HTMLElement, HTMLInputElement, HTMLTextAreaElement, KeyboardEvent, Navigator, RequestInit, Response, Window, document, window */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ChatGateway,
  CompletionObserver,
  CompletionRequest,
  CompletionResult,
} from "../../src/chat/ChatGateway";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import { WordAdapterError, type SelectionSnapshot } from "../../src/office/WordAdapter";
import {
  createSameOriginProductionGateways,
  LEGAL_QUESTION_PLACEHOLDER,
  OLC_ENGINE_MODEL_ID,
  openSecureSignInWindow,
  ProductionTaskPaneRuntime,
  SECURE_SIGN_IN_PATH,
  secureSignInUrlForOrigin,
  type ProductionGateways,
} from "../../src/taskpane/ProductionTaskPaneRuntime";
import type { UiLocale } from "../../src/taskpane/i18n";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";

const SNAPSHOT: SelectionSnapshot = {
  snapshotId: "selection-1",
  text: "Natančno izbrano besedilo iz Worda.",
  characterCount: 35,
  context: "body",
  capturedAt: "2026-10-23T00:00:00.000Z",
};

const ANSWER =
  "## Odgovor\nUporabi se pravilo [Z1].\n\n## Viri\n- [Z1] [Zakon](https://pisrs.si/pregledPredpisa?id=ZAKO2008)";

class ControlledGateway implements ChatGateway {
  readonly requests: CompletionRequest[] = [];
  readonly signals: Array<AbortSignal | undefined> = [];
  connectionChecks = 0;
  disconnects = 0;
  connectionError?: Error;
  completionError?: Error;
  result: CompletionResult = {
    text: ANSWER,
    model: OLC_ENGINE_MODEL_ID,
    usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
  };
  pending = false;
  private lateResolve?: (result: CompletionResult) => void;
  private observer?: CompletionObserver;

  async checkConnection(): Promise<void> {
    this.connectionChecks++;
    if (this.connectionError) {
      throw this.connectionError;
    }
  }

  complete(
    request: CompletionRequest,
    signal?: AbortSignal,
    observer?: CompletionObserver
  ): Promise<CompletionResult> {
    this.requests.push(structuredClone(request));
    this.signals.push(signal);
    this.observer = observer;
    if (this.completionError) {
      return Promise.reject(this.completionError);
    }
    if (this.pending) {
      return new Promise((resolve) => {
        this.lateResolve = resolve;
      });
    }
    return Promise.resolve(this.result);
  }

  emitDelta(delta: string): void {
    this.observer?.onTextDelta?.(delta);
  }

  resolveLate(result: CompletionResult = this.result): void {
    this.lateResolve?.(result);
  }

  disconnect(): void {
    this.disconnects++;
  }
}

function root(): HTMLElement {
  return document.getElementById("taskpane-root")!;
}

function viewState(): string | undefined {
  return root().querySelector<HTMLElement>(".olc-app")?.dataset.viewState;
}

function click(actionId: string): void {
  const button = root().querySelector<HTMLButtonElement>(`button[data-action-id="${actionId}"]`);
  if (!button) {
    throw new Error(`Missing runtime action: ${actionId}`);
  }
  button.click();
}

function setQuestion(value: string): HTMLTextAreaElement {
  const input = root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

function pressEnter(input: HTMLTextAreaElement, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    ...options,
  });
  input.dispatchEvent(event);
  return event;
}

function selectLocale(locale: UiLocale): void {
  click("toggle-settings");
  const input = root().querySelector<HTMLInputElement>(
    `input[name="olc-ui-language"][value="${locale}"]`
  )!;
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setup(
  options: {
    selection?: SelectionSnapshot | null;
    selectionError?: WordAdapterError;
    locale?: UiLocale;
    connectionError?: Error;
    completionError?: Error;
    pending?: boolean;
    clipboard?: Pick<Navigator["clipboard"], "writeText">;
    openSignIn?: () => boolean;
  } = {}
) {
  const word = new FakeWordAdapter(options.selection ?? SNAPSHOT);
  if (options.selection === null) {
    word.captureError = new WordAdapterError("NO_SELECTION");
  }
  if (options.selectionError) {
    word.captureError = options.selectionError;
  }
  const olcEngine = new ControlledGateway();
  olcEngine.connectionError = options.connectionError;
  olcEngine.completionError = options.completionError;
  olcEngine.pending = options.pending ?? false;
  const gateways: ProductionGateways = { olcEngine };
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
  return { word, olcEngine, runtime };
}

async function waitForReady(): Promise<void> {
  await vi.waitFor(() => expect(viewState()).toBe("ready"));
}

let activeRuntime: ProductionTaskPaneRuntime | undefined;

beforeEach(() => {
  document.body.innerHTML = '<div id="taskpane-root"></div>';
});

afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
  vi.restoreAllMocks();
});

describe("production Engine-only task-pane runtime", () => {
  it("previews an exact explicit proposal separately and applies it only through a localized click", async () => {
    const s = setup({ locale: "sl-SI" });
    activeRuntime = s.runtime;
    const replace = vi.fn(async () => {});
    const insert = vi.fn(async () => {});
    Object.assign(s.word, {
      documentWriter: { applyReplacement: replace, insertAtCursor: insert },
    });
    const text = "Literal <img src=x onerror=alert(1)> [Z1]";
    s.olcEngine.result = {
      text: "Uporabi se pravilo [Z1].",
      sources: [{ label: "Z1", title: "Ločen vir", locator: "fixture", url: "" }],
      rawResponse: "RAW JSON MUST NOT RENDER",
      usage: null,
      proposal: { text, language: "sl", changeSummary: "Sintetični predlog" },
    };
    await waitForReady();
    setQuestion("Pripravi besedilo");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    expect(root().querySelector(".olc-proposal-text")?.textContent).toBe(text);
    expect(root().querySelector(".olc-proposal-text img")).toBeNull();
    expect(root().querySelector(".olc-legal-result")?.textContent).toContain("Uporabi se pravilo");
    expect(root().querySelector(".olc-legal-sources")?.textContent).toContain("Ločen vir");
    expect(root().querySelector(".olc-legal-answer")?.textContent).not.toContain("Ločen vir");
    expect(root().textContent).not.toContain("RAW JSON MUST NOT RENDER");
    expect(replace).not.toHaveBeenCalled();
    expect(root().querySelector('[data-action-id="replace-proposal"]')?.textContent).toBe(
      "Zamenjaj označeno besedilo"
    );
    expect(root().querySelector('[data-action-id="insert-proposal"]')?.textContent).toBe(
      "Vstavi na mesto kazalca"
    );
    click("replace-proposal");
    await vi.waitFor(() =>
      expect(root().querySelector(".olc-proposal-feedback")?.textContent).toContain("vnesen enkrat")
    );
    expect(replace).toHaveBeenCalledWith(SNAPSHOT, text);
    click("replace-proposal");
    click("insert-proposal");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });
  it("checks the connection automatically and opens the input without sending a message", async () => {
    const state = setup();
    activeRuntime = state.runtime;

    expect(["connecting", "ready"]).toContain(viewState());
    await waitForReady();

    expect(state.olcEngine.connectionChecks).toBe(1);
    expect(state.olcEngine.requests).toHaveLength(0);
    expect(root().textContent).not.toContain("Connect to OLC Engine");
    expect(root().textContent).not.toContain("Use OLC Engine");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.placeholder).toBe(
      LEGAL_QUESTION_PLACEHOLDER
    );
    const input = root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")!;
    const inputLabel = root().querySelector<HTMLLabelElement>(
      'label[for="runtime-legal-question"]'
    );
    expect(inputLabel?.textContent).toBe("Message");
    expect(inputLabel?.classList.contains("olc-sr-only")).toBe(true);
    expect(Array.from(input.labels)).toContain(inputLabel);
    expect(root().querySelectorAll(".olc-section-heading")).toHaveLength(0);
    expect(root().querySelectorAll(".olc-fields .olc-field-label:not(.olc-sr-only)")).toHaveLength(
      0
    );
    expect(root().textContent).not.toMatch(/ASSISTANT|REQUEST INPUT/);
    expect(root().querySelector(".olc-selection-attachment")?.textContent).toContain(
      "Selected text"
    );
  });

  it("sends only the message when Word has no selection", async () => {
    const state = setup({ selection: null });
    activeRuntime = state.runtime;
    await waitForReady();
    expect(root().querySelector(".olc-selection-attachment")).toBeNull();

    setQuestion("Explain the rule.");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(state.olcEngine.requests).toEqual([
      { question: "Explain the rule.", context: { type: "none" }, uiLocale: "en-US" },
    ]);
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("blocks an invalid Word selection instead of silently sending message-only", async () => {
    const state = setup({ selectionError: new WordAdapterError("SELECTION_TOO_LARGE") });
    activeRuntime = state.runtime;
    await waitForReady();

    expect(root().querySelector("[role='alert']")?.textContent).toContain("Selection not attached");
    expect(root().querySelector<HTMLButtonElement>('button[data-action-id="send"]')?.disabled).toBe(
      true
    );
    const input = setQuestion("Do not send this yet.");
    pressEnter(input);
    await Promise.resolve();
    expect(state.olcEngine.requests).toHaveLength(0);
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("updates and removes the compact selection attachment without clearing the message", async () => {
    const state = setup();
    activeRuntime = state.runtime;
    await waitForReady();
    const input = setQuestion("Ohrani ta vnos.");
    input.blur();

    const changed = {
      ...SNAPSHOT,
      snapshotId: "selection-2",
      text: "Drugo izbrano besedilo z daljšim predogledom.",
    };
    state.word.emitSelectionChange(changed);
    await vi.waitFor(() =>
      expect(root().querySelector(".olc-selection-preview")?.textContent).toContain("Drugo izbrano")
    );
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Ohrani ta vnos."
    );

    click("remove-selection");
    await vi.waitFor(() => expect(root().querySelector(".olc-selection-attachment")).toBeNull());
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Ohrani ta vnos."
    );
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    expect(state.olcEngine.requests[0].context).toEqual({ type: "none" });
  });

  it("preserves the displayed selection while focus moves into the message input", async () => {
    const state = setup();
    activeRuntime = state.runtime;
    await waitForReady();
    const input = setQuestion("Vprašanje ostane.");
    input.focus();
    const changed = { ...SNAPSHOT, snapshotId: "selection-ignored", text: "Pozni izbor" };

    state.word.emitSelectionChange(changed);
    await Promise.resolve();

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Vprašanje ostane.");
    expect(root().querySelector(".olc-selection-preview")?.textContent).toContain(SNAPSHOT.text);
  });

  it("freezes the displayed selection and language when Send is selected", async () => {
    const state = setup({ locale: "sl-SI", pending: true });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Razloži izbrano besedilo.");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));

    selectLocale("en-US");
    state.word.emitSelectionChange({
      ...SNAPSHOT,
      snapshotId: "selection-late",
      text: "Poznejši izbor",
    });

    expect(state.olcEngine.requests).toEqual([
      {
        question: "Razloži izbrano besedilo.",
        context: { type: "selected_text", quotedText: SNAPSHOT.text },
        uiLocale: "sl-SI",
      },
    ]);
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("uses Enter to send, Shift+Enter for a line break, and ignores IME composition", async () => {
    const shift = setup({ selection: null });
    activeRuntime = shift.runtime;
    await waitForReady();
    let input = setQuestion("First line");
    expect(pressEnter(input, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(shift.olcEngine.requests).toHaveLength(0);
    expect(pressEnter(input, { isComposing: true }).defaultPrevented).toBe(false);
    expect(shift.olcEngine.requests).toHaveLength(0);

    const sendEvent = pressEnter(input);
    expect(sendEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    expect(shift.olcEngine.requests).toHaveLength(1);
  });

  it("shows Stop while streaming, aborts, and ignores late deltas and completion", async () => {
    const state = setup({ pending: true });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Pripravi odgovor.");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    expect(root().textContent).toContain("Preparing response");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="cancel"]')?.textContent
    ).toBe("Stop");

    state.olcEngine.emitDelta("Delni odgovor");
    expect(root().textContent).toContain("Delni odgovor");
    click("cancel");
    await vi.waitFor(() => expect(viewState()).toBe("ready"));
    state.olcEngine.emitDelta(" prezrt");
    state.olcEngine.resolveLate({ text: "Pozni odgovor" });
    await Promise.resolve();

    expect(state.olcEngine.signals[0]?.aborted).toBe(true);
    expect(root().textContent).not.toContain("Pozni odgovor");
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("renders safe sources and exact usage after the validated SSE terminal", async () => {
    const state = setup({ selection: null, locale: "sl-SI" });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Vprašanje");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("result"));

    expect(root().querySelector(".olc-legal-sources h2")?.textContent).toBe("Viri");
    expect(root().querySelector<HTMLAnchorElement>(".olc-legal-sources a")?.href).toBe(
      "https://pisrs.si/pregledPredpisa?id=ZAKO2008"
    );
    expect(root().textContent).toContain("Poraba: 12 vhodnih · 34 izhodnih · 46 žetonov skupaj");
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it("keeps sign-in explicit and returns to the form without resending a message", async () => {
    const openSignIn = vi.fn(() => true);
    const state = setup({
      selection: null,
      connectionError: new ChatGatewayError("SESSION_EXPIRED"),
      openSignIn,
    });
    activeRuntime = state.runtime;
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    expect(state.olcEngine.requests).toHaveLength(0);

    click("open-secure-sign-in");
    expect(openSignIn).toHaveBeenCalledTimes(1);
    state.olcEngine.connectionError = undefined;
    click("retry-search");
    await waitForReady();

    expect(state.olcEngine.connectionChecks).toBe(2);
    expect(state.olcEngine.requests).toHaveLength(0);
  });

  it("does not retry a failed completion automatically", async () => {
    const state = setup({
      selection: null,
      completionError: new ChatGatewayError("SERVICE_UNAVAILABLE"),
    });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Vprašanje");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("error"));
    await Promise.resolve();
    expect(state.olcEngine.requests).toHaveLength(1);
  });

  it("localizes the neutral request flow in Slovenian and English", async () => {
    const state = setup({ selection: null, locale: "sl-SI" });
    activeRuntime = state.runtime;
    await waitForReady();
    expect(root().querySelector("h1")?.textContent).toBe("Vprašajte OpenLegalCore");
    expect(root().textContent).not.toContain("POMOČNIK");
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.placeholder).toBe(
      "Vprašajte ali napišite navodilo …"
    );
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="send"]')?.textContent
    ).toBe("Pošlji");

    selectLocale("en-US");
    expect(root().querySelector("h1")?.textContent).toBe("Ask OpenLegalCore");
    expect(
      root().querySelector<HTMLButtonElement>('button[data-action-id="send"]')?.textContent
    ).toBe("Send");
  });

  it("copies only the answer as plain text", async () => {
    const writeText = vi.fn(async () => undefined);
    const state = setup({ selection: null, clipboard: { writeText } });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Question");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    click("copy-answer");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(ANSWER));
    expect(state.word.applyCalls).toHaveLength(0);
  });
});

describe("secure same-origin composition", () => {
  it("builds only the exact HTTPS sign-in URL", () => {
    expect(secureSignInUrlForOrigin("https://word-staging.openlegalcore.org")).toBe(
      `https://word-staging.openlegalcore.org${SECURE_SIGN_IN_PATH}`
    );
    for (const unsafe of [
      "http://word-staging.openlegalcore.org",
      "https://user@example.org",
      "https://example.org:8443",
      "https://example.org/path",
    ]) {
      expect(() => secureSignInUrlForOrigin(unsafe)).toThrow();
    }
  });

  it("opens sign-in without an opener", () => {
    const clickLink = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const popup = {
      opener: window,
      document,
      close: vi.fn(),
    } as unknown as Window;
    const openWindow = vi.fn(() => popup);

    expect(openSecureSignInWindow("https://word-staging.openlegalcore.org", openWindow)).toBe(true);
    expect(popup.opener).toBeNull();
    expect(clickLink).toHaveBeenCalledTimes(1);
  });

  it("uses same-origin session credentials without exposing Engine or Access headers", async () => {
    const fetch = vi.fn(async (_input: string, _init?: RequestInit): Promise<Response> => {
      return new Response(JSON.stringify({ object: "list", data: [{ id: OLC_ENGINE_MODEL_ID }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const gateways = createSameOriginProductionGateways({ fetch });

    await gateways.olcEngine.checkConnection();

    expect(fetch.mock.calls.map(([input]) => input)).toEqual(["/v1/models"]);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      credentials: "same-origin",
      redirect: "manual",
    });
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty("CF-Access-Client-ID");
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty("CF-Access-Client-Secret");
  });
});
