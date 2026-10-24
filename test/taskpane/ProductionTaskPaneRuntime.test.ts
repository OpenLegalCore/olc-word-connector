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
  createProductionTaskPaneRuntime,
  LEGAL_QUESTION_PLACEHOLDER,
  OLC_ENGINE_MODEL_ID,
  ProductionTaskPaneRuntime,
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

  async checkConnection(signal?: AbortSignal): Promise<void> {
    this.connectionChecks++;
    if (signal?.aborted) throw new ChatGatewayError("CANCELLED");
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
    openSignIn?: () =>
      boolean | Promise<import("../../src/taskpane/OfficeSignInDialog").SignInOutcome>;
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
const originalRequestStorageAccess = Object.getOwnPropertyDescriptor(
  document,
  "requestStorageAccess"
);
const originalHasStorageAccess = Object.getOwnPropertyDescriptor(document, "hasStorageAccess");

beforeEach(() => {
  document.body.innerHTML = '<div id="taskpane-root"></div>';
});

afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
  vi.restoreAllMocks();
  for (const [name, descriptor] of [
    ["requestStorageAccess", originalRequestStorageAccess],
    ["hasStorageAccess", originalHasStorageAccess],
  ] as const) {
    if (descriptor) Object.defineProperty(document, name, descriptor);
    else Reflect.deleteProperty(document, name);
  }
});

describe("production Engine-only task-pane runtime", () => {
  it("does not overlap either connection-check control with a pending sign-in dialog", async () => {
    let finish!: (value: "completed") => void;
    const state = setup({
      openSignIn: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Retained\nDraft");
    state.olcEngine.connectionError = new ChatGatewayError("SESSION_EXPIRED");
    click("toggle-settings");
    click("check-connection");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    click("open-secure-sign-in");
    for (const id of ["check-connection", "retry-search"]) {
      expect(root().querySelector<HTMLButtonElement>(`[data-action-id="${id}"]`)?.disabled).toBe(
        true
      );
      click(id);
    }
    expect(state.olcEngine.connectionChecks).toBe(2);
    finish("completed");
    await vi.waitFor(() =>
      expect(
        root().querySelector<HTMLButtonElement>('[data-action-id="retry-search"]')?.disabled
      ).toBe(false)
    );
    expect(state.olcEngine.connectionChecks).toBe(2);
    state.olcEngine.connectionError = undefined;
    click("retry-search");
    await waitForReady();
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Retained\nDraft"
    );
    expect(state.olcEngine.requests).toHaveLength(0);
  });
  it.each([
    ["sl-SI", false],
    ["sl-SI", true],
    ["en-US", false],
    ["en-US", true],
  ] as const)(
    "checks access from settings in %s, removed attachment %s, without replacing the form",
    async (locale, removed) => {
      const requests: Array<{ url: string; init?: RequestInit }> = [];
      const word = new FakeWordAdapter(SNAPSHOT);
      activeRuntime = createProductionTaskPaneRuntime(
        root(),
        word,
        "STAGING",
        new TaskPaneView(root()),
        {
          initialLocale: locale,
          fetch: async (url, init) => {
            requests.push({ url, init });
            return url === "/api/session"
              ? new Response(null, {
                  headers: { "Content-Type": "text/html", "X-OLC-Word-Gateway": "1" },
                })
              : new Response(
                  JSON.stringify({ object: "list", data: [{ id: OLC_ENGINE_MODEL_ID }] }),
                  { headers: { "Content-Type": "application/json" } }
                );
          },
        }
      );
      activeRuntime.start();
      await waitForReady();
      if (removed) click("remove-selection");
      const input = setQuestion("Synthetic draft\nSecond line");
      const captures = word.captureCalls;
      click("toggle-settings");
      const now = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
      click("check-connection");
      await vi.waitFor(() =>
        expect(root().querySelector("#olc-connection-check-result")?.textContent).toContain(
          locale === "sl-SI" ? "Obe preverjanji" : "Both access checks"
        )
      );
      expect(root().querySelector("#runtime-legal-question")).toBe(input);
      expect(input.value).toBe("Synthetic draft\nSecond line");
      expect(Boolean(root().querySelector(".olc-selection-attachment"))).toBe(!removed);
      expect(document.documentElement.lang).toBe(locale);
      expect(word.captureCalls).toBe(captures);
      expect(word.applyCalls).toHaveLength(0);
      expect(requests.map((x) => x.url)).toEqual([
        "/api/session",
        "/v1/models",
        "/api/session",
        "/v1/models",
      ]);
      for (const { init } of requests)
        expect(init).toMatchObject({
          method: "GET",
          credentials: "same-origin",
          redirect: "manual",
          cache: "no-store",
        });
      const previous = root().querySelector("#olc-connection-check-result")!.textContent;
      now.mockReturnValue(1_800_000_010_000);
      click("check-connection");
      await vi.waitFor(() => expect(requests).toHaveLength(6));
      await vi.waitFor(() =>
        expect(root().querySelector("#olc-connection-check-result")?.textContent).not.toBe(previous)
      );
      expect(root().querySelector("#runtime-legal-question")).toBe(input);
    }
  );

  it("allows typing and locale changes during a single check, blocks duplicate checks and Send, and retains the removed attachment", async () => {
    const state = setup({ locale: "sl-SI" });
    activeRuntime = state.runtime;
    await waitForReady();
    click("remove-selection");
    let input = setQuestion("Before check\nLine two");
    let finish!: () => void;
    vi.spyOn(state.olcEngine, "checkConnection").mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    click("toggle-settings");
    click("check-connection");
    click("check-connection");
    await vi.waitFor(() => expect(state.olcEngine.checkConnection).toHaveBeenCalledTimes(1));
    expect(
      root().querySelector<HTMLButtonElement>('[data-action-id="check-connection"]')?.disabled
    ).toBe(true);
    expect(root().querySelector<HTMLButtonElement>('[data-action-id="send"]')?.disabled).toBe(true);
    pressEnter(input);
    expect(state.olcEngine.requests).toHaveLength(0);
    input = setQuestion("Edited during check\nSecond line");
    const language = root().querySelector<HTMLInputElement>(
      'input[name="olc-ui-language"][value="en-US"]'
    )!;
    language.checked = true;
    language.dispatchEvent(new Event("change", { bubbles: true }));
    finish();
    await vi.waitFor(() =>
      expect(root().querySelector("#olc-connection-check-result")?.textContent).toContain(
        "Both access checks"
      )
    );
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Edited during check\nSecond line"
    );
    expect(root().querySelector(".olc-selection-attachment")).toBeNull();
    expect(document.documentElement.lang).toBe("en-US");
    expect(state.olcEngine.requests).toHaveLength(0);
    expect(state.word.applyCalls).toHaveLength(0);
  });

  it.each([false, true])(
    "uses explicit recovery after a settings check, preserves original attachment state %s, and never submits",
    async (removed) => {
      const state = setup({ locale: "sl-SI", openSignIn: async () => "completed" as const });
      activeRuntime = state.runtime;
      await waitForReady();
      if (removed) click("remove-selection");
      setQuestion("Ohrani osnutek\nDruga vrstica");
      const captures = state.word.captureCalls;
      state.olcEngine.connectionError = new ChatGatewayError("SESSION_EXPIRED");
      click("toggle-settings");
      click("check-connection");
      await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
      state.word.emitSelectionChange({
        ...SNAPSHOT,
        snapshotId: "late-other-selection",
        text: "Different selection",
      });
      click("open-secure-sign-in");
      await vi.waitFor(() => expect(root().textContent).toContain("Prijavna stran je dosežena"));
      state.olcEngine.connectionError = undefined;
      click("retry-search");
      await waitForReady();
      expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
        "Ohrani osnutek\nDruga vrstica"
      );
      expect(Boolean(root().querySelector(".olc-selection-attachment"))).toBe(!removed);
      if (!removed)
        expect(root().querySelector(".olc-selection-preview")?.textContent).toBe(SNAPSHOT.text);
      expect(state.word.captureCalls).toBe(captures);
      expect(state.word.applyCalls).toHaveLength(0);
      expect(state.olcEngine.requests).toHaveLength(0);
      expect(document.documentElement.lang).toBe("sl-SI");
    }
  );

  it.each(["ACCESS_DENIED", "TIMEOUT", "NETWORK_ERROR"] as const)(
    "reports a fresh %s failure, then explicitly retries only the connection",
    async (code) => {
      const state = setup();
      activeRuntime = state.runtime;
      await waitForReady();
      click("remove-selection");
      setQuestion("Retained draft\nSecond line");
      state.olcEngine.connectionError = new ChatGatewayError(code);
      click("toggle-settings");
      click("check-connection");
      await vi.waitFor(() => expect(viewState()).toBe("connection-error"));
      expect(root().querySelector("#olc-connection-check-result")?.textContent).toContain(code);
      expect(root().querySelector("#olc-connection-check-result")?.textContent).not.toContain(
        "Both access checks passed"
      );
      state.olcEngine.connectionError = undefined;
      click("retry-connection");
      await waitForReady();
      expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
        "Retained draft\nSecond line"
      );
      expect(root().querySelector(".olc-selection-attachment")).toBeNull();
      expect(state.olcEngine.requests).toHaveLength(0);
      expect(state.word.applyCalls).toHaveLength(0);
    }
  );

  it("ignores a late settings-check response after disposal and aborts its signal", async () => {
    const state = setup();
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Draft stays");
    let finish!: () => void;
    let signal: AbortSignal | undefined;
    const check: ChatGateway["checkConnection"] = (s) => {
      signal = s;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    vi.spyOn(state.olcEngine, "checkConnection").mockImplementation(check);
    click("toggle-settings");
    click("check-connection");
    await vi.waitFor(() => expect(signal).toBeDefined());
    state.runtime.dispose();
    const before = root().innerHTML;
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(root().innerHTML).toBe(before);
    expect(state.olcEngine.requests).toHaveLength(0);
  });

  it("disables settings checks during streaming and keeps a completed answer on later successful checks", async () => {
    const state = setup({ pending: true });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Synthetic request");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("searching"));
    click("toggle-settings");
    click("check-connection");
    expect(state.olcEngine.connectionChecks).toBe(1);
    expect(
      root().querySelector<HTMLButtonElement>('[data-action-id="check-connection"]')?.disabled
    ).toBe(true);
    state.olcEngine.resolveLate();
    await vi.waitFor(() => expect(viewState()).toBe("result"));
    const workspace = root().querySelector("#olc-workspace");
    click("check-connection");
    await vi.waitFor(() => expect(state.olcEngine.connectionChecks).toBe(2));
    expect(root().querySelector("#olc-workspace")).toBe(workspace);
    expect(viewState()).toBe("result");
    expect(state.olcEngine.requests).toHaveLength(1);
    expect(state.word.applyCalls).toHaveLength(0);
  });
  it("reports dialog close/disconnection without claiming authentication, losing the draft or retrying", async () => {
    const state = setup({ locale: "sl-SI", openSignIn: async () => "closed" as const });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Sintetični vnos po zaprtem oknu.");
    state.olcEngine.completionError = new ChatGatewayError("SESSION_EXPIRED");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    click("open-secure-sign-in");
    await vi.waitFor(() =>
      expect(root().textContent).toContain("Prijavno okno je zaprto ali prekinjeno")
    );
    expect(state.olcEngine.connectionChecks).toBe(1);
    expect(state.olcEngine.requests).toHaveLength(1);
    click("retry-search");
    await waitForReady();
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Sintetični vnos po zaprtem oknu."
    );
    expect(state.olcEngine.requests).toHaveLength(1);
    expect(state.word.applyCalls).toHaveLength(0);
  });
  it.each([true, false])(
    "checks both protected route prefixes from the pane only when its session landing is accepted: %s",
    async (accepted) => {
      const paths: string[] = [];
      activeRuntime = createProductionTaskPaneRuntime(
        root(),
        new FakeWordAdapter(SNAPSHOT),
        "STAGING",
        new TaskPaneView(root()),
        {
          fetch: async (url) => {
            paths.push(url);
            return url === "/api/session"
              ? new Response(null, {
                  status: accepted ? 200 : 302,
                  headers: { "Content-Type": "text/html", "X-OLC-Word-Gateway": "1" },
                })
              : new Response(
                  JSON.stringify({ object: "list", data: [{ id: OLC_ENGINE_MODEL_ID }] }),
                  { headers: { "Content-Type": "application/json" } }
                );
          },
        }
      );
      activeRuntime.start();
      await vi.waitFor(() => expect(viewState()).toBe(accepted ? "ready" : "session-expired"));
      expect(paths).toEqual(accepted ? ["/api/session", "/v1/models"] : ["/api/session"]);
    }
  );

  it.each(["granted", "denied", "unsupported"] as const)(
    "preserves draft, locale and removed selection through dialog + %s pane-cookie access, never auto-resubmitting",
    async (permission) => {
      const request = vi.fn(async () => {
        if (permission === "denied") throw new Error("blocked");
      });
      Object.defineProperty(document, "requestStorageAccess", {
        configurable: true,
        value: permission === "unsupported" ? undefined : request,
      });
      Object.defineProperty(document, "hasStorageAccess", {
        configurable: true,
        value: async () => true,
      });
      const state = setup({ locale: "sl-SI", openSignIn: async () => "completed" as const });
      activeRuntime = state.runtime;
      await waitForReady();
      setQuestion("Ohranjen sintetični vnos.\nDruga vrstica.");
      click("remove-selection");
      state.olcEngine.completionError = new ChatGatewayError("SESSION_EXPIRED");
      click("send");
      await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
      click("open-secure-sign-in");
      await vi.waitFor(() => expect(root().textContent).toContain("Prijavna stran je dosežena"));
      expect(state.olcEngine.connectionChecks).toBe(1);
      state.olcEngine.connectionError = new ChatGatewayError("SESSION_EXPIRED");
      click("retry-search");
      await vi.waitFor(() =>
        expect(root().textContent).toContain("Dostop iz Word podokna je še zavrnjen")
      );
      click("allow-pane-cookies");
      expect(request).toHaveBeenCalledTimes(permission === "unsupported" ? 0 : 1);
      await vi.waitFor(() =>
        expect(root().textContent).toContain(
          permission === "granted"
            ? "Dostop do piškotkov aplikacije je dovoljen"
            : "Dostop do piškotkov aplikacije ni na voljo"
        )
      );
      expect(state.olcEngine.connectionChecks).toBe(2);
      expect(state.olcEngine.requests).toHaveLength(1);
      state.olcEngine.connectionError = undefined;
      click("retry-search");
      await waitForReady();
      expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
        "Ohranjen sintetični vnos.\nDruga vrstica."
      );
      expect(root().querySelector(".olc-selection-attachment")).toBeNull();
      expect(document.documentElement.lang).toBe("sl-SI");
      expect(state.olcEngine.requests).toHaveLength(1);
      expect(state.word.applyCalls).toHaveLength(0);
    }
  );

  it("ignores a late dialog completion after runtime disposal without a connection or submission", async () => {
    let finish!: (value: "completed") => void;
    const state = setup({
      connectionError: new ChatGatewayError("SESSION_EXPIRED"),
      openSignIn: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    activeRuntime = state.runtime;
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    click("open-secure-sign-in");
    state.runtime.dispose();
    const before = root().innerHTML;
    finish("completed");
    await Promise.resolve();
    expect(root().innerHTML).toBe(before);
    expect(state.olcEngine.connectionChecks).toBe(1);
    expect(state.olcEngine.requests).toHaveLength(0);
  });
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
    await vi.waitFor(() =>
      expect(
        root().querySelector<HTMLButtonElement>('[data-action-id="retry-search"]')?.disabled
      ).toBe(false)
    );
    state.olcEngine.connectionError = undefined;
    click("retry-search");
    await waitForReady();

    expect(state.olcEngine.connectionChecks).toBe(2);
    expect(state.olcEngine.requests).toHaveLength(0);
  });

  it("retains a draft across repeated session recovery after an idle-time rejection, without resubmitting", async () => {
    const state = setup({ locale: "sl-SI", openSignIn: () => true });
    activeRuntime = state.runtime;
    await waitForReady();
    setQuestion("Sintetični vnos ostane.\nDruga vrstica.");
    click("remove-selection");
    state.olcEngine.completionError = new ChatGatewayError("SESSION_EXPIRED");
    click("send");
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    click("open-secure-sign-in");
    await vi.waitFor(() =>
      expect(
        root().querySelector<HTMLButtonElement>('[data-action-id="retry-search"]')?.disabled
      ).toBe(false)
    );
    state.olcEngine.connectionError = new ChatGatewayError("SESSION_EXPIRED");
    click("retry-search");
    await vi.waitFor(() => expect(state.olcEngine.connectionChecks).toBe(2));
    await vi.waitFor(() => expect(viewState()).toBe("session-expired"));
    click("open-secure-sign-in");
    await vi.waitFor(() =>
      expect(
        root().querySelector<HTMLButtonElement>('[data-action-id="retry-search"]')?.disabled
      ).toBe(false)
    );
    state.olcEngine.connectionError = undefined;
    click("retry-search");
    await waitForReady();
    expect(root().querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value).toBe(
      "Sintetični vnos ostane.\nDruga vrstica."
    );
    expect(root().querySelector(".olc-selection-attachment")).toBeNull();
    expect(state.olcEngine.requests).toHaveLength(1);
    expect(state.word.applyCalls).toHaveLength(0);
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
