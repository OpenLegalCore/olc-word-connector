/* global AbortController, Event, HTMLButtonElement, HTMLElement, HTMLInputElement, HTMLTextAreaElement, Navigator, RequestInit, Response, URL, Window, clearTimeout, navigator, setTimeout, window */

import {
  TaskPaneController,
  type DocumentContextMode,
  type SearchInput,
} from "../app/TaskPaneController";
import type { AppState } from "../app/state";
import type { ChatGateway } from "../chat/ChatGateway";
import { ChatGatewayError } from "../chat/ChatGatewayError";
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleFetch,
} from "../chat/OpenAICompatibleAdapter";
import { OpenWebUIAdapter, type OpenWebUIFetch } from "../chat/OpenWebUIAdapter";
import type { WordAdapter } from "../office/WordAdapter";
import { applyDocumentLocale, messagesFor, type MessageCatalog, type UiLocale } from "./i18n";
import { TaskPaneView } from "./TaskPaneView";
import type { TaskPaneEnvironment, TaskPaneViewModel } from "./taskPaneViewModel";

export const DEFAULT_WORD_MODEL_ID = "olc-engine";
export const SECURE_SIGN_IN_PATH = "/api/session";
export const LEGAL_QUESTION_PLACEHOLDER = messagesFor("en-US").ready.questionPlaceholder;

const COPY_CONFIRMATION_DURATION_MS = 2_000;

type WindowOpen = (url: string, target: string) => Window | null;

export function secureSignInUrlForOrigin(origin: string): string {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error("Invalid secure sign-in origin.");
  }
  if (
    parsedOrigin.origin !== origin ||
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.username !== "" ||
    parsedOrigin.password !== "" ||
    parsedOrigin.port !== ""
  ) {
    throw new Error("Unsafe secure sign-in origin.");
  }
  return new URL(SECURE_SIGN_IN_PATH, parsedOrigin.origin).href;
}

export function openSecureSignInWindow(
  origin: string,
  openWindow: WindowOpen = (url, target) => window.open(url, target)
): boolean {
  let popup: Window | null = null;
  try {
    const targetUrl = secureSignInUrlForOrigin(origin);
    popup = openWindow("", "_blank");
    if (!popup) {
      return false;
    }
    popup.opener = null;
    const link = popup.document.createElement("a");
    link.href = targetUrl;
    link.target = "_self";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    popup.document.documentElement.append(link);
    link.click();
    link.remove();
    return true;
  } catch {
    try {
      popup?.close();
    } catch {
      // A failed sign-in popup is reported in the task pane below.
    }
    return false;
  }
}

export type RuntimeBackend = "open-webui" | "olc-engine";

type RuntimeGateway = ChatGateway & { disconnect(): void };
type CopyFeedback = "copied" | "failed";
type SignInFeedback = "idle" | "opened" | "failed";

export interface ProductionGateways {
  readonly openWebUI: RuntimeGateway;
  readonly olcEngine: RuntimeGateway;
}

export interface ProductionGatewayDependencies {
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  readonly uuidV4?: () => string;
  readonly initialLocale?: UiLocale;
  readonly modelId?: string;
}

const backendLabels: Readonly<Record<RuntimeBackend, string>> = {
  "open-webui": "Open WebUI",
  "olc-engine": "OLC Engine",
};

export function createSameOriginProductionGateways(
  dependencies: ProductionGatewayDependencies = {}
): ProductionGateways {
  const modelId = dependencies.modelId ?? DEFAULT_WORD_MODEL_ID;
  return {
    openWebUI: new OpenWebUIAdapter(
      { transport: "same-origin", modelId },
      {
        fetch: dependencies.fetch as OpenWebUIFetch | undefined,
        uuidV4: dependencies.uuidV4,
      }
    ),
    olcEngine: new OpenAICompatibleAdapter(
      { transport: "same-origin", modelId },
      { fetch: dependencies.fetch as OpenAICompatibleFetch | undefined }
    ),
  };
}

function backendSelectionModel(
  messages: MessageCatalog,
  environment?: TaskPaneEnvironment
): TaskPaneViewModel {
  return {
    id: "backend-selection",
    environment,
    status: {
      label: messages.providerSelection.statusLabel,
      detail: messages.providerSelection.statusDetail,
      tone: "success",
    },
    eyebrow: messages.providerSelection.eyebrow,
    heading: messages.providerSelection.heading,
    description: messages.providerSelection.description,
    actions: [
      {
        id: "select-open-webui",
        label: messages.providerSelection.useOpenWebUI,
        variant: "primary",
      },
      {
        id: "select-olc-engine",
        label: messages.providerSelection.useOlcEngine,
        variant: "secondary",
      },
    ],
    footer: {
      eyebrow: messages.providerSelection.footerEyebrow,
      message: messages.providerSelection.footerMessage,
    },
  };
}

function connectingModel(
  messages: MessageCatalog,
  backend: RuntimeBackend,
  environment?: TaskPaneEnvironment
): TaskPaneViewModel {
  return {
    id: "connecting",
    environment,
    busy: true,
    status: {
      label: messages.connecting.statusLabel(backendLabels[backend]),
      detail: messages.connecting.statusDetail,
      tone: "info",
    },
    eyebrow: messages.connecting.eyebrow,
    heading: messages.connecting.heading,
    description: messages.connecting.description,
    footer: {
      eyebrow: messages.connecting.footerEyebrow,
      message: messages.connecting.footerMessage,
      actions: [
        { id: "cancel-connection", label: messages.connecting.cancel, variant: "secondary" },
      ],
    },
  };
}

function readyModel(
  messages: MessageCatalog,
  backend: RuntimeBackend,
  question: string,
  contextMode: DocumentContextMode,
  environment?: TaskPaneEnvironment,
  notice?: TaskPaneViewModel["notice"]
): TaskPaneViewModel {
  const usesSelection = contextMode === "selected-text";
  return {
    id: "ready",
    environment,
    status: {
      label: messages.ready.connectedStatus(backendLabels[backend]),
      detail: messages.ready.statusDetail,
      tone: "success",
      action: { id: "change-backend", label: messages.ready.changeProvider, variant: "quiet" },
    },
    eyebrow: messages.ready.eyebrow,
    heading: messages.ready.heading,
    description: messages.ready.description,
    choiceGroup: {
      name: "runtime-context",
      label: messages.ready.contextLegend,
      choices: [
        { value: "none", label: messages.ready.noDocumentContext, checked: !usesSelection },
        { value: "selected-text", label: messages.ready.selectedText, checked: usesSelection },
      ],
    },
    fields: [
      {
        id: "runtime-legal-question",
        label: messages.ready.questionLabel,
        value: question,
        kind: "textarea",
        readOnly: false,
        placeholder: messages.ready.questionPlaceholder,
      },
    ],
    notice,
    actions: [{ id: "search", label: messages.ready.searchAction, variant: "primary" }],
    footer: {
      eyebrow: messages.ready.footerEyebrow,
      message: usesSelection
        ? messages.ready.selectedTextBoundary
        : messages.ready.noDocumentBoundary,
    },
  };
}

function controllerModel(
  messages: MessageCatalog,
  state: AppState,
  backend: RuntimeBackend,
  question: string,
  contextMode: DocumentContextMode,
  environment?: TaskPaneEnvironment,
  copyFeedback?: CopyFeedback
): TaskPaneViewModel {
  if (state.kind === "ready") {
    return readyModel(messages, backend, question, contextMode, environment);
  }
  if (state.kind === "capturing" || state.kind === "searching") {
    return {
      id: state.kind,
      environment,
      busy: true,
      status: {
        label: messages.searching.statusLabel,
        detail: backendLabels[backend].toUpperCase(),
        tone: "info",
      },
      eyebrow: messages.searching.eyebrow,
      heading: messages.searching.heading,
      description: messages.searching.description,
      footer: {
        eyebrow: messages.searching.footerEyebrow,
        message: messages.searching.footerMessage,
        actions: [{ id: "cancel", label: messages.searching.cancel, variant: "secondary" }],
      },
    };
  }
  if (state.kind === "result") {
    return {
      id: "result",
      environment,
      status: {
        label: messages.result.statusLabel,
        detail: backendLabels[backend].toUpperCase(),
        tone: "success",
        action: {
          id: "change-backend",
          label: messages.result.changeProvider,
          variant: "quiet",
        },
      },
      eyebrow: messages.result.eyebrow,
      heading: messages.result.heading,
      legalAnswer: state.result.text,
      notice:
        copyFeedback === "copied"
          ? {
              title: messages.result.copiedTitle,
              message: messages.result.copiedMessage,
              tone: "success",
              role: "status",
            }
          : copyFeedback === "failed"
            ? {
                title: messages.result.copyFailedTitle,
                message: messages.result.copyFailedMessage,
                tone: "danger",
                role: "alert",
              }
            : undefined,
      actions: [
        {
          id: "copy-answer",
          label:
            copyFeedback === "copied" ? messages.result.copiedAction : messages.result.copyAction,
          variant: "primary",
        },
        {
          id: "refine-question",
          label: messages.result.refineQuestion,
          variant: "secondary",
        },
        { id: "new-search", label: messages.result.newSearch, variant: "quiet" },
      ],
      footer: { eyebrow: messages.result.footerEyebrow, message: messages.result.footerMessage },
    };
  }
  if (state.error.code === "SESSION_EXPIRED") {
    return sessionExpiredModel(messages, backend, environment, "idle");
  }
  return {
    id: "error",
    environment,
    status: { label: messages.error.statusLabel, detail: state.error.code, tone: "danger" },
    eyebrow: messages.error.eyebrow,
    heading: messages.error.heading,
    description: messages.error.description,
    notice: {
      title: messages.error.noticeTitle,
      message: messages.error.noticeMessage,
      tone: "danger",
      role: "alert",
    },
    actions: [
      { id: "retry-search", label: messages.error.retrySearch, variant: "primary" },
      { id: "refine-question", label: messages.error.refineQuestion, variant: "secondary" },
    ],
    footer: { eyebrow: messages.error.footerEyebrow, message: messages.error.footerMessage },
  };
}

function sessionExpiredModel(
  messages: MessageCatalog,
  backend: RuntimeBackend,
  environment: TaskPaneEnvironment | undefined,
  signInFeedback: SignInFeedback
): TaskPaneViewModel {
  const opened = signInFeedback === "opened";
  return {
    id: "session-expired",
    environment,
    status: {
      label: messages.session.statusLabel,
      detail: backendLabels[backend].toUpperCase(),
      tone: "warning",
    },
    eyebrow: messages.session.eyebrow,
    heading: messages.session.heading,
    description: messages.session.description,
    notice:
      signInFeedback === "opened"
        ? {
            title: messages.session.signInOpenedTitle,
            message: messages.session.signInOpenedMessage,
            tone: "info",
            role: "status",
          }
        : signInFeedback === "failed"
          ? {
              title: messages.session.signInFailedTitle,
              message: messages.session.signInFailedMessage,
              tone: "danger",
              role: "alert",
            }
          : undefined,
    actions: opened
      ? [
          { id: "retry-search", label: messages.session.retrySearch, variant: "primary" },
          {
            id: "open-secure-sign-in",
            label: messages.session.openSecureSignIn,
            variant: "quiet",
          },
        ]
      : [
          {
            id: "open-secure-sign-in",
            label: messages.session.openSecureSignIn,
            variant: "primary",
          },
        ],
    footer: { eyebrow: messages.session.footerEyebrow, message: messages.session.footerMessage },
  };
}

export class ProductionTaskPaneRuntime {
  private selectedBackend?: RuntimeBackend;
  private controller?: TaskPaneController;
  private unsubscribe?: () => void;
  private connectionAbort?: AbortController;
  private connectionId = 0;
  private lastInput?: SearchInput;
  private question = "";
  private contextMode: DocumentContextMode = "none";
  private signInFeedback: SignInFeedback = "idle";
  private copyFeedback?: CopyFeedback;
  private copyFeedbackTimeout?: ReturnType<typeof setTimeout>;
  private copyOperationId = 0;
  private disposed = false;
  private locale: UiLocale;
  private currentRender?: () => void;
  private readonly contextModeChangeHandler = (event: Event): void => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      target.name !== "runtime-context" ||
      !target.checked ||
      this.controller?.getState().kind !== "ready"
    ) {
      return;
    }
    this.captureFormState();
    this.renderControllerState();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly view: TaskPaneView,
    private readonly word: WordAdapter,
    private readonly gateways: ProductionGateways,
    private readonly environment?: TaskPaneEnvironment,
    private readonly clipboard?: Pick<Navigator["clipboard"], "writeText">,
    private readonly openSecureSignIn: () => boolean = () =>
      openSecureSignInWindow(window.location.origin),
    initialLocale: UiLocale = "en-US"
  ) {
    this.locale = initialLocale;
  }

  start(): void {
    this.disposed = false;
    this.resetCopyFeedback();
    this.root.removeEventListener("change", this.contextModeChangeHandler);
    this.root.addEventListener("change", this.contextModeChangeHandler);
    this.view.setActionHandler((actionId) => {
      void this.handleAction(actionId).catch(() => undefined);
    });
    this.view.configureLocale(this.locale, (locale) => this.changeLocale(locale));
    applyDocumentLocale(this.root.ownerDocument, this.locale);
    this.renderView((messages) => backendSelectionModel(messages, this.environment));
  }

  dispose(): void {
    this.disposed = true;
    this.signInFeedback = "idle";
    this.resetCopyFeedback();
    this.root.removeEventListener("change", this.contextModeChangeHandler);
    this.connectionId++;
    this.connectionAbort?.abort();
    void this.controller?.cancel();
    this.unsubscribe?.();
    this.gateways.openWebUI.disconnect();
    this.gateways.olcEngine.disconnect();
    this.view.setActionHandler(undefined);
    this.view.configureLocale(this.locale);
    this.currentRender = undefined;
  }

  private gateway(backend: RuntimeBackend): RuntimeGateway {
    return backend === "open-webui" ? this.gateways.openWebUI : this.gateways.olcEngine;
  }

  private renderView(createModel: (messages: MessageCatalog) => TaskPaneViewModel): void {
    this.currentRender = () => this.view.render(createModel(messagesFor(this.locale)));
    this.currentRender();
  }

  private changeLocale(locale: UiLocale): void {
    if (locale === this.locale || this.disposed) {
      return;
    }
    this.captureFormState();
    const workspace = this.root.querySelector<HTMLElement>(".olc-workspace");
    const distanceFromBottom = workspace
      ? Math.max(0, workspace.scrollHeight - workspace.clientHeight - workspace.scrollTop)
      : undefined;
    this.locale = locale;
    this.view.configureLocale(locale, (nextLocale) => this.changeLocale(nextLocale));
    applyDocumentLocale(this.root.ownerDocument, locale);
    this.currentRender?.();
    const currentWorkspace = this.root.querySelector<HTMLElement>(".olc-workspace");
    if (currentWorkspace && distanceFromBottom !== undefined) {
      currentWorkspace.scrollTop = Math.max(
        0,
        currentWorkspace.scrollHeight - currentWorkspace.clientHeight - distanceFromBottom
      );
    }
  }

  private renderControllerState(state = this.controller?.getState()): void {
    if (!state || !this.selectedBackend) {
      return;
    }
    if (state.kind === "error" && state.error.code === "SESSION_EXPIRED") {
      this.resetCopyFeedback();
      this.renderView((messages) =>
        sessionExpiredModel(messages, this.selectedBackend!, this.environment, this.signInFeedback)
      );
      return;
    }
    if (state.kind !== "result") {
      this.resetCopyFeedback();
    }
    this.renderView((messages) =>
      controllerModel(
        messages,
        state,
        this.selectedBackend!,
        this.question,
        this.contextMode,
        this.environment,
        this.copyFeedback
      )
    );
  }

  private copyWithDocumentFallback(text: string): boolean {
    const document = this.root.ownerDocument;
    if (typeof document.execCommand !== "function") {
      return false;
    }
    const textarea = document.createElement("textarea");
    const previousFocus = document.activeElement;
    textarea.value = text;
    textarea.readOnly = true;
    textarea.tabIndex = -1;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.append(textarea);
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
      if (previousFocus instanceof HTMLElement) {
        try {
          previousFocus.focus();
        } catch {
          // Focus restoration is best-effort and must not change the copy result.
        }
      }
    }
  }

  private clearCopyFeedbackTimeout(): void {
    if (this.copyFeedbackTimeout !== undefined) {
      clearTimeout(this.copyFeedbackTimeout);
      this.copyFeedbackTimeout = undefined;
    }
  }

  private resetCopyFeedback(): void {
    this.clearCopyFeedbackTimeout();
    this.copyOperationId++;
    this.copyFeedback = undefined;
  }

  private renderCopyFeedback(copyFeedback: CopyFeedback): void {
    const previousWorkspace = this.root.querySelector<HTMLElement>(".olc-workspace");
    const distanceFromBottom = previousWorkspace
      ? Math.max(
          0,
          previousWorkspace.scrollHeight -
            previousWorkspace.clientHeight -
            previousWorkspace.scrollTop
        )
      : undefined;

    this.copyFeedback = copyFeedback;
    this.renderControllerState();

    const currentWorkspace = this.root.querySelector<HTMLElement>(".olc-workspace");
    const restoreScrollPosition = (): void => {
      if (currentWorkspace && distanceFromBottom !== undefined) {
        currentWorkspace.scrollTop = Math.max(
          0,
          currentWorkspace.scrollHeight - currentWorkspace.clientHeight - distanceFromBottom
        );
      }
    };
    restoreScrollPosition();

    const copyButton = this.root.querySelector<HTMLButtonElement>(
      'button[data-action-id="copy-answer"]'
    );
    if (copyButton && !this.view.hasFocusedSettingsControl()) {
      try {
        copyButton.focus({ preventScroll: true });
      } catch {
        copyButton.focus();
      }
      restoreScrollPosition();
    }
  }

  private clearRenderedCopyConfirmation(): void {
    this.copyFeedback = undefined;
    const copyButton = this.root.querySelector<HTMLButtonElement>(
      'button[data-action-id="copy-answer"]'
    );
    if (!copyButton?.isConnected || !this.root.contains(copyButton)) {
      return;
    }
    const workspace = copyButton.closest<HTMLElement>(".olc-workspace");
    const scrollTop = workspace?.scrollTop;
    copyButton.textContent = messagesFor(this.locale).result.copyAction;
    const notice = workspace?.querySelector<HTMLElement>(".olc-notice[role='status']");
    notice?.remove();
    if (workspace && scrollTop !== undefined) {
      workspace.scrollTop = scrollTop;
    }
  }

  private scheduleCopyConfirmationReset(operationId: number): void {
    this.clearCopyFeedbackTimeout();
    this.copyFeedbackTimeout = setTimeout(() => {
      this.copyFeedbackTimeout = undefined;
      if (
        this.disposed ||
        operationId !== this.copyOperationId ||
        this.copyFeedback !== "copied" ||
        this.controller?.getState().kind !== "result"
      ) {
        return;
      }
      this.clearRenderedCopyConfirmation();
    }, COPY_CONFIRMATION_DURATION_MS);
  }

  private async copyAnswer(text: string): Promise<void> {
    this.clearCopyFeedbackTimeout();
    const operationId = ++this.copyOperationId;
    let copied = false;
    if (this.clipboard) {
      try {
        await this.clipboard.writeText(text);
        copied = true;
      } catch {
        // Embedded Word Web frames can reject Clipboard API access; use the safe fallback below.
      }
    }
    if (!copied && !this.disposed && operationId === this.copyOperationId) {
      copied = this.copyWithDocumentFallback(text);
    }
    if (
      this.disposed ||
      operationId !== this.copyOperationId ||
      this.controller?.getState().kind !== "result"
    ) {
      return;
    }
    if (copied) {
      this.renderCopyFeedback("copied");
      this.scheduleCopyConfirmationReset(operationId);
    } else {
      this.renderCopyFeedback("failed");
    }
  }

  private async connect(backend: RuntimeBackend): Promise<void> {
    const connectionId = ++this.connectionId;
    this.connectionAbort?.abort();
    this.connectionAbort = new AbortController();
    this.renderView((messages) => connectingModel(messages, backend, this.environment));
    try {
      await this.gateway(backend).checkConnection(this.connectionAbort.signal);
      if (connectionId !== this.connectionId) {
        return;
      }
      this.unsubscribe?.();
      this.selectedBackend = backend;
      this.signInFeedback = "idle";
      this.controller = new TaskPaneController(this.word, this.gateway(backend));
      this.unsubscribe = this.controller.subscribe((state) => this.renderControllerState(state));
    } catch (error) {
      if (connectionId !== this.connectionId) {
        return;
      }
      const code = error instanceof ChatGatewayError ? error.code : "CONNECTION_FAILED";
      if (code === "SESSION_EXPIRED") {
        this.selectedBackend = backend;
        this.signInFeedback = "idle";
        this.renderView((messages) =>
          sessionExpiredModel(messages, backend, this.environment, "idle")
        );
      } else {
        this.renderView((messages) => ({
          id: "connection-error",
          environment: this.environment,
          status: {
            label: messages.connectionError.statusLabel(backendLabels[backend]),
            detail: code,
            tone: "danger",
          },
          eyebrow: messages.connectionError.eyebrow,
          heading: messages.connectionError.heading,
          description: messages.connectionError.description,
          actions: [
            {
              id: `select-${backend}`,
              label: messages.connectionError.tryAgain,
              variant: "primary",
            },
            {
              id: "change-backend",
              label: messages.connectionError.chooseService,
              variant: "secondary",
            },
          ],
          footer: {
            eyebrow: messages.connectionError.footerEyebrow,
            message: messages.connectionError.footerMessage,
          },
        }));
      }
    } finally {
      if (connectionId === this.connectionId) {
        this.connectionAbort = undefined;
      }
    }
  }

  private captureFormState(): void {
    this.question =
      this.root.querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value ??
      this.question;
    const context = this.root.querySelector<HTMLInputElement>(
      'input[name="runtime-context"]:checked'
    )?.value;
    if (context === "selected-text" || context === "none") {
      this.contextMode = context;
    }
  }

  private async search(input?: SearchInput): Promise<void> {
    if (!this.controller || !this.selectedBackend) {
      return;
    }
    if (!input) {
      this.captureFormState();
      if (this.question.trim().length === 0 || this.question.length > 4_000) {
        this.renderView((messages) =>
          readyModel(
            messages,
            this.selectedBackend!,
            this.question,
            this.contextMode,
            this.environment,
            {
              title: messages.ready.validationTitle,
              message: messages.ready.validationMessage,
              tone: "warning",
              role: "alert",
            }
          )
        );
        return;
      }
      input = { question: this.question, contextMode: this.contextMode, uiLocale: "en-US" };
    }
    this.resetCopyFeedback();
    this.lastInput = { ...input };
    this.signInFeedback = "idle";
    await this.controller.search(input);
  }

  private resetToBackendSelection(): void {
    this.resetCopyFeedback();
    this.connectionId++;
    this.connectionAbort?.abort();
    this.connectionAbort = undefined;
    void this.controller?.cancel();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (this.selectedBackend) {
      this.gateway(this.selectedBackend).disconnect();
    }
    this.selectedBackend = undefined;
    this.controller = undefined;
    this.lastInput = undefined;
    this.renderView((messages) => backendSelectionModel(messages, this.environment));
  }

  private async handleAction(actionId: string): Promise<void> {
    if (actionId === "select-open-webui") {
      await this.connect("open-webui");
      return;
    }
    if (actionId === "select-olc-engine") {
      await this.connect("olc-engine");
      return;
    }
    if (actionId === "cancel-connection") {
      this.connectionId++;
      this.connectionAbort?.abort();
      this.connectionAbort = undefined;
      this.renderView((messages) => backendSelectionModel(messages, this.environment));
      return;
    }
    if (actionId === "change-backend") {
      this.captureFormState();
      this.resetToBackendSelection();
      return;
    }
    if (actionId === "search") {
      await this.search();
      return;
    }
    if (actionId === "open-secure-sign-in") {
      let opened = false;
      try {
        opened = this.openSecureSignIn();
      } catch {
        opened = false;
      }
      if (this.disposed) {
        return;
      }
      this.signInFeedback = opened ? "opened" : "failed";
      this.renderControllerState();
      if (!this.controller && this.selectedBackend) {
        this.renderView((messages) =>
          sessionExpiredModel(
            messages,
            this.selectedBackend!,
            this.environment,
            this.signInFeedback
          )
        );
      }
      return;
    }
    if (actionId === "retry-search" && !this.controller && this.selectedBackend) {
      await this.connect(this.selectedBackend);
      return;
    }
    if (!this.controller) {
      return;
    }
    if (actionId === "cancel") {
      await this.controller.cancel();
    } else if (actionId === "copy-answer") {
      const state = this.controller.getState();
      if (state.kind === "result") {
        await this.copyAnswer(state.result.text);
      }
    } else if (actionId === "refine-question") {
      this.resetCopyFeedback();
      this.controller.reset();
    } else if (actionId === "new-search") {
      this.resetCopyFeedback();
      this.question = "";
      this.contextMode = "none";
      this.lastInput = undefined;
      this.controller.reset();
    } else if (actionId === "retry-search" && this.lastInput) {
      this.question = this.lastInput.question;
      this.contextMode = this.lastInput.contextMode;
      this.controller.reset();
      await this.search(this.lastInput);
    }
  }
}

export function createProductionTaskPaneRuntime(
  root: HTMLElement,
  word: WordAdapter,
  environment?: TaskPaneEnvironment,
  view = new TaskPaneView(root),
  dependencies: ProductionGatewayDependencies = {}
): ProductionTaskPaneRuntime {
  let clipboard: Pick<Navigator["clipboard"], "writeText"> | undefined;
  try {
    if (typeof navigator !== "undefined") {
      clipboard = navigator.clipboard;
    }
  } catch {
    clipboard = undefined;
  }
  return new ProductionTaskPaneRuntime(
    root,
    view,
    word,
    createSameOriginProductionGateways(dependencies),
    environment,
    clipboard,
    undefined,
    dependencies.initialLocale
  );
}
