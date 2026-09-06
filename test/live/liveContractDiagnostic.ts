import { ChatGatewayError, type ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";
import type { OpenAICompatibleFetch } from "../../src/chat/OpenAICompatibleAdapter";

export const OLC_WORD_LIVE_DIAGNOSTIC_PREFIX = "OLC_WORD_LIVE_DIAGNOSTIC:";

export type LiveContractStage =
  | "FORWARD_START"
  | "FORWARD_READY"
  | "ADAPTER_CREATED"
  | "MODEL_GET_STARTED"
  | "MODEL_GET_COMPLETED"
  | "EXACT_MODEL_FOUND"
  | "COMPLETION_POST_STARTED"
  | "COMPLETION_POST_COMPLETED"
  | "RESPONSE_VALIDATED"
  | "RESULT_NON_EMPTY"
  | "FORWARD_CLEANUP";

export type LiveRequestMethodClass = "MODEL_GET" | "COMPLETION_POST";
export type LiveContentTypeClass = "JSON" | "HTML" | "SSE" | "OTHER" | "MISSING";
export type LiveForwardLifecycleState =
  "NOT_STARTED" | "STARTED" | "READY" | "CLEANUP_STARTED" | "CLOSED" | "FAILED";
export type LiveCleanupResult = "NOT_RUN" | "PASS" | "FAIL";
export type LiveAssertionIdentifier =
  | "FORWARD_START"
  | "ADAPTER_CREATED"
  | "MODEL_PREFLIGHT"
  | "COMPLETION_REQUEST"
  | "RESULT_NON_EMPTY"
  | "RESULT_MODEL_EXACT"
  | "FORWARD_CLOSED";

interface MutableRequestEvidence {
  attempted: boolean;
  status: number | null;
  redirect: boolean | null;
  content_type: LiveContentTypeClass | null;
}

export interface LiveContractDiagnosticSnapshot {
  readonly current_stage: LiveContractStage;
  readonly requests: Readonly<Record<LiveRequestMethodClass, Readonly<MutableRequestEvidence>>>;
  readonly error_code: ChatGatewayErrorCode | null;
  readonly assertion: LiveAssertionIdentifier | null;
  readonly forward_state: LiveForwardLifecycleState;
  readonly cleanup: LiveCleanupResult;
}

function emptyRequestEvidence(): MutableRequestEvidence {
  return { attempted: false, status: null, redirect: null, content_type: null };
}

function sanitizedStatus(status: number): number | null {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function contentTypeClass(value: string | null): LiveContentTypeClass {
  if (value === null || value.trim() === "") {
    return "MISSING";
  }
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  if (mediaType === "application/json" || mediaType.endsWith("+json")) {
    return "JSON";
  }
  if (mediaType === "text/html") {
    return "HTML";
  }
  if (mediaType === "text/event-stream") {
    return "SSE";
  }
  return "OTHER";
}

function methodClass(method: string | undefined): LiveRequestMethodClass {
  return method?.toUpperCase() === "GET" ? "MODEL_GET" : "COMPLETION_POST";
}

export class LiveContractDiagnostic {
  private currentStage: LiveContractStage = "FORWARD_START";
  private readonly requests: Record<LiveRequestMethodClass, MutableRequestEvidence> = {
    MODEL_GET: emptyRequestEvidence(),
    COMPLETION_POST: emptyRequestEvidence(),
  };
  private errorCode: ChatGatewayErrorCode | null = null;
  private assertionIdentifier: LiveAssertionIdentifier | null = null;
  private forwardState: LiveForwardLifecycleState = "NOT_STARTED";
  private cleanupResult: LiveCleanupResult = "NOT_RUN";
  private failed = false;

  stage(stage: LiveContractStage): void {
    if (!this.failed) {
      this.currentStage = stage;
    }
  }

  forward(state: LiveForwardLifecycleState): void {
    this.forwardState = state;
  }

  cleanup(result: LiveCleanupResult): void {
    this.cleanupResult = result;
  }

  assertion(identifier: LiveAssertionIdentifier): void {
    if (this.assertionIdentifier === null) {
      this.assertionIdentifier = identifier;
    }
    this.failed = true;
  }

  captureError(error: unknown): void {
    if (error instanceof ChatGatewayError) {
      this.errorCode = error.code;
    }
    this.failed = true;
  }

  observeFetch(fetchImplementation: OpenAICompatibleFetch): OpenAICompatibleFetch {
    return async (input, init) => {
      const requestClass = methodClass(init?.method);
      const evidence = this.requests[requestClass];
      evidence.attempted = true;
      const response = await fetchImplementation(input, init);
      evidence.status = sanitizedStatus(response.status);
      evidence.redirect = response.redirected;
      evidence.content_type = contentTypeClass(response.headers.get("content-type"));
      return response;
    };
  }

  hasFailure(): boolean {
    return this.failed;
  }

  snapshot(): LiveContractDiagnosticSnapshot {
    return {
      current_stage: this.currentStage,
      requests: {
        MODEL_GET: { ...this.requests.MODEL_GET },
        COMPLETION_POST: { ...this.requests.COMPLETION_POST },
      },
      error_code: this.errorCode,
      assertion: this.assertionIdentifier,
      forward_state: this.forwardState,
      cleanup: this.cleanupResult,
    };
  }

  failure(): Error {
    return new Error(`${OLC_WORD_LIVE_DIAGNOSTIC_PREFIX}${JSON.stringify(this.snapshot())}`);
  }
}
