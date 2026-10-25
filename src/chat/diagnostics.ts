/* global globalThis */
import type { ChatGatewayErrorCode } from "./ChatGatewayError";
import { frontendVersion } from "../buildVersion";
import type { UpstreamSseErrorCode } from "./upstreamSseError";

// Fixed vocabulary only. No exception messages, response text, URLs or user input.
export const diagnosticReasons = [
  "HTTP_STATUS",
  "HTTP_CONTENT_TYPE",
  "FETCH_FAILED",
  "REQUEST_TIMEOUT",
  "CANCELLED",
  "SSE_SCHEMA",
  "SSE_ERROR_EVENT",
  "SSE_JSON",
  "SSE_MODEL",
  "SSE_USAGE",
  "SSE_FINISH_REASON",
  "SSE_DONE_WITHOUT_STOP",
  "SSE_INCOMPLETE",
  "SSE_EMPTY",
  "SSE_LIMIT",
  "SSE_ENCODING",
  "SSE_FRAMING",
  "STREAM_READ_FAILED",
  "DOC_SCHEMA_KEYS",
  "DOC_STRING",
  "DOC_PROVENANCE",
  "DOC_LABELS",
  "DOC_STATUS",
  "DOC_LIMIT",
  "DOC_SOURCE_METADATA",
  "DOC_SOURCE_URL",
  "DOC_CONTEXT",
  "DOC_SOURCE_PROJECTION",
  "DOC_STATUS_CONTENT",
  "DOC_JSON_STRUCTURE",
  "DOC_DUPLICATE_KEY",
  "PROPOSAL_SHAPE",
  "PROPOSAL_TEXT",
  "PROPOSAL_SUMMARY",
  "PROPOSAL_LANGUAGE",
  "REJECTED",
  "VALIDATED_STOP_DONE",
] as const;
export type DiagnosticReason = (typeof diagnosticReasons)[number];
export type DiagnosticPhase = "request" | "http" | "sse" | "result_validation" | "complete";
export interface AttemptDiagnostic {
  readonly schema: 1;
  readonly attemptId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly frontendVersion: string;
  readonly outcome: "failed" | "validated";
  readonly code: ChatGatewayErrorCode | "OK";
  readonly phase: DiagnosticPhase;
  readonly reason: DiagnosticReason;
  readonly httpStatus?: number;
  readonly upstreamCode?: UpstreamSseErrorCode;
}
export const ATTEMPT_TTL_MS = 30 * 60_000;
export class AttemptDiagnostics {
  private records: AttemptDiagnostic[] = [];
  private active = new Set<string>();
  begin(): { attemptId: string; startedAt: string; frontendVersion: string } {
    const attemptId = globalThis.crypto.randomUUID();
    this.active.add(attemptId);
    if (this.active.size > 5) this.active.delete(this.active.values().next().value!);
    return {
      attemptId,
      startedAt: new Date().toISOString(),
      frontendVersion,
    };
  }
  finish(record: AttemptDiagnostic): void {
    if (!this.active.delete(record.attemptId)) return;
    this.prune();
    this.records.push(Object.freeze({ ...record }));
    this.records = this.records.slice(-5);
  }
  latestFailure(): AttemptDiagnostic | undefined {
    this.prune();
    return [...this.records].reverse().find((record) => record.outcome === "failed");
  }
  snapshot(): readonly AttemptDiagnostic[] {
    this.prune();
    return [...this.records];
  }
  clear(): void {
    this.records = [];
    this.active.clear();
  }
  private prune(): void {
    this.records = this.records.filter(
      (record) => Date.parse(record.finishedAt) > Date.now() - ATTEMPT_TTL_MS
    );
  }
}

export const transferStages = [
  "accepted",
  "upstream_http",
  "upstream_unavailable",
  "response_http",
  "transfer_closed",
  "transfer_cancelled",
  "transfer_error",
] as const;
export interface DiagnosticReceipt {
  readonly attemptId: string;
  readonly frontendVersion: string;
  readonly expiresAt: number;
  readonly events: readonly {
    readonly stage: (typeof transferStages)[number];
    readonly at: string;
    readonly httpStatus?: number;
    readonly engineJoin?: {
      readonly bodySha256: string;
      readonly bodyUtf8Bytes: number;
      readonly completionId: string | null;
    };
  }[];
}
export const validAttemptId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const validVersion = (value: unknown): value is string =>
  typeof value === "string" && /^(?:word-[0-9a-f]{64}|unbundled-test)$/.test(value);
function keys(value: unknown, expected: string): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === expected
  );
}
// Validate the complete closed receipt before exposing it to the clipboard.
export function diagnosticReceipt(
  value: unknown,
  attemptId: string,
  version: string
): DiagnosticReceipt | undefined {
  if (
    !keys(value, "attemptId,events,expiresAt,frontendVersion") ||
    !validAttemptId(value.attemptId) ||
    value.attemptId !== attemptId ||
    !validVersion(value.frontendVersion) ||
    value.frontendVersion !== version ||
    typeof value.expiresAt !== "number" ||
    value.expiresAt <= Date.now() ||
    value.expiresAt > Date.now() + 10 * 60_000 ||
    !Array.isArray(value.events) ||
    !value.events.length ||
    value.events.length > 5
  )
    return;
  for (const event of value.events) {
    if (
      !(
        keys(event, "at,stage") ||
        keys(event, "at,httpStatus,stage") ||
        (keys(event, "at,engineJoin,httpStatus,stage") &&
          event.stage === "upstream_http" &&
          keys(event.engineJoin, "bodySha256,bodyUtf8Bytes,completionId") &&
          typeof event.engineJoin.bodySha256 === "string" &&
          /^[0-9a-f]{64}$/.test(event.engineJoin.bodySha256) &&
          Number.isInteger(event.engineJoin.bodyUtf8Bytes) &&
          (event.engineJoin.bodyUtf8Bytes as number) > 0 &&
          (event.engineJoin.bodyUtf8Bytes as number) <= 65536 &&
          (event.engineJoin.completionId === null ||
            (typeof event.engineJoin.completionId === "string" &&
              /^chatcmpl-[0-9a-f]{32}$/.test(event.engineJoin.completionId))))
      ) ||
      !transferStages.includes(event.stage as (typeof transferStages)[number]) ||
      typeof event.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at) ||
      !Number.isFinite(Date.parse(event.at))
    )
      return;
    const hasStatus = event.stage === "upstream_http" || event.stage === "response_http";
    if (
      hasStatus !== (event.httpStatus !== undefined) ||
      (hasStatus &&
        (!Number.isInteger(event.httpStatus) ||
          (event.httpStatus as number) < 100 ||
          (event.httpStatus as number) > 599))
    )
      return;
  }
  return value as unknown as DiagnosticReceipt;
}
