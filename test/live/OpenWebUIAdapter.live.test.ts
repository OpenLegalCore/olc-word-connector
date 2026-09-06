import { describe, expect, it } from "vitest";

import { OpenWebUIAdapter } from "../../src/chat/OpenWebUIAdapter";

interface RuntimeProcess {
  readonly env?: Record<string, string | undefined>;
}

const runtimeProcess = (globalThis as typeof globalThis & { readonly process?: RuntimeProcess })
  .process;
const environment = runtimeProcess?.env ?? {};
const liveEnabled = environment.OLC_WORD_LIVE_OPENWEBUI === "1";

function requiredEnvironment(name: string): string {
  const value = environment[name];
  if (!value) {
    throw new Error("OLC Word live configuration is incomplete");
  }
  return value;
}

describe.skipIf(!liveEnabled)("protected Open WebUI live contract", () => {
  it("returns a non-empty provider-neutral completion through the approved adapter", async () => {
    const gateway = new OpenWebUIAdapter({
      baseUrl: requiredEnvironment("OLC_WORD_LIVE_OPENWEBUI_BASE_URL"),
      modelId: requiredEnvironment("OLC_WORD_LIVE_OPENWEBUI_MODEL_ID"),
      credential: requiredEnvironment("OLC_WORD_LIVE_OPENWEBUI_CREDENTIAL"),
    });

    try {
      await gateway.checkConnection();
      const result = await gateway.complete({
        question: "Which Slovenian legal source applies to this synthetic question?",
        context: { type: "none" },
        uiLocale: "en-US",
      });

      expect(result.text.trim().length).toBeGreaterThan(0);
    } finally {
      gateway.disconnect();
    }
  });
});
