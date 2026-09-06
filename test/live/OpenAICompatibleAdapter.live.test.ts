import { describe, it } from "vitest";

import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { LiveContractDiagnostic } from "./liveContractDiagnostic";
import { startLoopbackTcpForward } from "./loopbackTcpForward";

interface RuntimeProcess {
  readonly env?: Record<string, string | undefined>;
}

const runtimeProcess = (globalThis as typeof globalThis & { readonly process?: RuntimeProcess })
  .process;
const environment = runtimeProcess?.env ?? {};
const liveEnabled = environment.OLC_WORD_LIVE_OLC_ENGINE === "1";
const exactModel = environment.OLC_WORD_LIVE_OLC_ENGINE_MODEL_ID ?? "olc-engine";

function requiredEnvironment(name: string): string {
  const value = environment[name];
  if (!value) {
    throw new Error("OLC Word live configuration is incomplete");
  }
  return value;
}

function requiredPort(name: string): number {
  const raw = requiredEnvironment(name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 65_535) {
    throw new Error("OLC Word live configuration is incomplete");
  }
  return value;
}

function syntheticText(values: readonly number[]): string {
  return String.fromCharCode(...values);
}

describe.skipIf(!liveEnabled)("protected OLC Engine live contract", () => {
  it("returns a non-empty non-stream result through the production adapter", async () => {
    const diagnostic = new LiveContractDiagnostic();
    let forward: Awaited<ReturnType<typeof startLoopbackTcpForward>> | undefined;
    let gateway: OpenAICompatibleAdapter | undefined;

    try {
      diagnostic.stage("FORWARD_START");
      diagnostic.forward("STARTED");
      forward = await startLoopbackTcpForward(
        requiredEnvironment("OLC_WORD_LIVE_OLC_ENGINE_TARGET_HOST"),
        requiredPort("OLC_WORD_LIVE_OLC_ENGINE_TARGET_PORT")
      );
      diagnostic.forward("READY");
      diagnostic.stage("FORWARD_READY");

      gateway = new OpenAICompatibleAdapter(
        {
          baseUrl: forward.baseUrl,
          modelId: exactModel,
        },
        { fetch: diagnostic.observeFetch(globalThis.fetch.bind(globalThis)) }
      );
      diagnostic.stage("ADAPTER_CREATED");

      diagnostic.stage("MODEL_GET_STARTED");
      await gateway.checkConnection();
      diagnostic.stage("MODEL_GET_COMPLETED");
      diagnostic.stage("EXACT_MODEL_FOUND");

      diagnostic.stage("COMPLETION_POST_STARTED");
      const result = await gateway.complete({
        question: syntheticText([
          82, 101, 116, 117, 114, 110, 32, 112, 108, 97, 105, 110, 32, 116, 101, 120, 116, 46,
        ]),
        context: { type: "none" },
        uiLocale: "en-US",
      });
      diagnostic.stage("COMPLETION_POST_COMPLETED");
      diagnostic.stage("RESPONSE_VALIDATED");

      if (result.text.trim().length === 0) {
        diagnostic.assertion("RESULT_NON_EMPTY");
      } else {
        diagnostic.stage("RESULT_NON_EMPTY");
      }
      if (result.model !== exactModel) {
        diagnostic.assertion("RESULT_MODEL_EXACT");
      }
    } catch (error) {
      if (diagnostic.snapshot().current_stage === "FORWARD_START") {
        diagnostic.assertion("FORWARD_START");
        diagnostic.forward("FAILED");
      } else if (diagnostic.snapshot().current_stage === "FORWARD_READY") {
        diagnostic.assertion("ADAPTER_CREATED");
      } else if (diagnostic.snapshot().current_stage === "MODEL_GET_STARTED") {
        diagnostic.assertion("MODEL_PREFLIGHT");
      } else if (diagnostic.snapshot().current_stage === "COMPLETION_POST_STARTED") {
        diagnostic.assertion("COMPLETION_REQUEST");
      }
      diagnostic.captureError(error);
    } finally {
      diagnostic.stage("FORWARD_CLEANUP");
      gateway?.disconnect();
      if (forward) {
        diagnostic.forward("CLEANUP_STARTED");
        try {
          await forward.close();
          if (!forward.isClosed()) {
            diagnostic.assertion("FORWARD_CLOSED");
            diagnostic.forward("FAILED");
            diagnostic.cleanup("FAIL");
          } else {
            diagnostic.forward("CLOSED");
            diagnostic.cleanup("PASS");
          }
        } catch (error) {
          diagnostic.assertion("FORWARD_CLOSED");
          diagnostic.captureError(error);
          diagnostic.forward("FAILED");
          diagnostic.cleanup("FAIL");
        }
      } else {
        diagnostic.cleanup("PASS");
      }
    }

    if (diagnostic.hasFailure()) {
      throw diagnostic.failure();
    }
  });
});
