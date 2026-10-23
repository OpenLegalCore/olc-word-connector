export const enUSMessages = {
  chrome: {
    documentTitle: "OpenLegalCore for Word",
    brandName: "OpenLegalCore",
    brandImageAlt: "OpenLegalCore",
    availableActions: "Available actions",
    answerAriaLabel: "Answer",
    sourcesHeading: "Sources",
  },
  settings: {
    title: "Settings",
    open: "Settings",
    close: "Close settings",
    language: "Language",
    slovenian: "Slovenščina",
    english: "English",
    languageChanged: (language: string): string => `Language changed to ${language}.`,
  },
  initializing: {
    statusLabel: "Opening Word connection",
    statusDetail: "INITIALIZING",
    eyebrow: "APPLICATION STARTUP",
    heading: "Opening OpenLegalCore…",
    description: "Checking the Word host and preparing the document safety boundary.",
    footerEyebrow: "WORD HOST",
    footerMessage: "WAITING FOR READINESS",
  },
  unsupported: {
    statusLabel: "Word host required",
    statusDetail: "UNSUPPORTED HOST",
    eyebrow: "HOST BOUNDARY",
    heading: "Open this add-in in Microsoft Word",
    description: "The document boundary is available only inside a supported Microsoft Word host.",
    noticeTitle: "No document connection",
    noticeMessage: "No document content has been read or changed.",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "INACTIVE",
  },
  connecting: {
    statusLabel: (provider: string): string => `Checking ${provider}`,
    statusDetail: "CONNECTING",
    eyebrow: "SERVICE CONNECTION",
    heading: "Verifying the selected service…",
    description: "This check sends no document text and cannot change the document.",
    footerEyebrow: "SERVICE BOUNDARY",
    footerMessage: "CHECK IN PROGRESS",
    cancel: "Cancel",
  },
  ready: {
    connectedStatus: (provider: string): string => `${provider} connected`,
    statusDetail: "CONNECTED",
    heading: "Ask OpenLegalCore",
    description: "Ask a question or give an instruction.",
    selectedText: "Selected text",
    removeSelectedText: "Remove",
    questionLabel: "Message",
    questionPlaceholder: "Ask a question or write an instruction…",
    sendAction: "Send",
    footerEyebrow: "DOCUMENT BOUNDARY",
    selectedTextBoundary: "Only the attached selection will be sent with your message.",
    noDocumentBoundary: "No document content will be read or sent.",
    validationTitle: "Message required",
    validationMessage:
      "Enter a message between 1 and 4,000 characters. No document content was sent.",
    selectionUnavailableTitle: "Selection not attached",
    selectionUnavailableMessage:
      "Select supported text within one Word body or table cell, or clear the selection before sending.",
  },
  searching: {
    statusLabel: "Preparing response",
    eyebrow: "ASSISTANT",
    heading: "Preparing response…",
    streamingHeading: "Answer arriving…",
    description: "The document has not been changed.",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "ANALYSIS ONLY",
    cancel: "Stop",
  },
  result: {
    statusLabel: "Answer ready",
    eyebrow: "ASSISTANT",
    heading: "Answer",
    usage: (input: number, output: number, total: number): string =>
      `Usage: ${input} input · ${output} output · ${total} total tokens`,
    usageUnavailable: "Usage: not reported by the service",
    copiedTitle: "Copied",
    copiedMessage: "The complete answer was copied as plain text.",
    copyFailedTitle: "Copy failed",
    copyFailedMessage: "Copying is unavailable. Select the answer text and copy it manually.",
    copyAction: "Copy answer",
    copiedAction: "Copied",
    refineQuestion: "Edit message",
    newSearch: "New message",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "ANALYSIS ONLY · WORD UNCHANGED",
  },
  error: {
    statusLabel: "Request stopped safely",
    eyebrow: "RECOVERY",
    heading: "The document is unchanged",
    description: "Retry is explicit. There is no automatic resend.",
    noticeTitle: "No document change",
    noticeMessage: "Review the service and message, then retry.",
    retrySearch: "Retry",
    refineQuestion: "Edit message",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "UNCHANGED",
  },
  session: {
    statusLabel: "Session expired",
    eyebrow: "PROTECTED SESSION",
    heading: "Session expired",
    description:
      "Your protected session has expired. Sign in again to continue. The document has not been changed.",
    signInOpenedTitle: "Secure sign-in opened",
    signInOpenedMessage:
      "Complete sign-in in the new tab, return to Word, then check the connection.",
    signInFailedTitle: "Secure sign-in could not open",
    signInFailedMessage: "Allow pop-ups for this task pane, then try opening secure sign-in again.",
    retrySearch: "Check connection",
    openSecureSignIn: "Open secure sign-in",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "UNCHANGED",
  },
  connectionError: {
    statusLabel: (provider: string): string => `${provider} is unavailable`,
    eyebrow: "SERVICE CONNECTION",
    heading: "Connection check failed",
    description: "No document content was read. Retry the OLC Engine connection explicitly.",
    tryAgain: "Try again",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "UNCHANGED",
  },
} as const;

type WidenCatalog<T> = {
  readonly [Key in keyof T]: T[Key] extends (...args: infer Args) => string
    ? (...args: Args) => string
    : T[Key] extends string
      ? string
      : WidenCatalog<T[Key]>;
};

export type MessageCatalog = WidenCatalog<typeof enUSMessages>;
