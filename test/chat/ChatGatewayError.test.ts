import { describe, expect, it } from "vitest";

import { ChatGatewayError, type ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";

const codes: readonly ChatGatewayErrorCode[] = [
  "INVALID_CONFIGURATION",
  "AUTH_REQUIRED",
  "ACCESS_DENIED",
  "SESSION_EXPIRED",
  "MODEL_NOT_AVAILABLE",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "NETWORK_ERROR",
  "TIMEOUT",
  "CANCELLED",
  "INVALID_RESPONSE",
  "EMPTY_RESPONSE",
];

describe("ChatGatewayError", () => {
  it.each(codes)("exposes only the controlled %s code", (code) => {
    const error = new ChatGatewayError(code);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ChatGatewayError);
    expect(error.name).toBe("ChatGatewayError");
    expect(error.message).toBe(code);
    expect(error.code).toBe(code);
    expect(JSON.stringify(error)).toBe(JSON.stringify({ name: "ChatGatewayError", code }));
  });
});
