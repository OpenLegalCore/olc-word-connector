export const enUSMessages = {
  chrome: {
    documentTitle: "OpenLegalCore for Word",
    brandName: "OpenLegalCore",
    brandImageAlt: "OpenLegalCore",
    availableActions: "Available actions",
    requestInput: "REQUEST INPUT",
    questionSection: "Question",
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
  providerSelection: {
    statusLabel: "Word connection ready",
    statusDetail: "ENGINE READY",
    eyebrow: "LEGAL SOURCE SEARCH",
    heading: "Connect to OLC Engine",
    description:
      "The protected browser session connects to OLC Engine. No Engine credential is stored in this task pane.",
    useOlcEngine: "Use OLC Engine",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "NO DOCUMENT CONTENT READ",
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
    eyebrow: "LEGAL SOURCE SEARCH",
    heading: "Search legal sources",
    description: "Ask a question based on Slovenian legislation and case law.",
    contextLegend: "Context",
    noDocumentContext: "No document context",
    selectedText: "Selected text",
    questionLabel: "Legal question",
    questionPlaceholder:
      "Ask about current or historical legislation, Slovenian case law, or their combined application.",
    searchAction: "Search legal sources",
    footerEyebrow: "DOCUMENT BOUNDARY",
    selectedTextBoundary:
      "Only the exact selection will be read and sent when you start the search.",
    noDocumentBoundary: "No document content will be read or sent.",
    validationTitle: "Legal question required",
    validationMessage:
      "Enter a question between 1 and 4,000 characters. No document content was read.",
  },
  searching: {
    statusLabel: "Searching",
    eyebrow: "LEGAL SOURCE SEARCH",
    heading: "Searching legislation and case law…",
    streamingHeading: "Answer arriving…",
    description: "The document has not been changed.",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "ANALYSIS ONLY",
    cancel: "Cancel",
  },
  result: {
    statusLabel: "Answer ready",
    eyebrow: "LEGAL SOURCE SEARCH",
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
    refineQuestion: "Refine question",
    newSearch: "New search",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "ANALYSIS ONLY · WORD UNCHANGED",
  },
  error: {
    statusLabel: "Search failed safely",
    eyebrow: "RECOVERY",
    heading: "The document is unchanged",
    description: "Retry is explicit. There is no automatic retry.",
    noticeTitle: "No document change",
    noticeMessage: "Review the service and question, then retry the search.",
    retrySearch: "Retry search",
    refineQuestion: "Refine question",
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
      "Complete sign-in in the new tab, return to Word, then select Retry search.",
    signInFailedTitle: "Secure sign-in could not open",
    signInFailedMessage: "Allow pop-ups for this task pane, then try opening secure sign-in again.",
    retrySearch: "Retry search",
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
