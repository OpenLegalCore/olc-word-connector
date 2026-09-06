import { describe, expect, it, vi } from "vitest";

import type { ChatGateway, CompletionRequest, CompletionResult } from "../../src/chat/ChatGateway";
import { ChatGatewayError, type ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";

export const CHAT_GATEWAY_CONTRACT_REQUEST: CompletionRequest = {
  question: "Synthetic private legal question.",
  context: { type: "selected_text", quotedText: "Synthetic private selected document text." },
  uiLocale: "en-US",
};

const CONTROLLED_ERROR_CODES: readonly ChatGatewayErrorCode[] = [
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

export interface ChatGatewayContractObservations {
  readonly backendAttempts: number;
  readonly fallbackAttempts: number;
}

interface ObservedContractHarness {
  observations(): ChatGatewayContractObservations;
}

export interface ChatGatewaySuccessHarness extends ObservedContractHarness {
  readonly gateway: ChatGateway;
}

export interface ChatGatewayFailureHarness extends ObservedContractHarness {
  invoke(signal?: AbortSignal): Promise<unknown>;
}

export interface ChatGatewayPendingHarness extends ObservedContractHarness {
  readonly gateway: ChatGateway;
  releaseLateResponse(): void;
}

export interface ChatGatewayContractFactory {
  readonly name: string;
  readonly expectedResult: CompletionResult;
  readonly sensitiveValues: readonly string[];
  createSuccess(): ChatGatewaySuccessHarness;
  createFailure(code: ChatGatewayErrorCode, request: CompletionRequest): ChatGatewayFailureHarness;
  createPending(): ChatGatewayPendingHarness;
}

interface ConsoleCapture {
  readonly output: () => string;
  readonly restore: () => void;
}

interface DocumentBoundary {
  readonly assertUnchanged: () => void;
  readonly restore: () => void;
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function captureConsole(): ConsoleCapture {
  const spies = [
    vi.spyOn(console, "debug").mockImplementation(() => undefined),
    vi.spyOn(console, "info").mockImplementation(() => undefined),
    vi.spyOn(console, "log").mockImplementation(() => undefined),
    vi.spyOn(console, "warn").mockImplementation(() => undefined),
    vi.spyOn(console, "error").mockImplementation(() => undefined),
  ];

  return {
    output: () =>
      spies
        .flatMap((spy) => spy.mock.calls)
        .flatMap((call) => call)
        .map(stringifyLogValue)
        .join("\n"),
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}

function protectDocumentBoundary(): DocumentBoundary {
  const originalBody = document.body.innerHTML;
  const globalObject = globalThis as typeof globalThis & { Word?: unknown };
  const originalWord = globalObject.Word;
  let officeAccesses = 0;
  Object.defineProperty(globalObject, "Word", {
    configurable: true,
    value: new Proxy(
      {},
      {
        get: () => {
          officeAccesses++;
          throw new Error("Office access is forbidden by the ChatGateway contract");
        },
      }
    ),
  });

  return {
    assertUnchanged: () => {
      expect(document.body.innerHTML).toBe(originalBody);
      expect(officeAccesses).toBe(0);
    },
    restore: () => {
      if (originalWord === undefined) {
        Reflect.deleteProperty(globalObject, "Word");
      } else {
        Object.defineProperty(globalObject, "Word", {
          configurable: true,
          value: originalWord,
        });
      }
      document.body.innerHTML = originalBody;
    },
  };
}

async function expectControlledError(
  operation: Promise<unknown>,
  code: ChatGatewayErrorCode
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected controlled gateway error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ChatGatewayError);
    expect((error as ChatGatewayError).name).toBe("ChatGatewayError");
    expect((error as ChatGatewayError).message).toBe(code);
    expect((error as ChatGatewayError).code).toBe(code);
  }
}

function expectSafeObservations(observations: ChatGatewayContractObservations): void {
  expect(observations.backendAttempts).toBeLessThanOrEqual(1);
  expect(observations.fallbackAttempts).toBe(0);
}

function expectNoSensitiveLogs(output: string, factory: ChatGatewayContractFactory): void {
  for (const sensitiveValue of [
    CHAT_GATEWAY_CONTRACT_REQUEST.question,
    ...(CHAT_GATEWAY_CONTRACT_REQUEST.context.type === "selected_text"
      ? [CHAT_GATEWAY_CONTRACT_REQUEST.context.quotedText]
      : []),
    factory.expectedResult.text,
    ...factory.sensitiveValues,
  ]) {
    expect(output).not.toContain(sensitiveValue);
  }
}

export function runChatGatewayContract(factory: ChatGatewayContractFactory): void {
  describe(`${factory.name} shared ChatGateway contract`, () => {
    it("returns a non-empty normalized provider-neutral result without side effects", async () => {
      const consoleCapture = captureConsole();
      const documentBoundary = protectDocumentBoundary();

      try {
        const harness = factory.createSuccess();
        const result = await harness.gateway.complete(CHAT_GATEWAY_CONTRACT_REQUEST);

        expect(result).toEqual(factory.expectedResult);
        expect(result.text.trim().length).toBeGreaterThan(0);
        expectSafeObservations(harness.observations());
        expectNoSensitiveLogs(consoleCapture.output(), factory);
        documentBoundary.assertUnchanged();
      } finally {
        documentBoundary.restore();
        consoleCapture.restore();
      }
    });

    it.each(CONTROLLED_ERROR_CODES)("returns only the controlled %s failure", async (code) => {
      const consoleCapture = captureConsole();
      const documentBoundary = protectDocumentBoundary();
      const abortController = new AbortController();
      if (code === "CANCELLED") {
        abortController.abort();
      }

      try {
        const harness = factory.createFailure(code, CHAT_GATEWAY_CONTRACT_REQUEST);
        await expectControlledError(
          harness.invoke(code === "CANCELLED" ? abortController.signal : undefined),
          code
        );
        expectSafeObservations(harness.observations());
        expectNoSensitiveLogs(consoleCapture.output(), factory);
        documentBoundary.assertUnchanged();
      } finally {
        documentBoundary.restore();
        consoleCapture.restore();
      }
    });

    it("keeps explicit cancellation terminal when a backend result arrives late", async () => {
      const consoleCapture = captureConsole();
      const documentBoundary = protectDocumentBoundary();
      const abortController = new AbortController();
      let resolved = false;

      try {
        const harness = factory.createPending();
        const completion = harness.gateway.complete(
          CHAT_GATEWAY_CONTRACT_REQUEST,
          abortController.signal
        );
        void completion.then(
          () => {
            resolved = true;
          },
          () => undefined
        );

        abortController.abort();
        await expectControlledError(completion, "CANCELLED");
        harness.releaseLateResponse();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(resolved).toBe(false);
        expectSafeObservations(harness.observations());
        expectNoSensitiveLogs(consoleCapture.output(), factory);
        documentBoundary.assertUnchanged();
      } finally {
        documentBoundary.restore();
        consoleCapture.restore();
      }
    });
  });
}
