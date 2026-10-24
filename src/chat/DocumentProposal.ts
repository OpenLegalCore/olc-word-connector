/* global TextEncoder */

import { ChatGatewayError } from "./ChatGatewayError";

/** Explicit normalized proposal, never derived from the explanatory answer. */
export interface DocumentProposal {
  readonly text: string;
  readonly language: "sl" | "en";
  readonly changeSummary: string;
}

export function validateDocumentProposal(
  value: DocumentProposal,
  locale: "sl-SI" | "en-US"
): DocumentProposal {
  const encoder = new TextEncoder();
  if (
    !value ||
    Object.keys(value).sort().join(",") !== "changeSummary,language,text" ||
    typeof value.text !== "string" ||
    value.text.trim().length === 0 ||
    value.text.includes("\u0000") ||
    encoder.encode(value.text).byteLength > 32_768 ||
    typeof value.changeSummary !== "string" ||
    value.changeSummary.trim().length === 0 ||
    value.changeSummary.includes("\u0000") ||
    encoder.encode(value.changeSummary).byteLength > 2_048 ||
    value.language !== (locale === "sl-SI" ? "sl" : "en")
  ) {
    throw new ChatGatewayError("INVALID_RESPONSE");
  }
  return { text: value.text, language: value.language, changeSummary: value.changeSummary };
}
