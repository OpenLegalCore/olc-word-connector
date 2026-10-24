// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
type Jose = typeof import("jose", { with: { "resolution-mode": "import" } });
let jose: Jose;
import {
  authorize,
  verifyIdentity,
} from "../../infrastructure/cloudflare/word-session/auth-worker.js";
import { wordApi } from "../../infrastructure/cloudflare/word-session/api-worker.js";
import { digest, random, store } from "../../infrastructure/cloudflare/word-session/common.js";

const origin = "https://word.example.invalid",
  issuer = "https://synthetic.cloudflareaccess.com",
  audience = "a".repeat(64);
let mf: Miniflare,
  env: Record<string, unknown>,
  privateKey: CryptoKey,
  key: ReturnType<Jose["createLocalJWKSet"]>;
beforeAll(async () => {
  jose = await import("jose");
  const result = await build({
    entryPoints: ["infrastructure/cloudflare/word-session/auth-worker.js"],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
  });
  mf = new Miniflare({
    modules: true,
    script: result.outputFiles[0].text,
    compatibilityDate: "2026-07-30",
    durableObjects: { WORD_SESSIONS: { className: "WordSessionStore", useSQLite: true } },
  });
  env = {
    PUBLIC_ORIGIN: origin,
    ACCESS_ISSUER: issuer,
    ACCESS_AUDIENCE: audience,
    WORD_SESSIONS: await mf.getDurableObjectNamespace("WORD_SESSIONS"),
    ENGINE_ORIGIN: "https://private-upstream.example.invalid",
    ENGINE_API_KEY: "synthetic-engine-value",
    CF_ACCESS_CLIENT_ID: "synthetic-access-id",
    CF_ACCESS_CLIENT_SECRET: "synthetic-access-value",
  };
  const pair = await jose.generateKeyPair("RS256");
  privateKey = pair.privateKey;
  key = jose.createLocalJWKSet({
    keys: [{ ...(await jose.exportJWK(pair.publicKey)), alg: "RS256", kid: "test" }],
  });
}, 30_000);
afterAll(async () => {
  await mf?.dispose();
});
const identity = (claims = {}, signingKey = privateKey): Promise<string> =>
  new jose.SignJWT({ type: "app", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("synthetic-human")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(signingKey);
const req = (path: string, body?: unknown, token?: string, source = origin): Request =>
  new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: source,
      "CF-Connecting-IP": random(),
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function issue(
  expires = Date.now() + 3600_000
): Promise<{ code: string; verifier: string; state: string }> {
  const verifier = random(),
    state = random();
  const result = await store(env, "issue", {
    origin,
    challenge: await digest(verifier),
    state,
    identityExpiresAt: expires,
    client: random(),
  });
  expect(result.status).toBe(200);
  return { ...(await result.json()), verifier, state };
}
const exchange = (grant: unknown, source = origin): Promise<Response> =>
  wordApi(req("/word-api/session/exchange", grant, undefined, source), env);
describe("Word session boundary, real local workerd/SQLite Durable Object", () => {
  it("verifies signature, exact issuer/audience, algorithm, expiry and required claims", async () => {
    expect(await verifyIdentity(await identity(), env, key)).toBeGreaterThan(Date.now());
    for (const token of [
      await new jose.SignJWT({ type: "app" })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer("https://wrong.cloudflareaccess.com")
        .setAudience(audience)
        .setSubject("test")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey),
      await new jose.SignJWT({ type: "app" })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(issuer)
        .setAudience("wrong")
        .setSubject("test")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey),
      await new jose.SignJWT({ type: "app" })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject("test")
        .setIssuedAt()
        .setExpirationTime(1)
        .sign(privateKey),
      await identity({}, (await jose.generateKeyPair("RS256")).privateKey),
      await new jose.SignJWT({ type: "app" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject("test")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new Uint8Array(32)),
      await identity({ type: "service" }),
      "not-a-jwt",
    ])
      await expect(verifyIdentity(token, env, key)).rejects.toThrow();
  });
  it("issues only after verified identity and returns code only through exact-origin Office messaging", async () => {
    const state = random(),
      challenge = random();
    const request = new Request(
      `${origin}/word-auth/authorize?challenge=${challenge}&state=${state}`,
      {
        headers: { "Cf-Access-Jwt-Assertion": await identity(), "CF-Connecting-IP": random() },
      }
    );
    const response = await authorize(request, env, key),
      html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(html).toContain("targetOrigin:location.origin");
    expect(html).toContain("e.origin===location.origin");
    expect(html).not.toContain("synthetic-human");
    expect(html).not.toContain(await identity());
    expect((await authorize(new Request(request.url), env, key)).status).toBe(403);
    expect(
      (await authorize(new Request(request.url + "&return=https://other.invalid"), env, key)).status
    ).toBe(400);
  });
  it("atomically exchanges once: concurrent code use yields exactly one session, replay fails", async () => {
    const grant = await issue();
    const results = await Promise.all(Array.from({ length: 8 }, () => exchange(grant)));
    expect(results.map((x) => x.status).sort()).toEqual([200, 401, 401, 401, 401, 401, 401, 401]);
    const session = await results.find((x) => x.ok)!.json();
    expect(session.expiresAt - Date.now()).toBeLessThanOrEqual(900_000);
    expect(session.scope).toBe("word:models word:complete");
    expect((await exchange(grant)).status).toBe(401);
    expect((await wordApi(req("/word-api/session", undefined, session.token), env)).status).toBe(
      200
    );
    expect((await wordApi(req("/word-api/session/revoke", {}, session.token), env)).status).toBe(
      200
    );
    expect((await wordApi(req("/word-api/session", undefined, session.token), env)).status).toBe(
      401
    );
  });
  it("rejects wrong origin/state/verifier and expired grants/sessions", async () => {
    const grant = await issue();
    expect((await exchange(grant, "https://other.invalid")).status).toBe(403);
    expect((await exchange({ ...grant, state: random() })).status).toBe(401);
    expect((await exchange({ ...grant, verifier: random() })).status).toBe(401);
    expect((await exchange(grant)).status).toBe(200);
    const short = await issue(Date.now() + 150);
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect((await exchange(short)).status).toBe(401);
    const session = await (await exchange(await issue(Date.now() + 200))).json();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect((await wordApi(req("/word-api/session", undefined, session.token), env)).status).toBe(
      401
    );
  });
  it("rejects direct API requests, route/method/body abuse before any Engine access", async () => {
    const upstream = vi.fn();
    for (const path of ["/word-api/session", "/word-api/v1/models"])
      expect((await wordApi(req(path), env, upstream)).status).toBe(401);
    expect(
      (await wordApi(req("/word-api/v1/chat/completions", { stream: true }), env, upstream)).status
    ).toBe(401);
    expect((await wordApi(req("/word-api/other"), env, upstream)).status).toBe(404);
    expect((await wordApi(req("/word-api/v1/models", {}), env, upstream)).status).toBe(405);
    expect(
      (await exchange({ code: "x".repeat(2000), verifier: random(), state: random() })).status
    ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("isolates Word token/cookies from upstream, preserves bounded models/SSE gateway", async () => {
    const session = await (await exchange(await issue())).json();
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      expect(request.headers.get("Authorization")).toBe("Bearer synthetic-engine-value");
      expect(request.headers.get("CF-Access-Client-Secret")).toBe("synthetic-access-value");
      expect(request.headers.get("Cookie")).toBeNull();
      request.headers.forEach((value) => expect(value).not.toContain(session.token));
      return new Response('{"object":"list","data":[]}', {
        headers: { "Content-Type": "application/json" },
      });
    });
    const request = req("/word-api/v1/models", undefined, session.token);
    request.headers.set("Cookie", "should-not-travel=1");
    expect((await wordApi(request, env, upstream)).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    const sse = vi.fn(
      async () =>
        new Response("data: synthetic\n\n", { headers: { "Content-Type": "text/event-stream" } })
    );
    const result = await wordApi(
      req(
        "/word-api/v1/chat/completions",
        { model: "lexai-engine-local", stream: true, response_language: "sl", messages: [] },
        session.token
      ),
      env,
      sse
    );
    expect(result.status).toBe(200);
    expect(await result.text()).toBe("data: synthetic\n\n");
  });
  it("fails closed on storage failure and rejects out-of-scope or oversized completion bodies", async () => {
    const broken = {
      ...env,
      WORD_SESSIONS: {
        idFromName: () => "synthetic",
        get: () => ({
          fetch: async () => {
            throw new Error("unavailable");
          },
        }),
      },
    };
    expect(
      (
        await wordApi(
          req("/word-api/session/exchange", {
            code: random(),
            verifier: random(),
            state: random(),
          }),
          broken
        )
      ).status
    ).toBe(503);
    const session = await (await exchange(await issue())).json(),
      upstream = vi.fn();
    for (const body of [
      { model: "other-model", stream: true, response_language: "sl", messages: [] },
      { model: "lexai-engine-local", stream: false, response_language: "sl", messages: [] },
      {
        model: "lexai-engine-local",
        stream: true,
        response_language: "sl",
        messages: [],
        tools: [],
      },
      {
        model: "lexai-engine-local",
        stream: true,
        response_language: "sl",
        messages: ["x".repeat(65536)],
      },
    ])
      expect(
        (await wordApi(req("/word-api/v1/chat/completions", body, session.token), env, upstream))
          .status
      ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("rechecks revocation after body admission, before SSE start", async () => {
    const session = await (await exchange(await issue())).json();
    const namespace = env.WORD_SESSIONS as {
      idFromName(name: string): unknown;
      get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> };
    };
    let observed!: () => void;
    const checked = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const guarded = {
      ...env,
      WORD_SESSIONS: {
        idFromName: (name: string) => namespace.idFromName(name),
        get: (id: unknown) => {
          const stub = namespace.get(id);
          return {
            fetch: async (url: string, init: RequestInit) => {
              const result = await stub.fetch(url, init);
              if (url.endsWith("/check")) observed();
              return result;
            },
          };
        },
      },
    };
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stream = new ReadableStream({
      async start(controller) {
        await waiting;
        controller.enqueue(
          new TextEncoder().encode(
            JSON.stringify({
              model: "lexai-engine-local",
              stream: true,
              response_language: "sl",
              messages: [],
            })
          )
        );
        controller.close();
      },
    });
    const upstream = vi.fn();
    const request = new Request(origin + "/word-api/v1/chat/completions", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: {
        Origin: origin,
        Authorization: "Bearer " + session.token,
        "Content-Type": "application/json",
      },
    } as RequestInit);
    const pending = wordApi(request, guarded, upstream);
    await checked;
    expect((await store(env, "revoke", { token: session.token, origin })).status).toBe(200);
    release();
    expect((await pending).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("limits exchange abuse in the same strongly consistent store", async () => {
    const client = random(),
      body = { code: random(), verifier: random(), state: random(), origin, client };
    const results = await Promise.all(
      Array.from({ length: 15 }, () => store(env, "exchange", body))
    );
    expect(results.filter((x) => x.status === 401)).toHaveLength(12);
    expect(results.filter((x) => x.status === 429)).toHaveLength(3);
  });
  it("invalidates a code after five wrong bindings", async () => {
    const grant = await issue();
    for (let i = 0; i < 5; i++)
      expect((await exchange({ ...grant, verifier: random() })).status).toBe(401);
    expect((await exchange(grant)).status).toBe(401);
  });
});
