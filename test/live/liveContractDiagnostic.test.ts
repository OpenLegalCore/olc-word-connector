import { describe, expect, it, vi } from "vitest";

import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import { LiveContractDiagnostic, OLC_WORD_LIVE_DIAGNOSTIC_PREFIX } from "./liveContractDiagnostic";

function response(status: number, contentType: string | null, redirected = false): Response {
  return {
    headers: { get: () => contentType },
    redirected,
    status,
  } as unknown as Response;
}

describe("LiveContractDiagnostic", () => {
  it("retains only bounded request metadata and never reads the body", async () => {
    const diagnostic = new LiveContractDiagnostic();
    const bodyRead = vi.fn();
    const fetchImplementation = vi.fn(async () => {
      const result = response(200, "application/json; charset=utf-8");
      Object.assign(result, { json: bodyRead });
      return result;
    });
    const observed = diagnostic.observeFetch(fetchImplementation);

    await observed("https://private.example.invalid/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer private-credential" },
      body: "private-request-body",
    });

    expect(diagnostic.snapshot().requests).toEqual({
      MODEL_GET: {
        attempted: true,
        status: 200,
        redirect: false,
        content_type: "JSON",
      },
      COMPLETION_POST: {
        attempted: false,
        status: null,
        redirect: null,
        content_type: null,
      },
    });
    expect(bodyRead).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostic.snapshot())).not.toContain("private");
  });

  it.each([
    ["text/html", "HTML"],
    ["text/event-stream", "SSE"],
    ["application/problem+json", "JSON"],
    ["text/plain", "OTHER"],
    [null, "MISSING"],
  ] as const)("classifies %s without retaining its raw value", async (contentType, expected) => {
    const diagnostic = new LiveContractDiagnostic();
    const observed = diagnostic.observeFetch(async () => response(503, contentType, true));

    await observed("https://private.example.invalid/v1/chat/completions", { method: "POST" });

    expect(diagnostic.snapshot().requests.COMPLETION_POST).toEqual({
      attempted: true,
      status: 503,
      redirect: true,
      content_type: expected,
    });
  });

  it("retains a typed gateway code but discards raw unknown errors", () => {
    const typed = new LiveContractDiagnostic();
    typed.stage("MODEL_GET_STARTED");
    typed.captureError(new ChatGatewayError("MODEL_NOT_AVAILABLE"));

    expect(typed.snapshot()).toMatchObject({
      current_stage: "MODEL_GET_STARTED",
      error_code: "MODEL_NOT_AVAILABLE",
      assertion: null,
    });

    const unknown = new LiveContractDiagnostic();
    unknown.captureError(new Error("private endpoint and response"));
    expect(unknown.snapshot().error_code).toBeNull();
    expect(unknown.failure().message).not.toContain("private");
  });

  it("freezes the failure stage while recording cleanup outcome", () => {
    const diagnostic = new LiveContractDiagnostic();
    diagnostic.forward("READY");
    diagnostic.stage("RESULT_NON_EMPTY");
    diagnostic.assertion("RESULT_MODEL_EXACT");
    diagnostic.stage("FORWARD_CLEANUP");
    diagnostic.forward("CLOSED");
    diagnostic.cleanup("PASS");

    expect(diagnostic.snapshot()).toMatchObject({
      current_stage: "RESULT_NON_EMPTY",
      assertion: "RESULT_MODEL_EXACT",
      forward_state: "CLOSED",
      cleanup: "PASS",
    });
    expect(diagnostic.failure().message).toBe(
      `${OLC_WORD_LIVE_DIAGNOSTIC_PREFIX}${JSON.stringify(diagnostic.snapshot())}`
    );
  });
});
