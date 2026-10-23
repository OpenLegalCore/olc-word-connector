import {
  createInitializingViewModel,
  createReadyViewModel,
  createUnsupportedViewModel,
} from "../../src/taskpane/taskPaneCopy";
import type { TaskPaneViewModel } from "../../src/taskpane/taskPaneViewModel";

export const galleryFixtureOrder = [
  "runtime-ready",
  "initializing",
  "unsupported",
  "backend-selection",
  "connected-no-context",
  "connected-selected-text",
  "searching",
  "result",
  "session-expired",
  "error",
] as const;

export type GalleryFixtureId = (typeof galleryFixtureOrder)[number];

function base(
  id: GalleryFixtureId,
  overrides: Omit<TaskPaneViewModel, "id" | "environment">,
  environment: TaskPaneViewModel["environment"] = "DEVELOPMENT"
): TaskPaneViewModel {
  return { id, environment, ...overrides };
}

const questionField = {
  id: "gallery-question",
  label: "Message",
  value: "Explain how this rule applies.",
  placeholder: "Ask a question or write an instruction…",
  kind: "textarea",
  readOnly: false,
} as const;

function connectedFixture(
  id: "connected-no-context" | "connected-selected-text",
  usesSelection: boolean
): TaskPaneViewModel {
  return base(
    id,
    {
      status: {
        label: "OLC Engine connected",
        detail: "CONNECTED",
        tone: "success",
      },
      eyebrow: "ASSISTANT",
      heading: "Ask OpenLegalCore",
      description: "Ask a question or give an instruction.",
      fields: [questionField],
      attachment: usesSelection
        ? {
            label: "Selected text",
            preview: "The exact selected passage appears here as quoted context.",
            removeLabel: "Remove",
          }
        : undefined,
      actions: [{ id: "send", label: "Send", variant: "primary" }],
      footer: {
        eyebrow: "DOCUMENT BOUNDARY",
        message: usesSelection
          ? "Only the attached selection will be sent with your message."
          : "No document content will be read or sent.",
      },
    },
    "STAGING"
  );
}

export const galleryFixtures: Readonly<Record<GalleryFixtureId, TaskPaneViewModel>> = {
  "runtime-ready": createReadyViewModel("DEVELOPMENT"),
  initializing: createInitializingViewModel("DEVELOPMENT"),
  unsupported: createUnsupportedViewModel("DEVELOPMENT"),
  "backend-selection": base(
    "backend-selection",
    {
      busy: true,
      status: { label: "Checking OLC Engine", detail: "CONNECTING", tone: "info" },
      eyebrow: "SERVICE CONNECTION",
      heading: "Verifying the selected service…",
      description: "This automatic check sends no document text or message.",
      footer: { eyebrow: "SERVICE BOUNDARY", message: "CHECK IN PROGRESS" },
    },
    "STAGING"
  ),
  "connected-no-context": connectedFixture("connected-no-context", false),
  "connected-selected-text": connectedFixture("connected-selected-text", true),
  searching: base(
    "searching",
    {
      busy: true,
      status: { label: "Preparing response", detail: "OLC ENGINE", tone: "info" },
      eyebrow: "ASSISTANT",
      heading: "Preparing response…",
      description: "The document has not been changed.",
      footer: {
        eyebrow: "DOCUMENT BOUNDARY",
        message: "ANALYSIS ONLY",
        actions: [{ id: "cancel", label: "Stop", variant: "secondary" }],
      },
    },
    "STAGING"
  ),
  result: base(
    "result",
    {
      status: { label: "Answer ready", detail: "OLC ENGINE", tone: "success" },
      eyebrow: "ASSISTANT",
      heading: "Answer",
      legalAnswer:
        "## Applicable rule\nThe answer follows **Article 1** [Z1] and judgment [S1].\n\n## Sources\n- [Z1] [Act](https://pisrs.si/pregledPredpisa?id=ZAKO2008)\n- [S1] [Judgment](https://www.sodnapraksa.si/?q=id:example)",
      actions: [
        { id: "copy", label: "Copy answer", variant: "primary" },
        { id: "refine", label: "Edit message", variant: "secondary" },
        { id: "new", label: "New message", variant: "quiet" },
      ],
      footer: { eyebrow: "DOCUMENT BOUNDARY", message: "ANALYSIS ONLY · WORD UNCHANGED" },
    },
    "STAGING"
  ),
  "session-expired": base(
    "session-expired",
    {
      status: { label: "Session expired", detail: "OLC ENGINE", tone: "warning" },
      eyebrow: "PROTECTED SESSION",
      heading: "Session expired",
      description:
        "Your protected session has expired. Sign in again to continue. The document has not been changed.",
      actions: [{ id: "sign-in", label: "Open secure sign-in", variant: "primary" }],
      footer: { eyebrow: "DOCUMENT BOUNDARY", message: "UNCHANGED" },
    },
    "STAGING"
  ),
  error: base("error", {
    status: { label: "Request stopped safely", detail: "SERVICE UNAVAILABLE", tone: "danger" },
    eyebrow: "RECOVERY",
    heading: "The document is unchanged",
    notice: {
      title: "No document change",
      message: "Retry remains explicit and there is no automatic resend.",
      tone: "danger",
      role: "alert",
    },
    actions: [{ id: "retry", label: "Retry", variant: "primary" }],
    footer: { eyebrow: "DOCUMENT BOUNDARY", message: "UNCHANGED" },
  }),
};

export function isGalleryFixtureId(value: string): value is GalleryFixtureId {
  return galleryFixtureOrder.includes(value as GalleryFixtureId);
}
