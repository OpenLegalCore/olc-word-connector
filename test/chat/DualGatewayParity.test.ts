import { describe, expect, it } from "vitest";

import { TaskPaneController } from "../../src/app/TaskPaneController";
import type { CompletionRequest } from "../../src/chat/ChatGateway";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";
import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { OpenWebUIAdapter } from "../../src/chat/OpenWebUIAdapter";
import { serializePromptEnvelope } from "../../src/chat/promptEnvelope";
import type { SelectionSnapshot } from "../../src/office/WordAdapter";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";

const MODEL_ID = "parity-model";
const RESULT_TEXT = "Legal answer [Z1]\n\n## Sources\n- [Z1] Act";
const UUID_V4 = "22222222-2222-4222-8222-222222222222";
const REQUEST: CompletionRequest = {
  question: "Which Slovenian law applies?",
  context: { type: "selected_text", quotedText: "Quoted selection context." },
  uiLocale: "en-US",
};
const SNAPSHOT: SelectionSnapshot = {
  snapshotId: "parity-snapshot",
  text: "Quoted selection context.",
  characterCount: 25,
  context: "body",
  capturedAt: "2026-08-31T00:00:00.000Z",
};

interface Call {
  readonly input: string;
  readonly init?: RequestInit;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(text: string, status = 200): Response {
  const chunks = [
    new TextEncoder().encode(
      status === 200
        ? `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`
        : ""
    ),
  ];
  let index = 0;
  return {
    body: {
      getReader: () => ({
        closed: Promise.resolve(undefined),
        cancel: async () => undefined,
        read: async () =>
          index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined },
        releaseLock: () => undefined,
      }),
      cancel: async () => undefined,
    },
    headers: { get: () => "text/event-stream" },
    redirected: false,
    status,
  } as unknown as Response;
}

function body(call: Call): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

function openWebUI(status = 200) {
  const calls: Call[] = [];
  const gateway = new OpenWebUIAdapter(
    {
      baseUrl: "https://owui.example.invalid",
      modelId: MODEL_ID,
      credential: "synthetic-owui-credential",
    },
    {
      uuidV4: () => UUID_V4,
      fetch: async (input, init) => {
        calls.push({ input, init });
        return input.endsWith("/models")
          ? jsonResponse({ data: [{ id: MODEL_ID }] })
          : sseResponse(RESULT_TEXT, status);
      },
    }
  );
  return { gateway, calls };
}

function engine(status = 200) {
  const calls: Call[] = [];
  const gateway = new OpenAICompatibleAdapter(
    { baseUrl: "https://engine.example.invalid", modelId: MODEL_ID },
    {
      fetch: async (input, init) => {
        calls.push({ input, init });
        return input.endsWith("/models")
          ? jsonResponse({ object: "list", data: [{ id: MODEL_ID }] })
          : jsonResponse(
              status === 200
                ? { model: MODEL_ID, choices: [{ message: { content: RESULT_TEXT } }] }
                : {},
              status
            );
      },
    }
  );
  return { gateway, calls };
}

describe("dual-gateway legal-source parity", () => {
  it("uses one semantic request envelope while keeping transports intentionally separate", async () => {
    const owui = openWebUI();
    const olc = engine();

    expect(await owui.gateway.complete(REQUEST)).toEqual({ text: RESULT_TEXT });
    expect(await olc.gateway.complete(REQUEST)).toEqual({ text: RESULT_TEXT, model: MODEL_ID });

    const owuiPayload = body(owui.calls[0]);
    const enginePayload = body(olc.calls[0]);
    expect((owuiPayload.messages as Array<{ content: string }>)[0].content).toBe(
      serializePromptEnvelope(REQUEST)
    );
    expect((enginePayload.messages as Array<{ content: string }>)[0].content).toBe(
      serializePromptEnvelope(REQUEST)
    );
    expect(owuiPayload).toMatchObject({ stream: true, chat_id: `local:${UUID_V4}` });
    expect(enginePayload).toMatchObject({ stream: false });
    expect(enginePayload).not.toHaveProperty("chat_id");
    expect(owui.calls[0].input).toContain("/api/");
    expect(olc.calls[0].input).toContain("/v1/");
  });

  it("keeps selection capture and analysis-only controller states equivalent", async () => {
    for (const harness of [openWebUI(), engine()]) {
      const word = new FakeWordAdapter(SNAPSHOT);
      const controller = new TaskPaneController(word, harness.gateway);
      const states: string[] = [];
      controller.subscribe((state) => states.push(state.kind));

      expect(
        await controller.search({
          question: REQUEST.question,
          contextMode: "selected-text",
          uiLocale: REQUEST.uiLocale,
        })
      ).toBe(true);

      expect(states).toEqual(["ready", "capturing", "searching", "result"]);
      expect(word.captureCalls).toBe(1);
      expect(word.releaseCalls).toHaveLength(1);
      expect(word.applyCalls).toHaveLength(0);
      expect(body(harness.calls[0]).messages).toEqual([
        { role: "user", content: serializePromptEnvelope(REQUEST) },
      ]);
      harness.gateway.disconnect();
    }
  });

  it("maps the same backend failure without retry or fallback", async () => {
    for (const harness of [openWebUI(503), engine(503)]) {
      await expect(harness.gateway.complete(REQUEST)).rejects.toEqual(
        new ChatGatewayError("SERVICE_UNAVAILABLE")
      );
      expect(harness.calls).toHaveLength(1);
      harness.gateway.disconnect();
    }
  });
});
