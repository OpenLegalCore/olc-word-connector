import type { CompletionRequest } from "../../src/chat/ChatGateway";
import type { ChatGatewayErrorCode } from "../../src/chat/ChatGatewayError";
import {
  OpenWebUIAdapter,
  type OpenWebUIAdapterConfig,
  type OpenWebUIFetch,
} from "../../src/chat/OpenWebUIAdapter";
import {
  runChatGatewayContract,
  type ChatGatewayContractObservations,
  type ChatGatewayFailureHarness,
  type ChatGatewayPendingHarness,
  type ChatGatewaySuccessHarness,
} from "./chatGatewayContract";

const BASE_URL = "https://openwebui.contract.test";
const MODEL_ID = "contract-model";
const CREDENTIAL = "synthetic-private-contract-credential";
const PRIVATE_BACKEND_CONTENT = "synthetic-private-backend-content";
const EXPECTED_TEXT = "Normalized provider-neutral result.";
const UUID_V4 = "11111111-1111-4111-8111-111111111111";

interface MutableObservations {
  backendAttempts: number;
  fallbackAttempts: number;
}

function createObservations(): MutableObservations {
  return {
    backendAttempts: 0,
    fallbackAttempts: 0,
  };
}

function snapshot(observations: MutableObservations): ChatGatewayContractObservations {
  return { ...observations };
}

function config(overrides: Partial<OpenWebUIAdapterConfig> = {}): OpenWebUIAdapterConfig {
  return {
    baseUrl: BASE_URL,
    modelId: MODEL_ID,
    credential: CREDENTIAL,
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function eventStreamResponse(contentParts: readonly string[]): Response {
  const encoder = new TextEncoder();
  const chunks = [
    ...contentParts.map(
      (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
    ),
    "data: [DONE]\n\n",
  ];

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    }
  );
}

function expectedFetch(
  observations: MutableObservations,
  expectedUrl: string,
  response: () => Promise<Response>
): OpenWebUIFetch {
  return async (input) => {
    if (input !== expectedUrl) {
      observations.fallbackAttempts += 1;
    }
    observations.backendAttempts += 1;
    return response();
  };
}

function createAdapter(fetch: OpenWebUIFetch, overrides: Partial<OpenWebUIAdapterConfig> = {}) {
  return new OpenWebUIAdapter(config(overrides), {
    fetch,
    uuidV4: () => UUID_V4,
  });
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
        new OpenWebUIAdapter(config({ baseUrl: "http://insecure.contract.test" }));
      },
    };
  }

  if (code === "NETWORK_ERROR") {
    const fetch = expectedFetch(observations, `${BASE_URL}/api/models`, async () => {
      throw new Error(PRIVATE_BACKEND_CONTENT);
    });
    const adapter = createAdapter(fetch);
    return {
      observations: observe,
      invoke: (signal) => adapter.checkConnection(signal),
    };
  }

  if (code === "SESSION_EXPIRED") {
    const fetch = expectedFetch(
      observations,
      "/api/models",
      async () => new Response("Access", { status: 200, headers: { "Content-Type": "text/html" } })
    );
    const adapter = new OpenWebUIAdapter(
      { transport: "same-origin", modelId: MODEL_ID },
      { fetch, uuidV4: () => UUID_V4 }
    );
    return { observations: observe, invoke: (signal) => adapter.checkConnection(signal) };
  }

  if (code === "TIMEOUT") {
    const fetch = expectedFetch(
      observations,
      `${BASE_URL}/api/models`,
      () => new Promise<Response>(() => undefined)
    );
    const adapter = createAdapter(fetch, { requestTimeoutMs: 1 });
    return {
      observations: observe,
      invoke: (signal) => adapter.checkConnection(signal),
    };
  }

  if (code === "MODEL_NOT_AVAILABLE") {
    const fetch = expectedFetch(observations, `${BASE_URL}/api/models`, async () =>
      jsonResponse({ data: [{ id: "different-model" }] })
    );
    const adapter = createAdapter(fetch);
    return {
      observations: observe,
      invoke: (signal) => adapter.checkConnection(signal),
    };
  }

  if (code === "INVALID_RESPONSE") {
    const fetch = expectedFetch(
      observations,
      `${BASE_URL}/api/models`,
      async () =>
        new Response(PRIVATE_BACKEND_CONTENT, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    const adapter = createAdapter(fetch);
    return {
      observations: observe,
      invoke: (signal) => adapter.checkConnection(signal),
    };
  }

  if (code === "EMPTY_RESPONSE") {
    const fetch = expectedFetch(observations, `${BASE_URL}/api/chat/completions`, async () =>
      eventStreamResponse([])
    );
    const adapter = createAdapter(fetch);
    return {
      observations: observe,
      invoke: (signal) => adapter.complete(request, signal),
    };
  }

  const status = statusFor(code);
  const fetch = expectedFetch(observations, `${BASE_URL}/api/models`, async () => {
    if (status !== undefined) {
      return jsonResponse({ detail: PRIVATE_BACKEND_CONTENT }, status);
    }
    return jsonResponse({ data: [{ id: MODEL_ID }] });
  });
  const adapter = createAdapter(fetch);
  return {
    observations: observe,
    invoke: (signal) => adapter.checkConnection(signal),
  };
}

function createSuccess(): ChatGatewaySuccessHarness {
  const observations = createObservations();
  const fetch = expectedFetch(observations, `${BASE_URL}/api/chat/completions`, async () =>
    eventStreamResponse(["Normalized provider-", "neutral result."])
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
    `${BASE_URL}/api/chat/completions`,
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
      release(eventStreamResponse([PRIVATE_BACKEND_CONTENT]));
    },
  };
}

runChatGatewayContract({
  name: "OpenWebUIAdapter",
  expectedResult: { text: EXPECTED_TEXT },
  sensitiveValues: [CREDENTIAL, PRIVATE_BACKEND_CONTENT],
  createSuccess,
  createFailure,
  createPending,
});
