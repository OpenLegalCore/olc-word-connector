// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Miniflare, Response as WorkerResponse, Request as WorkerRequest } from "miniflare";
import { build } from "esbuild";
const tenant = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const client = "33333333-3333-4333-8333-333333333333";
const audience = "44444444-4444-4444-8444-444444444444";
const authority = "https://login.microsoftonline.com";
const origin = "https://word.example.invalid";
let mf: Miniflare | undefined;
afterEach(async () => {
  await mf?.dispose();
  mf = undefined;
});
async function fixture(redirectMetadata = false) {
  const jose = await import("jose");
  const pair = await jose.generateKeyPair("RS256");
  const key = {
    ...(await jose.exportJWK(pair.publicKey)),
    kid: "synthetic-worker",
    use: "sig",
    issuer: authority + "/{tenantid}/v2.0",
  };
  const now = Math.floor(Date.now() / 1000);
  const token = await new jose.SignJWT({
    tid: tenant,
    oid: owner,
    azp: client,
    ver: "2.0",
    scp: "Word.Access",
    sub: "synthetic",
    iss: `${authority}/${tenant}/v2.0`,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .sign(pair.privateKey);
  const bundled = await build({
    stdin: {
      contents:
        'export { WordSessionStore } from "./infrastructure/cloudflare/word-session/store.js"; export { default } from "./infrastructure/cloudflare/word-session/api-worker.js";',
      resolveDir: process.cwd(),
      sourcefile: "synthetic-worker-runtime.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
  });
  const outbound: string[] = [];
  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-07-30",
    durableObjects: { WORD_SESSIONS: { className: "WordSessionStore", useSQLite: true } },
    bindings: {
      PUBLIC_ORIGIN: origin,
      MICROSOFT_AUTH_ENABLED: "true",
      MICROSOFT_CLIENT_ID: client,
      MICROSOFT_API_AUDIENCE: audience,
      MICROSOFT_ALLOWED_IDENTITIES: JSON.stringify([`${tenant}:${owner}`]),
    },
    outboundService: async (request: WorkerRequest) => {
      outbound.push(request.url);
      expect(request.headers.get("Authorization")).toBeNull();
      expect(request.headers.get("Cookie")).toBeNull();
      if (request.url === authority + "/common/v2.0/.well-known/openid-configuration") {
        if (redirectMetadata)
          return new WorkerResponse(null, {
            status: 302,
            headers: { Location: "https://untrusted.example.invalid/keys" },
          });
        return WorkerResponse.json({
          issuer: authority + "/{tenantid}/v2.0",
          jwks_uri: authority + "/common/discovery/v2.0/keys",
        });
      }
      if (request.url === authority + "/common/discovery/v2.0/keys")
        return WorkerResponse.json({ keys: [key] });
      throw new Error("Unexpected outbound request");
    },
  });
  const issue = () =>
    mf!.dispatchFetch(origin + "/word-api/session/microsoft", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
  return { issue, outbound };
}
describe("Microsoft verification in actual workerd runtime (synthetic identity/discovery)", () => {
  it("fetches trusted metadata/JWKS, verifies the signature, and issues a capability through SQLite", async () => {
    const { issue, outbound } = await fixture();
    const response = await issue();
    expect(response.status).toBe(200);
    const session = (await response.json()) as { token: string; expiresAt: number };
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
    expect(outbound).toEqual([
      authority + "/common/v2.0/.well-known/openid-configuration",
      authority + "/common/discovery/v2.0/keys",
    ]);
  });
  it("rejects a discovery redirect without following it or issuing a capability", async () => {
    const { issue, outbound } = await fixture(true);
    const response = await issue();
    expect(response.status).toBe(503);
    expect(outbound).toEqual([authority + "/common/v2.0/.well-known/openid-configuration"]);
    expect(await response.text()).not.toContain('"token"');
  });
});
