import { diagnosticReasons, type DiagnosticReason } from "./diagnostics";

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

  constructor(code: ChatGatewayErrorCode, reason?: DiagnosticReason) {
    super(code);
    this.name = "ChatGatewayError";
    this.code = code;
    this.reason = diagnosticReasons.includes(reason as DiagnosticReason) ? reason : undefined;
  }
}
