import { diagnosticReasons, type DiagnosticReason } from "./diagnostics";
import { upstreamSseErrorCode, type UpstreamSseErrorCode } from "./upstreamSseError";

export type ChatGatewayErrorCode =
  | "INVALID_CONFIGURATION"
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "SESSION_EXPIRED"
  | "MODEL_NOT_AVAILABLE"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE";

export class ChatGatewayError extends Error {
  readonly code: ChatGatewayErrorCode;

  readonly reason?: DiagnosticReason;
  readonly upstreamCode?: UpstreamSseErrorCode;

  constructor(code: ChatGatewayErrorCode, reason?: DiagnosticReason, upstreamCode?: unknown) {
    super(code);
    this.name = "ChatGatewayError";
    this.code = code;
    this.reason = diagnosticReasons.includes(reason as DiagnosticReason) ? reason : undefined;
    if (this.reason === "SSE_ERROR_EVENT") this.upstreamCode = upstreamSseErrorCode(upstreamCode);
  }
}
