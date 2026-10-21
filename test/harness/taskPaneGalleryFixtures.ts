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

function contextChoice(usesSelection: boolean): NonNullable<TaskPaneViewModel["choiceGroup"]> {
  return {
    name: "gallery-context",
    label: "Context",
    choices: [
      { value: "none", label: "No document context", checked: !usesSelection },
      { value: "selected-text", label: "Selected text", checked: usesSelection },
    ],
  };
}

const questionField = {
  id: "gallery-question",
  label: "Legal question",
  value: "Which legislation and Slovenian case law apply?",
  placeholder:
    "Ask about current or historical legislation, Slovenian case law, or their combined application.",
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
      eyebrow: "LEGAL SOURCE SEARCH",
      heading: "Search legal sources",
      description: "Ask a question based on Slovenian legislation and case law.",
      choiceGroup: contextChoice(usesSelection),
      fields: [questionField],
      actions: [{ id: "search", label: "Search legal sources", variant: "primary" }],
      footer: {
        eyebrow: "DOCUMENT BOUNDARY",
        message: usesSelection
          ? "Only the exact selection will be read and sent when you start the search."
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
      status: { label: "Word connection ready", detail: "ENGINE READY", tone: "success" },
      eyebrow: "LEGAL SOURCE SEARCH",
      heading: "Connect to OLC Engine",
      description: "Connect to protected OLC Engine without reading document content.",
      actions: [{ id: "select-olc-engine", label: "Use OLC Engine", variant: "primary" }],
      footer: { eyebrow: "DOCUMENT BOUNDARY", message: "NO DOCUMENT CONTENT READ" },
    },
    "STAGING"
  ),
  "connected-no-context": connectedFixture("connected-no-context", false),
  "connected-selected-text": connectedFixture("connected-selected-text", true),
  searching: base(
    "searching",
    {
      busy: true,
      status: { label: "Searching", detail: "OLC ENGINE", tone: "info" },
      eyebrow: "LEGAL SOURCE SEARCH",
      heading: "Searching legislation and case law…",
      description: "The document has not been changed.",
      footer: {
        eyebrow: "DOCUMENT BOUNDARY",
        message: "ANALYSIS ONLY",
        actions: [{ id: "cancel", label: "Cancel", variant: "secondary" }],
      },
    },
    "STAGING"
  ),
  result: base(
    "result",
    {
      status: { label: "Answer ready", detail: "OLC ENGINE", tone: "success" },
      eyebrow: "LEGAL SOURCE SEARCH",
      heading: "Answer",
      legalAnswer:
        "## Applicable rule\nThe answer follows **Article 1** [Z1] and judgment [S1].\n\n## Sources\n- [Z1] [Act](https://pisrs.si/pregledPredpisa?id=ZAKO2008)\n- [S1] [Judgment](https://www.sodnapraksa.si/?q=id:example)",
      actions: [
        { id: "copy", label: "Copy answer", variant: "primary" },
        { id: "refine", label: "Refine question", variant: "secondary" },
        { id: "new", label: "New search", variant: "quiet" },
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
    status: { label: "Search failed safely", detail: "SERVICE UNAVAILABLE", tone: "danger" },
    eyebrow: "RECOVERY",
    heading: "The document is unchanged",
    notice: {
      title: "No document change",
      message: "Retry remains explicit and there is no automatic retry.",
      tone: "danger",
      role: "alert",
    },
    actions: [{ id: "retry", label: "Retry search", variant: "primary" }],
    footer: { eyebrow: "DOCUMENT BOUNDARY", message: "UNCHANGED" },
  }),
};

export function isGalleryFixtureId(value: string): value is GalleryFixtureId {
  return galleryFixtureOrder.includes(value as GalleryFixtureId);
}
