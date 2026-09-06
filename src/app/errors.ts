import type { ChatGatewayErrorCode } from "../chat/ChatGatewayError";
import type { WordAdapterErrorCode } from "../office/WordAdapter";

export type AppErrorCode =
  "CAPTURE_FAILED" | "COMPLETION_FAILED" | ChatGatewayErrorCode | WordAdapterErrorCode;

export interface AppError {
  readonly code: AppErrorCode;
}
