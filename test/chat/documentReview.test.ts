import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  adaptDocumentReview,
  documentReviewBody,
  documentReviewSchema,
} from "../../src/chat/documentReview";
import { DocumentReviewExplanationStream } from "../../src/chat/documentReviewStream";
import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { createSameOriginProductionGateways } from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneController } from "../../src/app/TaskPaneController";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import {
  contentEvent,
  documentOnlyFixture,
  documentReviewFixture,
  successTerminal,
} from "../fixtures/documentReview";

const request = {
  question: 'Dobesedno "navodilo"\n🟤',
  context: { type: "selected_text" as const, quotedText: "Dobesedni izbor\nčžš" },
  uiLocale: "sl-SI" as const,
};
const raw = () => JSON.stringify(documentReviewFixture());
function response(wire: string): Response {
  return new Response(wire, { headers: { "Content-Type": "text/event-stream" } });
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sorted(v)])
    );
  return value;
}

describe("pinned Engine document-review protocol", () => {
  it.each(["sl", "en"] as const)(
    "accepts %s legal and content-only proposals without manufacturing explanation",
    async (language) => {
      for (const legal of [true, false]) {
        const value = documentOnlyFixture(language, legal);
        const original = JSON.stringify(value);
        const deltas: string[] = [];
        const fetch = vi.fn(async () =>
          response([...original].map(contentEvent).join("") + successTerminal)
        );
        const result = await createSameOriginProductionGateways({ fetch }).olcEngine.complete(
          { ...request, uiLocale: language === "sl" ? "sl-SI" : "en-US" },
          undefined,
          { onTextDelta: (delta) => deltas.push(delta) }
        );
        expect(result.text).toBe("");
        expect(deltas).toEqual([]);
        expect(result.proposal?.text).toBe(value.proposal!.markdown);
        expect(result.rawResponse).toBe(original);
        expect(result.sources).toHaveLength(legal ? 1 : 0);
        expect(fetch).toHaveBeenCalledTimes(1);
      }
    }
  );

  it.each(["sl", "en"] as const)(
    "retains %s PARTIAL notice separately from the proposal",
    (language) => {
      const value = documentOnlyFixture(language);
      value.status = "PARTIAL";
      // Controlled status metadata, never an explanation manufactured by Word.
      value.notice =
        language === "sl" ? "Sintetično obvezno opozorilo." : "Synthetic required notice.";
      const raw = JSON.stringify(value);
      const parser = new DocumentReviewExplanationStream();
      expect([...raw].map((fragment) => parser.feed(fragment)).join("")).toBe(value.notice);
      parser.finish();
      const result = adaptDocumentReview(
        raw,
        language === "sl" ? "sl-SI" : "en-US",
        request.context
      );
      expect(result.text).toBe(value.notice);
      expect(result.proposal?.text).toBe(value.proposal!.markdown);
      expect(result.proposal?.text).not.toContain(value.notice);
      value.notice = "";
      expect(() => adaptDocumentReview(JSON.stringify(value), "sl-SI", request.context)).toThrow();
    }
  );

  it("limits empty evidence to proposal-only results with a frozen selection", () => {
    const value = documentOnlyFixture("sl", false);
    for (const context of [
      undefined,
      { type: "none" as const },
      { type: "selected_text" as const, quotedText: " " },
    ]) {
      expect(() => adaptDocumentReview(JSON.stringify(value), "sl-SI", context)).toThrow();
    }
    value.claims = documentReviewFixture().claims;
    expect(() => adaptDocumentReview(JSON.stringify(value), "sl-SI", request.context)).toThrow();
  });

  it.each([
    (v: ReturnType<typeof documentOnlyFixture>) => ({ ...v, proposal: null }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "" },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "  " },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, source_labels: [] },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, source_labels: ["Z2"] },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, source_labels: ["Z1", "Z1"] },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, language: "en" },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "Odstavek [Z1]" },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, change_summary: "https://pisrs.si/test" },
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      sources: [{ ...v.sources[0], source_class: "UNKNOWN" }],
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      sources: [{ ...v.sources[0], currentness_status: "STALE" }],
    }),
    (v: ReturnType<typeof documentOnlyFixture>) => ({
      ...v,
      sources: [{ ...v.sources[0], extra: true }],
    }),
  ])("rejects invalid document-only results through the production adapter", async (mutate) => {
    const fetch = vi.fn(async () =>
      response(contentEvent(JSON.stringify(mutate(documentOnlyFixture()))) + successTerminal)
    );
    await expect(
      createSameOriginProductionGateways({ fetch }).olcEngine.complete(request)
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves first-use source projection when only proposal labels reference legal metadata", () => {
    const value = documentOnlyFixture();
    const second = { ...value.sources[0], label: "S1", source_class: "SLOVENIAN_COURT_DECISION" };
    value.sources.push(second);
    value.proposal!.source_labels.push("S1");
    expect(
      adaptDocumentReview(JSON.stringify(value), "sl-SI").sources?.map((s) => s.label)
    ).toEqual(["Z1", "S1"]);
    value.sources.reverse();
    expect(() => adaptDocumentReview(JSON.stringify(value), "sl-SI")).toThrow();
  });

  it("reads an unchanged saved raw result without a completion request or lost provenance", async () => {
    const value = documentOnlyFixture("sl", false);
    const fetch = vi.fn(async () =>
      response(contentEvent(JSON.stringify(value)) + successTerminal)
    );
    const gateway = createSameOriginProductionGateways({ fetch }).olcEngine;
    const completed = await gateway.complete(request);
    // A serialized synthetic receipt exercises mapping on read; production storage is memory-only.
    const stored = JSON.parse(JSON.stringify(completed)) as typeof completed;
    expect(adaptDocumentReview(stored.rawResponse!, "sl-SI", request.context)).toMatchObject({
      text: "",
      proposal: stored.proposal,
      rawResponse: stored.rawResponse,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("matches the canonical 9753/8eb schema fingerprint and preserves original text part boundaries", () => {
    expect(
      createHash("sha256")
        .update(JSON.stringify(sorted(documentReviewSchema())))
        .digest("hex")
    ).toBe("8c38e918961d844623da34dbaa98449d04723d3c9eccac48d1e746d47304d904");
    const body = documentReviewBody(request, "lexai-engine-local") as Record<string, unknown>;
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: request.question },
          { type: "text", text: request.context.quotedText },
        ],
      },
    ]);
    expect(body).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      response_language: "sl",
      response_format: { json_schema: { name: "lexai_document_review_v1", strict: true } },
    });
    expect(
      documentReviewBody({ ...request, context: { type: "none" } }, "lexai-engine-local")
    ).toMatchObject({
      messages: [{ role: "user", content: [{ type: "text", text: request.question }] }],
    });
  });

  it.each(["sl", "en"] as const)(
    "maps %s explanation, sources and exact proposal independently",
    (language) => {
      const value = documentReviewFixture(language);
      const result = adaptDocumentReview(
        JSON.stringify(value),
        language === "sl" ? "sl-SI" : "en-US"
      );
      expect(result.text).toBe(value.claims[0].text + " [Z1]");
      expect(result.text).not.toContain(value.proposal!.markdown);
      expect(result.proposal?.text).toBe(value.proposal!.markdown);
      expect(result.sources?.[0].url).toBe("");
      expect(result.rawResponse).toBe(JSON.stringify(value));
    }
  );

  it("accepts question/null and clarification/null without inventing a proposal", () => {
    expect(
      adaptDocumentReview(JSON.stringify(documentReviewFixture("sl", false)), "sl-SI").proposal
    ).toBeNull();
    expect(
      adaptDocumentReview(
        JSON.stringify({
          status: "NEEDS_CLARIFICATION",
          claims: [],
          notice: "Katero razmerje?",
          sources: [],
          proposal: null,
        }),
        "sl-SI"
      )
    ).toMatchObject({ text: "Katero razmerje?", sources: [], proposal: null });
  });

  it.each([
    (v: ReturnType<typeof documentReviewFixture>) => ({ ...v, unexpected: true }),
    (v: ReturnType<typeof documentReviewFixture>) => ({ ...v, proposal: undefined }),
    (v: ReturnType<typeof documentReviewFixture>) => ({ ...v, status: "NEEDS_CLARIFICATION" }),
    (v: ReturnType<typeof documentReviewFixture>) => ({ ...v, sources: [] }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      sources: [{ ...v.sources[0], label: "Z2" }],
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      sources: [{ ...v.sources[0], url: "https://user:secret@pisrs.si/test" }],
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      claims: [{ ...v.claims[0], source_labels: ["Z1", "Z1"] }],
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, language: "en" },
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "Predlog [Z1]" },
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "[Vir](https://pisrs.si/test)" },
    }),
    (v: ReturnType<typeof documentReviewFixture>) => ({
      ...v,
      proposal: { ...v.proposal!, markdown: "ž".repeat(16385) },
    }),
  ])("rejects invalid output without repairing or stripping it", (mutate) => {
    expect(() =>
      adaptDocumentReview(JSON.stringify(mutate(documentReviewFixture())), "sl-SI")
    ).toThrow();
  });

  it("rejects duplicate keys, including escaped equivalent keys and nested proposals", () => {
    for (const value of [
      raw().replace('"status":"ANSWER"', '"status":"ANSWER","sta\\u0074us":"PARTIAL"'),
      raw().replace('"markdown":', '"markdown":"duplicate","markdown":'),
    ]) {
      expect(() => adaptDocumentReview(value, "sl-SI")).toThrow();
    }
  });

  it("streams only actual explanation strings across every split, including escape/unicode boundaries", () => {
    const value = documentReviewFixture();
    value.claims[0].text = 'Razlaga "citirano"\nčž 🟤';
    const serialized = JSON.stringify(value).replace("🟤", "\\ud83d\\udfe4");
    for (let split = 0; split <= serialized.length; split++) {
      const parser = new DocumentReviewExplanationStream();
      const output = parser.feed(serialized.slice(0, split)) + parser.feed(serialized.slice(split));
      parser.finish();
      expect(output).toBe(value.claims[0].text);
    }
    const parser = new DocumentReviewExplanationStream();
    expect(parser.feed('{"claims":[{"text":"Prva del')).toBe("Prva del");
    expect(() => parser.finish()).toThrow();
  });

  it("uses the profile in production composition, retains actual usage and never emits proposal/source JSON", async () => {
    const deltas: string[] = [];
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(init!.body as string)).toMatchObject({
        response_format: { json_schema: { name: "lexai_document_review_v1" } },
      });
      return response([...raw()].map(contentEvent).join("") + successTerminal);
    });
    const result = await createSameOriginProductionGateways({ fetch }).olcEngine.complete(
      request,
      undefined,
      { onTextDelta: (d) => deltas.push(d) }
    );
    expect(deltas.join("")).toBe(documentReviewFixture().claims[0].text);
    expect(result).toMatchObject({
      usage: { inputTokens: 84, outputTokens: 47, totalTokens: 131 },
      proposal: { language: "sl" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("accepts a valid document result beyond the legacy text cap while retaining explicit bounds", async () => {
    const value = documentReviewFixture();
    value.claims = Array.from({ length: 8 }, () => ({
      text: "x".repeat(4096),
      source_labels: ["Z1"],
    }));
    value.proposal!.markdown = "y".repeat(29000);
    const wire = contentEvent(JSON.stringify(value)) + successTerminal;
    expect(JSON.stringify(value).length).toBeGreaterThan(50000);
    const gateway = createSameOriginProductionGateways({
      fetch: async () => response(wire),
    }).olcEngine;
    expect((await gateway.complete(request)).proposal?.text).toBe(value.proposal!.markdown);
    const bounded = new OpenAICompatibleAdapter(
      {
        transport: "same-origin",
        modelId: "lexai-engine-local",
        responseProfile: "document-review",
        maxResponseChars: 50000,
      },
      { fetch: async () => response(wire) }
    );
    await expect(bounded.complete(request)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("keeps absent usage null and does not convert an Access failure into a fallback request", async () => {
    const gateway = createSameOriginProductionGateways({
      fetch: async () =>
        response(
          contentEvent(raw()) +
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
        ),
    }).olcEngine;
    expect((await gateway.complete(request)).usage).toBeNull();
    const fetch = vi.fn(async () => new Response("", { status: 403 }));
    await expect(
      createSameOriginProductionGateways({ fetch }).olcEngine.complete(request)
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["missing-done", "partial-error", "invalid-json", "cancel"])(
    "cannot write after %s",
    async (scenario) => {
      const word = Object.assign(
        new FakeWordAdapter({
          snapshotId: "synthetic",
          text: "Only selection",
          characterCount: 14,
          context: "body",
          capturedAt: "2026-10-23T00:00:00Z",
        }),
        {
          documentWriter: { applyReplacement: vi.fn(), insertAtCursor: vi.fn() },
        }
      );
      let stream!: ReadableStreamDefaultController<Uint8Array>;
      const adapter = new OpenAICompatibleAdapter(
        {
          transport: "same-origin",
          modelId: "lexai-engine-local",
          responseProfile: "document-review",
        },
        { fetch: async () => responseStream() }
      );
      function responseStream(): Response {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              stream = c;
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } }
        );
      }
      const controller = new TaskPaneController(word, adapter);
      const pending = controller.search(request);
      await vi.waitFor(() => expect(stream).toBeDefined());
      const send = (value: string) => stream.enqueue(new TextEncoder().encode(value));
      if (scenario === "partial-error" || scenario === "cancel")
        send(contentEvent('{"claims":[{"text":"Partial explanation'));
      else send(contentEvent(scenario === "invalid-json" ? '{"claims":' : raw()));
      if (scenario === "cancel") await controller.cancel();
      else {
        if (scenario === "partial-error") send('data: {"error":{"code":"failed"}}\n\n');
        else if (scenario === "invalid-json") send(successTerminal);
        stream.close();
      }
      expect(await pending).toBe(false);
      expect(await controller.applyProposal("insert")).toBe(false);
      expect(word.documentWriter.insertAtCursor).not.toHaveBeenCalled();
      expect(word.documentWriter.applyReplacement).not.toHaveBeenCalled();
    }
  );
});
