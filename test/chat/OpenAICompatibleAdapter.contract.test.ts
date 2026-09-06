import type { CompletionRequest } from "../../src/chat/ChatGateway";
import type { ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";
import {
  OpenAICompatibleAdapter,
  type OpenAICompatibleAdapterConfig,
  type OpenAICompatibleFetch,
} from "../../src/chat/OpenAICompatibleAdapter";
import {
  runChatGatewayContract,
  type ChatGatewayContractObservations,
  type ChatGatewayFailureHarness,
  type ChatGatewayPendingHarness,
  type ChatGatewaySuccessHarness,
} from "./chatGatewayContract";

const BASE_URL = "https://engine.contract.test";
const MODEL_ID = "contract-engine-model";
const CREDENTIAL = "synthetic-private-engine-credential";
const PRIVATE_BACKEND_CONTENT = "synthetic-private-engine-content";
const EXPECTED_TEXT = "Normalized engine result.";

interface MutableObservations {
  backendAttempts: number;
  fallbackAttempts: number;
}

function createObservations(): MutableObservations {
  return { backendAttempts: 0, fallbackAttempts: 0 };
}

function snapshot(observations: MutableObservations): ChatGatewayContractObservations {
  return { ...observations };
}

function config(
  overrides: Partial<OpenAICompatibleAdapterConfig> = {}
): OpenAICompatibleAdapterConfig {
  return { baseUrl: BASE_URL, modelId: MODEL_ID, credential: CREDENTIAL, ...overrides };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completionResponse(content: string): Response {
  return jsonResponse({
    model: MODEL_ID,
    choices: [{ message: { role: "assistant", content } }],
  });
}

function expectedFetch(
  observations: MutableObservations,
  expectedUrl: string,
  response: () => Promise<Response>
): OpenAICompatibleFetch {
  return async (input) => {
    if (input !== expectedUrl) {
      observations.fallbackAttempts += 1;
    }
    observations.backendAttempts += 1;
    return response();
  };
}

function createAdapter(
  fetch: OpenAICompatibleFetch,
  overrides: Partial<OpenAICompatibleAdapterConfig> = {}
): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter(config(overrides), { fetch });
}

function statusFor(code: ChatGatewayErrorCode): number | undefined {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "ACCESS_DENIED":
      return 403;
    case "RATE_LIMITED":
      return 429;
    case "SERVICE_UNAVAILABLE":
      return 503;
    default:
      return undefined;
  }
}

function createFailure(
  code: ChatGatewayErrorCode,
  request: CompletionRequest
): ChatGatewayFailureHarness {
  const observations = createObservations();
  const observe = () => snapshot(observations);

  if (code === "INVALID_CONFIGURATION") {
    return {
      observations: observe,
      invoke: async () => {
        new OpenAICompatibleAdapter(config({ baseUrl: "http://insecure.contract.test" }));
      },
    };
  }

  if (code === "NETWORK_ERROR") {
    const fetch = expectedFetch(observations, `${BASE_URL}/v1/models`, async () => {
      throw new Error(PRIVATE_BACKEND_CONTENT);
    });
    const adapter = createAdapter(fetch);
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "SESSION_EXPIRED") {
    const fetch = expectedFetch(
      observations,
      "/v1/models",
      async () => new Response("Access", { status: 200, headers: { "Content-Type": "text/html" } })
    );
    const adapter = new OpenAICompatibleAdapter(
      { transport: "same-origin", modelId: MODEL_ID },
      { fetch }
    );
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "TIMEOUT") {
    const fetch = expectedFetch(
      observations,
      `${BASE_URL}/v1/models`,
      () => new Promise<Response>(() => undefined)
    );
    const adapter = createAdapter(fetch, { requestTimeoutMs: 1 });
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "MODEL_NOT_AVAILABLE") {
    const fetch = expectedFetch(observations, `${BASE_URL}/v1/models`, async () =>
      jsonResponse({ object: "list", data: [{ id: "different-model" }] })
    );
    const adapter = createAdapter(fetch);
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "INVALID_RESPONSE") {
    const fetch = expectedFetch(observations, `${BASE_URL}/v1/models`, async () =>
      jsonResponse({ object: "invalid", data: [] })
    );
    const adapter = createAdapter(fetch);
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "EMPTY_RESPONSE") {
    const fetch = expectedFetch(observations, `${BASE_URL}/v1/chat/completions`, async () =>
      completionResponse("   ")
    );
    const adapter = createAdapter(fetch);
    return { observations: observe, invoke: (signal) => adapter.complete(request, signal) };
  }

  const status = statusFor(code);
  const fetch = expectedFetch(observations, `${BASE_URL}/v1/models`, async () => {
    if (status !== undefined) {
      return jsonResponse({ error: { message: PRIVATE_BACKEND_CONTENT } }, status);
    }
    return jsonResponse({ object: "list", data: [{ id: MODEL_ID }] });
  });
  const adapter = createAdapter(fetch);
  return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
}

function createSuccess(): ChatGatewaySuccessHarness {
  const observations = createObservations();
  const fetch = expectedFetch(observations, `${BASE_URL}/v1/chat/completions`, async () =>
    completionResponse(EXPECTED_TEXT)
  );
  return {
    gateway: createAdapter(fetch),
    observations: () => snapshot(observations),
  };
}

function createPending(): ChatGatewayPendingHarness {
  const observations = createObservations();
  let release: ((response: Response) => void) | undefined;
  const fetch = expectedFetch(
    observations,
    `${BASE_URL}/v1/chat/completions`,
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      })
  );

  return {
    gateway: createAdapter(fetch),
    observations: () => snapshot(observations),
    releaseLateResponse: () => {
      if (!release) {
        throw new Error("Late response was released before the request started");
      }
      release(completionResponse(PRIVATE_BACKEND_CONTENT));
    },
  };
}

runChatGatewayContract({
  name: "OpenAICompatibleAdapter",
  expectedResult: { text: EXPECTED_TEXT, model: MODEL_ID },
  sensitiveValues: [CREDENTIAL, PRIVATE_BACKEND_CONTENT],
  createSuccess,
  createFailure,
  createPending,
});
