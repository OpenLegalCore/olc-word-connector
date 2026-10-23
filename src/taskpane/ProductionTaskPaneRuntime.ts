/* global AbortController, AbortSignal, Event, HTMLButtonElement, HTMLElement, HTMLInputElement, HTMLTextAreaElement, KeyboardEvent, Navigator, RequestInit, Response, clearTimeout, globalThis, navigator, setTimeout */

import { TaskPaneController, type SearchInput } from "../app/TaskPaneController";
import type { AppState } from "../app/state";
import type { ChatGateway } from "../chat/ChatGateway";
import { ChatGatewayError } from "../chat/ChatGatewayError";
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleFetch,
} from "../chat/OpenAICompatibleAdapter";
import {
  WordAdapterError,
  type SelectionSnapshot,
  type WordAdapter,
  type WordAdapterErrorCode,
} from "../office/WordAdapter";
import { applyDocumentLocale, messagesFor, type MessageCatalog, type UiLocale } from "./i18n";
import { TaskPaneView } from "./TaskPaneView";
import type { TaskPaneEnvironment, TaskPaneViewModel } from "./taskPaneViewModel";
import type { SecureSignIn, SignInOutcome } from "./OfficeSignInDialog";
import {
  checkProtectedSession,
  canRequestPaneCookieAccess,
  requestPaneCookieAccess,
} from "./protectedSession";

export const OLC_ENGINE_MODEL_ID = "lexai-engine-local";
export const SECURE_SIGN_IN_PATH = "/api/session";
export const LEGAL_QUESTION_PLACEHOLDER = messagesFor("en-US").ready.questionPlaceholder;

const COPY_CONFIRMATION_DURATION_MS = 2_000;

export type RuntimeBackend = "olc-engine";

type RuntimeGateway = ChatGateway & { disconnect(): void };
type CopyFeedback = "copied" | "failed";
type SignInFeedback =
  | "idle"
  | "opened"
  | "closed"
  | "failed"
  | "completed"
  | "pane-rejected"
  | "cookie-granted"
  | "cookie-failed";

export interface ProductionGateways {
  readonly olcEngine: RuntimeGateway;
}

export interface ProductionGatewayDependencies {
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  readonly initialLocale?: UiLocale;
  readonly signIn?: SecureSignIn;
}

const backendLabels: Readonly<Record<RuntimeBackend, string>> = {
  "olc-engine": "OLC Engine",
};

export function createSameOriginProductionGateways(
  dependencies: ProductionGatewayDependencies = {}
): ProductionGateways {
  return {
    olcEngine: new OpenAICompatibleAdapter(
      {
        transport: "same-origin",
        modelId: OLC_ENGINE_MODEL_ID,
        responseProfile: "document-review",
      },
      { fetch: dependencies.fetch as OpenAICompatibleFetch | undefined }
    ),
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
  selection: SelectionSnapshot | undefined,
  selectionError: WordAdapterErrorCode | undefined,
  environment?: TaskPaneEnvironment,
  notice?: TaskPaneViewModel["notice"]
): TaskPaneViewModel {
  const preview = selection?.text.replace(/\s+/g, " ").trim();
  return {
    id: "ready",
    environment,
    status: {
      label: messages.ready.connectedStatus(backendLabels[backend]),
      detail: messages.ready.statusDetail,
      tone: "success",
    },
    eyebrow: undefined,
    heading: messages.ready.heading,
    description: messages.ready.description,
    fields: [
      {
        id: "runtime-legal-question",
        label: messages.ready.questionLabel,
        value: question,
        kind: "textarea",
        readOnly: false,
        placeholder: messages.ready.questionPlaceholder,
        visuallyHiddenLabel: true,
      },
    ],
    attachment:
      selection && preview
        ? {
            label: messages.ready.selectedText,
            preview: preview.length > 180 ? `${preview.slice(0, 177)}…` : preview,
            removeLabel: messages.ready.removeSelectedText,
          }
        : undefined,
    notice:
      notice ??
      (selectionError
        ? {
            title: messages.ready.selectionUnavailableTitle,
            message: messages.ready.selectionUnavailableMessage,
            tone: "warning",
            role: "alert",
          }
        : undefined),
    actions: [
      {
        id: "send",
        label: messages.ready.sendAction,
        variant: "primary",
        disabled: selectionError !== undefined,
      },
    ],
    footer: {
      eyebrow: messages.ready.footerEyebrow,
      message: selection ? messages.ready.selectedTextBoundary : messages.ready.noDocumentBoundary,
    },
  };
}

function controllerModel(
  messages: MessageCatalog,
  state: AppState,
  backend: RuntimeBackend,
  question: string,
  selection: SelectionSnapshot | undefined,
  selectionError: WordAdapterErrorCode | undefined,
  environment?: TaskPaneEnvironment,
  copyFeedback?: CopyFeedback
): TaskPaneViewModel {
  if (state.kind === "ready") {
    return readyModel(messages, backend, question, selection, selectionError, environment);
  }
  if (state.kind === "capturing" || state.kind === "searching") {
    const partialText = state.kind === "searching" ? state.partialText : "";
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
      heading:
        partialText.length > 0 ? messages.searching.streamingHeading : messages.searching.heading,
      description: messages.searching.description,
      legalAnswer: partialText.length > 0 ? partialText : undefined,
      legalAnswerLive: partialText.length > 0,
      footer: {
        eyebrow: messages.searching.footerEyebrow,
        message: messages.searching.footerMessage,
        actions: [{ id: "cancel", label: messages.searching.cancel, variant: "secondary" }],
      },
    };
  }
  if (state.kind === "result") {
    const documentChange = state.documentChange;
    const applying = documentChange?.status === "applying";
    const proposal = state.result.proposal;
    const proposalCopy = messages.proposal;
    const proposalFeedback =
      documentChange?.status === "applied"
        ? proposalCopy.applied
        : applying
          ? proposalCopy.applying
          : documentChange?.error === "SELECTION_CHANGED"
            ? proposalCopy.selectionChanged
            : documentChange?.error === "CURSOR_REQUIRED"
              ? proposalCopy.cursorRequired
              : documentChange?.error === "WORD_WRITE_FAILED"
                ? proposalCopy.writeUnconfirmed
                : proposalCopy.ready;
    const usage = state.result.usage;
    const usageText =
      usage === null
        ? messages.result.usageUnavailable
        : usage &&
            usage.inputTokens !== undefined &&
            usage.outputTokens !== undefined &&
            usage.totalTokens !== undefined
          ? messages.result.usage(usage.inputTokens, usage.outputTokens, usage.totalTokens)
          : undefined;
    return {
      id: "result",
      environment,
      status: {
        label: messages.result.statusLabel,
        detail: backendLabels[backend].toUpperCase(),
        tone: "success",
      },
      eyebrow: messages.result.eyebrow,
      heading: messages.result.heading,
      legalAnswer: state.result.text,
      legalSources: state.result.sources,
      legalAnswerMeta: usageText,
      proposal: proposal
        ? {
            heading: proposalCopy.heading,
            text: proposal.text,
            summary: proposal.changeSummary,
            feedback: proposalFeedback,
            failed: documentChange?.status === "failed",
            actions: documentChange
              ? [
                  {
                    id: "replace-proposal",
                    label: proposalCopy.replaceSelection,
                    variant: "primary",
                    disabled: documentChange.status !== "ready" || !documentChange.canReplace,
                  },
                  {
                    id: "insert-proposal",
                    label: proposalCopy.insertAtCursor,
                    variant: "secondary",
                    disabled: documentChange.status !== "ready",
                  },
                ]
              : [],
          }
        : undefined,
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
          disabled: applying,
          label:
            copyFeedback === "copied" ? messages.result.copiedAction : messages.result.copyAction,
          variant: "primary",
        },
        {
          id: "refine-question",
          disabled: applying,
          label: messages.result.refineQuestion,
          variant: "secondary",
        },
        {
          id: "new-search",
          label: messages.result.newSearch,
          variant: "quiet",
          disabled: applying,
        },
      ],
      footer: {
        eyebrow: messages.result.footerEyebrow,
        message: proposal ? proposalFeedback : messages.result.footerMessage,
      },
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
  const opened = signInFeedback !== "idle" && signInFeedback !== "failed";
  const notices = {
    closed: [messages.session.closedTitle, messages.session.closedMessage],
    completed: [messages.session.completedTitle, messages.session.completedMessage],
    "pane-rejected": [messages.session.paneRejectedTitle, messages.session.paneRejectedMessage],
    "cookie-granted": [messages.session.cookieGrantedTitle, messages.session.cookieGrantedMessage],
    "cookie-failed": [messages.session.cookieFailedTitle, messages.session.cookieFailedMessage],
  };
  const feedback =
    signInFeedback in notices ? notices[signInFeedback as keyof typeof notices] : undefined;
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
    notice: feedback
      ? { title: feedback[0], message: feedback[1], tone: "warning", role: "status" }
      : signInFeedback === "opened"
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
          ...(signInFeedback === "pane-rejected" || signInFeedback === "cookie-failed"
            ? [
                {
                  id: "allow-pane-cookies",
                  label: messages.session.allowPaneCookies,
                  variant: "secondary" as const,
                },
              ]
            : []),
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
  private readonly selectedBackend: RuntimeBackend = "olc-engine";
  private controller?: TaskPaneController;
  private unsubscribe?: () => void;
  private unsubscribeSelectionChanges?: () => void;
  private connectionAbort?: AbortController;
  private connectionId = 0;
  private selectionReadId = 0;
  private lastInput?: SearchInput;
  private question = "";
  private displayedSelection?: SelectionSnapshot;
  private selectionError?: WordAdapterErrorCode;
  private selectionRemoved = false;
  private signInFeedback: SignInFeedback = "idle";
  private signInAttempt = 0;
  private signInPending = false;
  private signInLandingReached = false;
  private cookieRequestPending = false;
  private copyFeedback?: CopyFeedback;
  private copyFeedbackTimeout?: ReturnType<typeof setTimeout>;
  private copyOperationId = 0;
  private disposed = false;
  private locale: UiLocale;
  private currentRender?: () => void;
  private readonly formInputHandler = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.id === "runtime-legal-question") {
      this.question = target.value;
    }
  };
  private readonly keydownHandler = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }
    const target = event.target;
    if (
      !(target instanceof HTMLTextAreaElement) ||
      target.id !== "runtime-legal-question" ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    void this.search().catch(() => undefined);
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly view: TaskPaneView,
    private readonly word: WordAdapter,
    private readonly gateways: ProductionGateways,
    private readonly environment?: TaskPaneEnvironment,
    private readonly clipboard?: Pick<Navigator["clipboard"], "writeText">,
    private readonly openSecureSignIn: () => boolean | Promise<SignInOutcome> = () => false,
    initialLocale: UiLocale = "en-US",
    private readonly closeSecureSignIn: () => void = () => undefined,
    private readonly checkSession?: (signal?: AbortSignal) => Promise<void>
  ) {
    this.locale = initialLocale;
  }

  start(): void {
    this.disposed = false;
    this.resetCopyFeedback();
    this.root.removeEventListener("input", this.formInputHandler);
    this.root.addEventListener("input", this.formInputHandler);
    this.root.removeEventListener("keydown", this.keydownHandler);
    this.root.addEventListener("keydown", this.keydownHandler);
    this.view.setActionHandler((actionId) => {
      void this.handleAction(actionId).catch(() => undefined);
    });
    this.view.configureLocale(this.locale, (locale) => this.changeLocale(locale));
    applyDocumentLocale(this.root.ownerDocument, this.locale);
    void this.connect(this.selectedBackend);
  }

  dispose(): void {
    this.disposed = true;
    this.signInAttempt++;
    this.closeSecureSignIn();
    this.signInFeedback = "idle";
    this.resetCopyFeedback();
    this.root.removeEventListener("input", this.formInputHandler);
    this.root.removeEventListener("keydown", this.keydownHandler);
    this.unsubscribeSelectionChanges?.();
    this.unsubscribeSelectionChanges = undefined;
    const selection = this.displayedSelection;
    this.displayedSelection = undefined;
    if (selection) {
      void this.word.releaseSelection(selection).catch(() => undefined);
    }
    this.connectionId++;
    this.connectionAbort?.abort();
    this.controller?.dispose();
    this.unsubscribe?.();
    this.gateways.olcEngine.disconnect();
    this.view.setActionHandler(undefined);
    this.view.configureLocale(this.locale);
    this.currentRender = undefined;
  }

  private gateway(): RuntimeGateway {
    return this.gateways.olcEngine;
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
    if (!state) {
      return;
    }
    if (state.kind === "error" && state.error.code === "SESSION_EXPIRED") {
      this.resetCopyFeedback();
      this.renderView((messages) =>
        sessionExpiredModel(messages, this.selectedBackend, this.environment, this.signInFeedback)
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
        this.selectedBackend,
        this.question,
        this.displayedSelection,
        this.selectionError,
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
    this.signInAttempt++;
    this.closeSecureSignIn();
    this.signInPending = false;
    const connectionId = ++this.connectionId;
    this.connectionAbort?.abort();
    const abort = new AbortController();
    this.connectionAbort = abort;
    this.renderView((messages) => connectingModel(messages, backend, this.environment));
    try {
      await this.checkSession?.(abort.signal);
      if (connectionId !== this.connectionId || this.disposed) return;
      await this.gateway().checkConnection(abort.signal);
      if (connectionId !== this.connectionId) {
        return;
      }
      this.unsubscribe?.();
      this.controller?.dispose();
      this.signInFeedback = "idle";
      this.signInLandingReached = false;
      this.controller = new TaskPaneController(this.word, this.gateway());
      this.unsubscribe = this.controller.subscribe((state) => this.renderControllerState(state));
      await this.startSelectionMonitoring();
    } catch (error) {
      if (connectionId !== this.connectionId) {
        return;
      }
      const code = error instanceof ChatGatewayError ? error.code : "CONNECTION_FAILED";
      if (code === "SESSION_EXPIRED") {
        this.signInFeedback = this.signInLandingReached ? "pane-rejected" : "idle";
        this.renderView((messages) =>
          sessionExpiredModel(messages, backend, this.environment, this.signInFeedback)
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
              id: "retry-connection",
              label: messages.connectionError.tryAgain,
              variant: "primary",
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

  private taskPaneInputHasFocus(): boolean {
    const active = this.root.ownerDocument.activeElement;
    return (
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLInputElement ||
      active instanceof HTMLButtonElement
    );
  }

  private async startSelectionMonitoring(): Promise<void> {
    if (!this.unsubscribeSelectionChanges) {
      try {
        this.unsubscribeSelectionChanges = await this.word.subscribeToSelectionChanges(() => {
          if (!this.taskPaneInputHasFocus()) {
            void this.refreshDisplayedSelection(true);
          }
        });
      } catch {
        // The message-only flow remains available if Word cannot register document events.
      }
    }
    await this.refreshDisplayedSelection(false);
  }

  private async releaseDisplayedSelection(): Promise<void> {
    const selection = this.displayedSelection;
    this.displayedSelection = undefined;
    if (selection) {
      try {
        await this.word.releaseSelection(selection);
      } catch {
        // Selection cleanup never changes the form or document.
      }
    }
  }

  private async refreshDisplayedSelection(fromWordEvent: boolean): Promise<void> {
    if (this.disposed || this.controller?.getState().kind !== "ready") {
      return;
    }
    if (fromWordEvent) {
      this.selectionRemoved = false;
    } else if (this.selectionRemoved) {
      return;
    }
    const readId = ++this.selectionReadId;
    let nextSelection: SelectionSnapshot | undefined;
    let nextSelectionError: WordAdapterErrorCode | undefined;
    try {
      nextSelection = await this.word.captureSelection();
    } catch (error) {
      if (error instanceof WordAdapterError && error.code !== "NO_SELECTION") {
        nextSelectionError = error.code;
      } else if (!(error instanceof WordAdapterError)) {
        nextSelectionError = "WORD_READ_FAILED";
      }
    }
    if (this.disposed || readId !== this.selectionReadId) {
      if (nextSelection) {
        await this.word.releaseSelection(nextSelection).catch(() => undefined);
      }
      return;
    }
    const previous = this.displayedSelection;
    this.displayedSelection = nextSelection;
    this.selectionError = nextSelectionError;
    if (previous && previous.snapshotId !== nextSelection?.snapshotId) {
      await this.word.releaseSelection(previous).catch(() => undefined);
    }
    this.renderControllerState();
  }

  private captureFormState(): void {
    this.question =
      this.root.querySelector<HTMLTextAreaElement>("#runtime-legal-question")?.value ??
      this.question;
  }

  private async search(input?: SearchInput): Promise<void> {
    if (!this.controller) {
      return;
    }
    if (!input) {
      this.captureFormState();
      if (this.selectionError) {
        this.renderControllerState();
        return;
      }
      if (this.question.trim().length === 0 || this.question.length > 4_000) {
        this.renderView((messages) =>
          readyModel(
            messages,
            this.selectedBackend,
            this.question,
            this.displayedSelection,
            this.selectionError,
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
      input = {
        question: this.question,
        selection: this.displayedSelection ? { ...this.displayedSelection } : undefined,
        uiLocale: this.locale,
      };
    }
    this.resetCopyFeedback();
    this.lastInput = {
      ...input,
      selection: input.selection ? { ...input.selection } : undefined,
    };
    if (input.selection?.snapshotId === this.displayedSelection?.snapshotId) {
      this.displayedSelection = undefined;
    }
    this.signInFeedback = "idle";
    await this.controller.search(input);
  }

  private async handleAction(actionId: string): Promise<void> {
    if (actionId === "replace-proposal" || actionId === "insert-proposal") {
      await this.controller?.applyProposal(actionId === "replace-proposal" ? "replace" : "insert");
      return;
    }
    const state = this.controller?.getState();
    if (state?.kind === "result" && state.documentChange?.status === "applying") return;
    if (actionId === "retry-connection") {
      await this.connect("olc-engine");
      return;
    }
    if (actionId === "cancel-connection") {
      this.connectionId++;
      this.connectionAbort?.abort();
      this.connectionAbort = undefined;
      await this.connect("olc-engine");
      return;
    }
    if (actionId === "send") {
      await this.search();
      return;
    }
    if (actionId === "remove-selection") {
      this.captureFormState();
      this.selectionRemoved = true;
      this.selectionReadId++;
      await this.releaseDisplayedSelection();
      this.renderControllerState();
      return;
    }
    if (actionId === "open-secure-sign-in") {
      if (this.signInPending) return;
      const attempt = ++this.signInAttempt;
      this.signInPending = true;
      this.signInFeedback = "opened";
      this.renderControllerState();
      let outcome: boolean | SignInOutcome = false;
      try {
        const result = this.openSecureSignIn();
        if (!this.controller)
          this.renderView((messages) =>
            sessionExpiredModel(messages, this.selectedBackend, this.environment, "opened")
          );
        outcome = await result;
      } catch {
        outcome = false;
      }
      if (this.disposed || attempt !== this.signInAttempt) {
        return;
      }
      this.signInPending = false;
      this.signInLandingReached = outcome === "completed";
      this.signInFeedback =
        outcome === "completed"
          ? "completed"
          : outcome === "closed"
            ? "closed"
            : outcome === true
              ? "opened"
              : "failed";
      this.renderControllerState();
      if (!this.controller) {
        this.renderView((messages) =>
          sessionExpiredModel(messages, this.selectedBackend, this.environment, this.signInFeedback)
        );
      }
      return;
    }
    if (actionId === "allow-pane-cookies") {
      if (this.cookieRequestPending || !this.signInLandingReached) return;
      this.cookieRequestPending = true;
      const attempt = this.signInAttempt;
      const granted =
        canRequestPaneCookieAccess(this.root.ownerDocument) &&
        (await requestPaneCookieAccess(this.root.ownerDocument));
      this.cookieRequestPending = false;
      if (this.disposed || attempt !== this.signInAttempt) return;
      this.signInFeedback = granted ? "cookie-granted" : "cookie-failed";
      this.renderControllerState();
      if (!this.controller)
        this.renderView((messages) =>
          sessionExpiredModel(messages, this.selectedBackend, this.environment, this.signInFeedback)
        );
      return;
    }
    if (actionId === "retry-search" && !this.controller) {
      await this.connect(this.selectedBackend);
      return;
    }
    if (!this.controller) {
      return;
    }
    const controllerState = this.controller.getState();
    if (
      actionId === "retry-search" &&
      controllerState.kind === "error" &&
      controllerState.error.code === "SESSION_EXPIRED"
    ) {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.controller.dispose();
      this.controller = undefined;
      await this.connect(this.selectedBackend);
    } else if (actionId === "cancel") {
      await this.controller.cancel();
      await this.refreshDisplayedSelection(false);
    } else if (actionId === "copy-answer") {
      const state = this.controller.getState();
      if (state.kind === "result") {
        await this.copyAnswer(state.result.text);
      }
    } else if (actionId === "refine-question") {
      this.resetCopyFeedback();
      this.controller.reset();
      await this.refreshDisplayedSelection(false);
    } else if (actionId === "new-search") {
      this.resetCopyFeedback();
      this.question = "";
      this.lastInput = undefined;
      this.controller.reset();
      await this.refreshDisplayedSelection(false);
    } else if (actionId === "retry-search" && this.lastInput) {
      this.question = this.lastInput.question;
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
    () => dependencies.signIn?.open() ?? false,
    dependencies.initialLocale,
    () => dependencies.signIn?.close(),
    (signal) =>
      checkProtectedSession(
        dependencies.fetch ?? ((url, init) => globalThis.fetch(url, init)),
        signal
      )
  );
}
