// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { validEvent } from "../../infrastructure/cloudflare/word-session/diagnostics.js";
import { handleRequest } from "../../infrastructure/cloudflare/word-gateway-example/worker.js";
import { diagnosticReceipt } from "../../src/chat/diagnostics";
const id = "chatcmpl-" + "a".repeat(32);
const base = {
  stage: "upstream_http",
  at: new Date().toISOString(),
  httpStatus: 200,
  engineJoin: { bodySha256: "b".repeat(64), bodyUtf8Bytes: 42, completionId: id },
};
const receipt = (event: unknown) => ({
  attemptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  frontendVersion: "unbundled-test",
  expiresAt: Date.now() + 60_000,
  events: [event],
});
const accepted = (event: unknown) =>
  diagnosticReceipt(receipt(event), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "unbundled-test");
describe("closed metadata-only Engine correlation", () => {
  it("keeps old receipts and the new exact upstream event readable", () => {
    const old = { stage: "upstream_http", at: base.at, httpStatus: 200 };
    for (const event of [
      old,
      base,
      { ...base, engineJoin: { ...base.engineJoin, completionId: null } },
    ]) {
      expect(validEvent(event)).toBe(true);
      expect(accepted(event)).toBeDefined();
    }
  });
  it.each([
    { ...base, stage: "response_http" },
    { ...base, extra: "unapproved" },
    { ...base, engineJoin: { ...base.engineJoin, extra: "unapproved" } },
    { ...base, engineJoin: { ...base.engineJoin, bodySha256: "untrusted" } },
    { ...base, engineJoin: { ...base.engineJoin, bodyUtf8Bytes: 65537 } },
    { ...base, engineJoin: { ...base.engineJoin, completionId: "untrusted" } },
  ])("rejects malformed or misplaced correlation metadata", (event) => {
    expect(validEvent(event)).toBe(false);
    expect(accepted(event)).toBeUndefined();
  });
  it("hashes the final gateway serialization and ignores an invalid ACK", async () => {
    const input = '{ "model": "lexai-engine-local", "messages": [], "stream": true }';
    let final = "";
    const observe = vi.fn();
    const response = await handleRequest(
      new Request("https://word.example.invalid/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input,
      }),
      {
        PUBLIC_HOST: "word.example.invalid",
        ENGINE_ORIGIN: "https://engine.example.invalid",
        ENGINE_API_KEY: "synthetic",
        CF_ACCESS_CLIENT_ID: "synthetic",
        CF_ACCESS_CLIENT_SECRET: "synthetic",
      },
      (async (req: Request) => {
        final = await req.text();
        return new Response("data: {}\n\n", {
          headers: { "Content-Type": "text/event-stream", "X-OLC-Completion-ID": "untrusted" },
        });
      }) as typeof fetch,
      observe
    );
    expect(response.status).toBe(200);
    expect(final).not.toBe(input);
    expect(observe).toHaveBeenCalledWith("upstream_http", 200, {
      bodySha256: createHash("sha256").update(final).digest("hex"),
      bodyUtf8Bytes: Buffer.byteLength(final),
      completionId: null,
    });
    await response.body?.cancel();
  });
  it("a diagnostic hashing failure does not fail or retry the functional request", async () => {
    const spy = vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(new Error("synthetic"));
    const upstream = vi.fn(
      async () => new Response("data: {}\n\n", { headers: { "Content-Type": "text/event-stream" } })
    );
    try {
      const response = await handleRequest(
        new Request("https://word.example.invalid/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"model":"lexai-engine-local","messages":[],"stream":true}',
        }),
        {
          PUBLIC_HOST: "word.example.invalid",
          ENGINE_ORIGIN: "https://engine.example.invalid",
          ENGINE_API_KEY: "synthetic",
          CF_ACCESS_CLIENT_ID: "synthetic",
          CF_ACCESS_CLIENT_SECRET: "synthetic",
        },
        upstream
      );
      expect(response.status).toBe(200);
      expect(upstream).toHaveBeenCalledTimes(1);
      expect(await response.text()).toBe("data: {}\n\n");
    } finally {
      spy.mockRestore();
    }
  });
});
