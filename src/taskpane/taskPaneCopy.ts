import type { TaskPaneEnvironment, TaskPaneViewModel } from "./taskPaneViewModel";
import { enUSMessages, type MessageCatalog } from "./messages.en-US";

const readyFooter = {
  eyebrow: "DOCUMENT BOUNDARY",
  message: "READY · NO SERVICE CONNECTION",
} as const;

export function environmentForHostname(hostname: string): TaskPaneEnvironment | undefined {
  const normalizedHostname = hostname.toLowerCase();
  if (normalizedHostname === "localhost" || normalizedHostname === "127.0.0.1") {
    return "DEVELOPMENT";
  }
  if (normalizedHostname === "word-staging.example.invalid") {
    return "STAGING";
  }
  return undefined;
}

export function createInitializingViewModel(
  environment?: TaskPaneEnvironment,
  messages: MessageCatalog = enUSMessages
): TaskPaneViewModel {
  return {
    id: "initializing",
    environment,
    busy: true,
    status: {
      label: messages.initializing.statusLabel,
      detail: messages.initializing.statusDetail,
      tone: "info",
    },
    eyebrow: messages.initializing.eyebrow,
    heading: messages.initializing.heading,
    description: messages.initializing.description,
    footer: {
      eyebrow: messages.initializing.footerEyebrow,
      message: messages.initializing.footerMessage,
    },
  };
}

export function createUnsupportedViewModel(
  environment?: TaskPaneEnvironment,
  messages: MessageCatalog = enUSMessages
): TaskPaneViewModel {
  return {
    id: "unsupported",
    environment,
    status: {
      label: messages.unsupported.statusLabel,
      detail: messages.unsupported.statusDetail,
      tone: "warning",
    },
    eyebrow: messages.unsupported.eyebrow,
    heading: messages.unsupported.heading,
    description: messages.unsupported.description,
    notice: {
      title: messages.unsupported.noticeTitle,
      message: messages.unsupported.noticeMessage,
      tone: "warning",
      role: "status",
    },
    footer: {
      eyebrow: messages.unsupported.footerEyebrow,
      message: messages.unsupported.footerMessage,
    },
  };
}

export function createReadyViewModel(environment?: TaskPaneEnvironment): TaskPaneViewModel {
  return {
    id: "runtime-ready",
    environment,
    status: {
      label: "Word connection ready",
      detail: "DOCUMENT ACCESS AVAILABLE",
      tone: "success",
    },
    eyebrow: "LEGAL SOURCE SEARCH",
    heading: "Search legal sources",
    description:
      "Ask a question based on Slovenian legislation and case law. Search is not connected in this shell.",
    footer: readyFooter,
  };
}
