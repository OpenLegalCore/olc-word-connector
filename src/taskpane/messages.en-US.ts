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
    checkConnection: "Check connection",
    checkingConnection: "Checking connection…",
    connectionUnchecked: "Check access from this pane without sending your message.",
    connectionPassed: "Connected. No message was sent.",
    connectionFailed: "Access check failed. Your message is retained.",
    checkedAt: (time: string): string => `Last check: ${time}`,
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
    statusLabel: (provider: string): string => `Connecting to ${provider}`,
    statusDetail: "CONNECTING",
    eyebrow: "SERVICE CONNECTION",
    heading: "Connecting…",
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
  proposal: {
    heading: "Proposed document text",
    replaceSelection: "Replace selected text",
    insertAtCursor: "Insert at cursor",
    ready: "Review the exact proposal. Only your click can change Word.",
    applying: "Applying the proposal…",
    applied: "Applied once. Use Word Undo/Redo to review or revert this change.",
    selectionChanged:
      "The original selection changed or is no longer selected. Nothing was written. Start a new request.",
    cursorRequired:
      "Place the cursor without selecting text. Nothing was written. Start a new request.",
    writeUnconfirmed:
      "The write could not be confirmed. Inspect Word and use Undo if needed. Do not repeat this operation.",
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
    expiredTitle: "Sign-in is no longer valid",
    expiredMessage:
      "The sign-in code or Word session is no longer valid. Your message is retained; open sign-in again when ready.",
    statusLabel: "Access required",
    eyebrow: "PROTECTED SESSION",
    heading: "Access required",
    description:
      "Microsoft needs your sign-in or consent. Your message is retained and will not be sent automatically.",
    signInOpenedTitle: "Microsoft sign-in",
    signInOpenedMessage:
      "Office may ask Allow / Ignore before opening the window. Allow opens secure sign-in; Ignore leaves access unchanged. After return, only the connection is checked, never your message.",
    signInFailedTitle: "Microsoft sign-in could not complete",
    signInFailedMessage:
      "Sign-in or the secure code exchange could not complete. Your message is retained; try sign-in again when ready.",
    retrySearch: "Check connection",
    openSecureSignIn: "Sign in with Microsoft",
    completedTitle: "Word session created",
    closedTitle: "Sign-in was not completed",
    closedMessage:
      "The window was declined, closed or disconnected. This is not an access-policy denial. Your message is retained; sign in when ready.",
    completedMessage: "Checking the Word session and connection. Your message will not be sent.",
    paneRejectedTitle: "Word pane access still rejected",
    paneRejectedMessage:
      "The Word session is no longer valid. Your message is retained; sign in again when ready.",
    footerEyebrow: "DOCUMENT BOUNDARY",
    footerMessage: "UNCHANGED",
  },
  connectionError: {
    deniedHeading: "Access denied",
    descriptionFor: (code: string): string => {
      if (code === "INVALID_CONFIGURATION")
        return "Microsoft access is not configured yet. Contact the operator; your message is retained.";
      if (code === "ACCESS_DENIED")
        return "This Microsoft account is not authorized to use OpenLegalCore. Your message is retained; contact the operator.";
      if (code === "NETWORK_ERROR")
        return "The request could not reach the service. Check the network; signing in may not resolve this. Your message is retained.";
      if (code === "SERVICE_UNAVAILABLE")
        return "The server returned an unavailable-service response. Try the connection later; your message is retained.";
      if (code === "TIMEOUT")
        return "The connection check timed out. Your message is retained; nothing was submitted.";
      if (code === "INVALID_RESPONSE")
        return "The service returned an unexpected response. It was not accepted as a session or answer. Your message is retained.";
      return "The connection check failed. Your message is retained; retry only when ready.";
    },
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
