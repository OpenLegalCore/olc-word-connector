// Offline only: actual Word builder, adapter, API, gateway and SQLite receipt.
// The supplied Engine address must be a dynamically allocated loopback fixture.
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { writeFileSync, mkdirSync, chmodSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const [endpoint, directory, question, selection, countText = "1"] = process.argv.slice(2);
const url = new URL(endpoint);
if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/" || !url.port)
  throw new Error("ISOLATED_LOOPBACK_ONLY");
const count = Number(countText);
if (![1, 2].includes(count)) throw new Error("FIXTURE_COUNT");
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const entry = await build({
  stdin: {
    contents: `
export {wordApi} from './infrastructure/cloudflare/word-session/api-worker.js';
export {store,random,digest} from './infrastructure/cloudflare/word-session/common.js';
export {OpenAICompatibleAdapter} from './src/chat/OpenAICompatibleAdapter';
export {WordSessionClient} from './src/taskpane/WordSessionClient';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const modulePath = directory + "/word-offline-entry.mjs";
writeFileSync(modulePath, entry.outputFiles[0].text, { mode: 0o600 });
const { wordApi, store, random, digest, OpenAICompatibleAdapter, WordSessionClient } = await import(
  pathToFileURL(modulePath).href
);
const storage = await build({
  stdin: {
    contents: `export {WordSessionStore} from './infrastructure/cloudflare/word-session/store.js';export {default} from './infrastructure/cloudflare/word-session/api-worker.js';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  write: false,
});
const origin = "https://word.example.invalid";
const env = {
  PUBLIC_ORIGIN: origin,
  ENGINE_ORIGIN: "https://engine.example.invalid",
  ENGINE_API_KEY: "SYNTHETIC-BEARER-ONLY-NOT-FOR-DEPLOYMENT",
  CF_ACCESS_CLIENT_ID: "synthetic",
  CF_ACCESS_CLIENT_SECRET: "SYNTHETIC_SECRET_NOT_CAPTURED",
};
const mf = new Miniflare({
  modules: true,
  script: storage.outputFiles[0].text,
  compatibilityDate: "2026-07-30",
  durableObjects: { WORD_SESSIONS: { className: "WordSessionStore", useSQLite: true } },
  bindings: env,
  outboundService: async () => {
    throw new Error("UNREGISTERED_NETWORK_FORBIDDEN");
  },
});
const tasks = [];
const context = { waitUntil: (p) => tasks.push(p) };
const captures = [];
try {
  env.WORD_SESSIONS = await mf.getDurableObjectNamespace("WORD_SESSIONS");
  const verifier = random(),
    state = random();
  const issued = await store(env, "issue", {
    origin,
    challenge: await digest(verifier),
    state,
    identityExpiresAt: Date.now() + 3600_000,
    client: random(),
  });
  const { code } = await issued.json();
  const upstream = async (request) => {
    if (request.url !== "https://engine.example.invalid/v1/chat/completions")
      throw new Error("FIXTURE_ROUTE");
    const raw = new Uint8Array(await request.clone().arrayBuffer());
    const response = await fetch(
      new Request(endpoint + "v1/chat/completions", {
        method: "POST",
        headers: request.headers,
        body: raw,
        duplex: "half",
      })
    );
    const capture = {
      wire: Buffer.from(raw),
      ack: response.headers.get("X-OLC-Completion-ID"),
      status: response.status,
      chunks: [],
    };
    captures.push(capture);
    const body = response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          capture.chunks.push(Buffer.from(chunk));
          controller.enqueue(chunk);
        },
      })
    );
    return new Response(body, { status: response.status, headers: response.headers });
  };
  let attempt;
  const send = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Origin", origin);
    headers.set("CF-Connecting-IP", "127.0.0.1");
    if (path.endsWith("completions")) attempt = headers.get("X-OLC-Attempt-ID");
    return wordApi(
      new Request(origin + path, { ...init, headers }),
      env,
      upstream,
      undefined,
      context
    );
  };
  const client = new WordSessionClient(send);
  await client.exchange(code, verifier, state);
  const adapter = new OpenAICompatibleAdapter(
    {
      transport: "same-origin",
      modelId: "lexai-engine-local",
      responseProfile: "document-review",
      requestTimeoutMs: 10000,
    },
    { fetch: client.fetch }
  );
  for (let i = 0; i < count; i++) {
    let result, outcome;
    try {
      result = await adapter.complete({
        question,
        context: { type: "selected_text", quotedText: selection },
        uiLocale: "en-US",
      });
      outcome = "SUCCESS";
    } catch (error) {
      outcome = error.diagnosticReason ?? error.reason ?? error.constructor.name;
      result = { upstreamCode: error.upstreamCode ?? null };
    }
    while (tasks.length) await Promise.all(tasks.splice(0));
    const receipt = await client.diagnostic(attempt, "unbundled-test");
    const capture = captures[i];
    if (!capture) throw new Error("NO_ACTUAL_ENGINE_REQUEST");
    const evidence = {
      attemptId: attempt,
      receipt,
      ack: capture.ack,
      httpStatus: capture.status,
      outcome,
      result,
      requestSha256: createHash("sha256").update(capture.wire).digest("hex"),
    };
    const out = directory + "/" + i;
    mkdirSync(out, { mode: 0o700 });
    for (const [name, data] of Object.entries({
      "request.private.json": capture.wire,
      "response.private.sse": Buffer.concat(capture.chunks),
      "word.private.json": JSON.stringify(evidence, null, 2),
    }))
      writeFileSync(out + "/" + name, data, { mode: 0o600 });
  }
  console.log(
    JSON.stringify({ captures: captures.length, privateEvidence: directory, providerCalls: 0 })
  );
} finally {
  while (tasks.length) await Promise.all(tasks.splice(0));
  await mf.dispose();
  unlinkSync(modulePath);
}
