/* global TextEncoder, URL */

import type { CompletionRequest, CompletionResult, CompletionSource } from "./ChatGateway";
import { ChatGatewayError } from "./ChatGatewayError";
import { validateDocumentProposal } from "./DocumentProposal";
import { DocumentReviewExplanationStream } from "./documentReviewStream";

export const DOCUMENT_REVIEW_PROFILE = "lexai_document_review_v1";
const statuses = ["ANSWER", "PARTIAL", "NEEDS_CLARIFICATION", "NOT_FOUND", "UNSUPPORTED"];
const sourceClasses = [
  "LEGISLATION",
  "SLOVENIAN_COURT_DECISION",
  "CONSTITUTIONAL_DECISION",
  "LEGAL_LITERATURE",
];
const currentness = ["CURRENT", "AS_OF_DATE", "NOT_APPLICABLE"];
const sourceKeys = [
  "label",
  "source_id",
  "source_class",
  "title",
  "locator",
  "url",
  "currentness_status",
  "as_of_date",
];
const string = () => ({ type: "string" });
const enumeration = (values: string[]) => ({ type: "string", enum: [...values] });
const array = (items: unknown) => ({ type: "array", items });
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Independently expressed protocol definition; pinned against DOCUMENT-REVIEW-1.
 * Engine implementation/reference-adapter code is not vendored.
 */
export function documentReviewSchema(): unknown {
  return object({
    status: enumeration(statuses),
    claims: array(object({ text: string(), source_labels: array(string()) })),
    notice: string(),
    sources: array(
      object({
        label: string(),
        source_id: string(),
        source_class: enumeration(sourceClasses),
        title: string(),
        locator: string(),
        url: string(),
        currentness_status: enumeration(currentness),
        as_of_date: string(),
      })
    ),
    proposal: {
      anyOf: [
        { type: "null" },
        object({
          markdown: string(),
          language: enumeration(["sl", "en"]),
          change_summary: string(),
          source_labels: array(string()),
        }),
      ],
    },
  });
}

export function documentReviewBody(request: CompletionRequest, model: string): unknown {
  const content = [{ type: "text", text: request.question }];
  if (request.context.type === "selected_text")
    content.push({ type: "text", text: request.context.quotedText });
  return {
    model,
    stream: true,
    stream_options: { include_usage: true },
    response_language: request.uiLocale === "sl-SI" ? "sl" : "en",
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: DOCUMENT_REVIEW_PROFILE,
        strict: true,
        schema: documentReviewSchema(),
      },
    },
  };
}

function invalid(reason: import("./diagnostics").DiagnosticReason = "DOC_SCHEMA_KEYS"): never {
  throw new ChatGatewayError("INVALID_RESPONSE", reason);
}
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== [...keys].sort().join(",")
  )
    invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maxBytes: number, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!value.trim() && !(allowEmpty && value === "")) ||
    value.includes("\u0000") ||
    new TextEncoder().encode(value).byteLength > maxBytes ||
    Array.from(value).some(
      (c) => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff
    )
  )
    invalid("DOC_STRING");
  return value;
}
function publicText(value: unknown, maxBytes: number, allowEmpty = false): string {
  const result = text(value, maxBytes, allowEmpty);
  // Reject forbidden provenance in public prose; never repair/strip it.
  if (
    /https?:\/\/|\[\s*[ZSL]\s*(?:[#\d+:.-][^\]]*)?\]|\[[^\]\r\n]*\][ \t]*(?:\(|\[|:)|##\s+(?:sources|viri|quellen)\b/i.test(
      result
    )
  )
    invalid("DOC_PROVENANCE");
  return result;
}
function labels(value: unknown, allowEmpty = false): string[] {
  if (!Array.isArray(value) || value.length < (allowEmpty ? 0 : 1) || value.length > 16)
    invalid("DOC_LABELS");
  const result = value.map((x) => text(x, 32));
  if (new Set(result).size !== result.length) invalid("DOC_LABELS");
  return result;
}

/** Called only after the existing strict stop -> DONE transport succeeds. */
export function adaptDocumentReview(
  raw: string,
  locale: CompletionRequest["uiLocale"],
  context?: CompletionRequest["context"]
): CompletionResult {
  if (new TextEncoder().encode(raw).byteLength > 1024 * 1024) invalid("DOC_LIMIT");
  const scanner = new DocumentReviewExplanationStream();
  scanner.feed(raw);
  scanner.finish(); // Also rejects duplicate keys at every nesting level.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid("DOC_JSON_STRUCTURE");
  }
  const result = record(parsed, ["status", "claims", "notice", "sources", "proposal"]);
  if (!statuses.includes(result.status as string)) invalid("DOC_STATUS");
  const status = result.status as string;
  const notice = publicText(result.notice, 2048, status === "ANSWER");
  if (
    !Array.isArray(result.claims) ||
    result.claims.length > 64 ||
    !Array.isArray(result.sources) ||
    result.sources.length > 32
  )
    invalid("DOC_LIMIT");
  const used: string[] = [];
  const use = (value: unknown, allowEmpty = false): void => {
    for (const label of labels(value, allowEmpty)) if (!used.includes(label)) used.push(label);
  };
  const explanation = result.claims.map((value) => {
    const claim = record(value, ["text", "source_labels"]);
    const prose = publicText(claim.text, 8192);
    use(claim.source_labels);
    return `${prose} ${(claim.source_labels as string[]).map((label) => `[${label}]`).join(" ")}`;
  });
  if (notice) explanation.push(notice);
  const limits = [32, 512, 64, 1024, 1024, 2048, 32, 32];
  const sources: CompletionSource[] = result.sources.map((value) => {
    const source = record(value, sourceKeys);
    sourceKeys.forEach((key, index) => text(source[key], limits[index], true));
    if (
      !sourceClasses.includes(source.source_class as string) ||
      !currentness.includes(source.currentness_status as string)
    )
      invalid("DOC_SOURCE_METADATA");
    if (source.url !== "") {
      const url = source.url as string;
      if (
        /[\s<>]/u.test(url) ||
        Array.from(url).some(
          (c) => c.charCodeAt(0) < 32 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159)
        )
      )
        invalid("DOC_SOURCE_URL");
      try {
        const parsedUrl = new URL(url);
        if (
          !["http:", "https:"].includes(parsedUrl.protocol) ||
          !parsedUrl.hostname ||
          parsedUrl.username ||
          parsedUrl.password
        )
          invalid("DOC_SOURCE_URL");
      } catch {
        invalid("DOC_SOURCE_URL");
      }
    }
    return {
      label: source.label as string,
      title: source.title as string,
      locator: source.locator as string,
      url: source.url as string,
    };
  });
  let proposal = null;
  if (result.proposal !== null) {
    const value = record(result.proposal, [
      "markdown",
      "language",
      "change_summary",
      "source_labels",
    ]);
    // Engine owns semantic revision admission and evidence verification. Its pinned
    // content-only result has neither claims nor sources; Word additionally requires
    // the actual frozen selection. No prompt classifier or client bypass is involved.
    const contentOnly = result.claims.length === 0 && sources.length === 0;
    if (contentOnly && (context?.type !== "selected_text" || !context.quotedText.trim()))
      invalid("DOC_CONTEXT");
    use(value.source_labels, contentOnly);
    proposal = validateDocumentProposal(
      {
        text: publicText(value.markdown, 32768),
        language: value.language as "sl" | "en",
        changeSummary: publicText(value.change_summary, 2048),
      },
      locale
    );
  }
  if (["ANSWER", "PARTIAL"].includes(status)) {
    if ((!result.claims.length && !proposal) || (result.claims.length && !sources.length))
      invalid("DOC_STATUS_CONTENT");
  } else if (result.claims.length || sources.length || proposal) invalid("DOC_STATUS_CONTENT");
  if (JSON.stringify(used) !== JSON.stringify(sources.map((source) => source.label)))
    invalid("DOC_SOURCE_PROJECTION");
  return { text: explanation.join("\n\n"), sources, proposal, rawResponse: raw };
}
