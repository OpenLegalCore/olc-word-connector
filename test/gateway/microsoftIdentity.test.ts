// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createMicrosoftVerifier,
  microsoftConfiguration,
} from "../../infrastructure/cloudflare/word-session/microsoft-identity.js";
type Jose = typeof import("jose", { with: { "resolution-mode": "import" } });
let jose: Jose, privateKey: CryptoKey, publicJwk: Record<string, unknown>;
const tenant = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222";
const client = "33333333-3333-4333-8333-333333333333",
  api = "44444444-4444-4444-8444-444444444444";
const authority = "https://login.microsoftonline.com";
const env = {
  MICROSOFT_AUTH_ENABLED: "true",
  MICROSOFT_CLIENT_ID: client,
  MICROSOFT_API_AUDIENCE: api,
  MICROSOFT_ALLOWED_IDENTITIES: JSON.stringify([`${tenant}:${owner}`]),
};
beforeAll(async () => {
  jose = await import("jose");
  const pair = await jose.generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicJwk = {
    ...(await jose.exportJWK(pair.publicKey)),
    kid: "synthetic",
    use: "sig",
    alg: "RS256",
    issuer: authority + "/{tenantid}/v2.0",
  };
});
async function token(changes = {}, signingKey = privateKey, kid = "synthetic") {
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({
    tid: tenant,
    oid: owner,
    azp: client,
    ver: "2.0",
    scp: "Word.Access",
    iss: `${authority}/${tenant}/v2.0`,
    aud: api,
    sub: "synthetic-subject",
    iat: now,
    nbf: now,
    exp: now + 3600,
    ...changes,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .sign(signingKey);
}
function discovery(jwk = publicJwk, metadata = {}) {
  return vi.fn(async (url: string | URL | Request) =>
    Response.json(
      String(url).includes("openid-configuration")
        ? {
            issuer: authority + "/{tenantid}/v2.0",
            jwks_uri: authority + "/common/discovery/v2.0/keys",
            ...metadata,
          }
        : { keys: [jwk] }
    )
  );
}
describe("Microsoft API identity: synthetic signatures and trusted discovery", () => {
  it.each([tenant, "9188040d-6c67-4c5b-b112-36a304b66dad"])(
    "accepts explicitly authorized tenant/owner including MSA %s",
    async (tid) => {
      const send = discovery();
      const result = await createMicrosoftVerifier(send)(
        await token({ tid, iss: `${authority}/${tid}/v2.0` }),
        {
          ...env,
          MICROSOFT_ALLOWED_IDENTITIES: JSON.stringify([`${tid}:${owner}`]),
        }
      );
      expect(result.principal).toBe(`${tid}:${owner}`);
      expect(send.mock.calls.map(([url]) => url)).toEqual([
        authority + "/common/v2.0/.well-known/openid-configuration",
        authority + "/common/discovery/v2.0/keys",
      ]);
    }
  );
  it("rejects issuer, Graph/ID-token audience, scope, client, future/expired times, absent delegated identity and invalid signature", async () => {
    const verify = createMicrosoftVerifier(discovery());
    for (const changes of [
      { iss: "https://attacker.invalid" },
      { aud: "00000003-0000-0000-c000-000000000000" },
      { aud: client },
      { scp: "User.Read" },
      { scp: undefined, roles: ["Word.Access"] },
      { azp: owner },
      { exp: 1 },
      { nbf: 9999999999 },
      { iat: 9999999999 },
      { oid: undefined },
      { ver: "1.0" },
      { tid: "../../evil" },
    ])
      await expect(verify(await token(changes), env)).rejects.toThrow();
    await expect(
      verify(await token({}, (await jose.generateKeyPair("RS256")).privateKey), env)
    ).rejects.toThrow();
    await expect(verify("not-a-jwt", env)).rejects.toThrow();
  });
  it("does not authorize another valid Microsoft user by email", async () => {
    await expect(
      createMicrosoftVerifier(discovery())(
        await token({ oid: client, email: "owner@example.invalid" }),
        env
      )
    ).rejects.toThrow("ACCESS_DENIED");
  });
  it("rejects keys outside their Microsoft issuer scope and arbitrary metadata key URLs", async () => {
    await expect(
      createMicrosoftVerifier(discovery({ ...publicJwk, issuer: `${authority}/${owner}/v2.0` }))(
        await token(),
        env
      )
    ).rejects.toThrow();
    const send = discovery(publicJwk, { jwks_uri: "https://attacker.invalid/keys" });
    await expect(createMicrosoftVerifier(send)(await token(), env)).rejects.toThrow(
      "SERVICE_UNAVAILABLE"
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("coalesces discovery and bounds unknown-key refresh/network failures", async () => {
    const send = discovery();
    const verify = createMicrosoftVerifier(send);
    const jwt = await token();
    await Promise.all(Array.from({ length: 10 }, () => verify(jwt, env)));
    expect(send).toHaveBeenCalledTimes(2);
    const broken = vi.fn(async () => {
      throw new Error("unavailable");
    });
    const unavailable = createMicrosoftVerifier(broken);
    await expect(unavailable(jwt, env)).rejects.toThrow("SERVICE_UNAVAILABLE");
    await expect(unavailable(jwt, env)).rejects.toThrow("SERVICE_UNAVAILABLE");
    expect(broken).toHaveBeenCalledTimes(1);
  });
  it("refreshes trusted signing keys on rollover, with bounded unknown-key requests", async () => {
    let time = Date.now(),
      currentKey = publicJwk;
    const send = vi.fn(async (url: string | URL | Request) =>
      Response.json(
        String(url).includes("openid-configuration")
          ? {
              issuer: authority + "/{tenantid}/v2.0",
              jwks_uri: authority + "/common/discovery/v2.0/keys",
            }
          : { keys: [currentKey] }
      )
    );
    const verify = createMicrosoftVerifier(send, () => time);
    await verify(await token(), env);
    const next = await jose.generateKeyPair("RS256");
    currentKey = { ...publicJwk, ...(await jose.exportJWK(next.publicKey)), kid: "rotated" };
    const rotated = await token({}, next.privateKey, "rotated");
    for (let i = 0; i < 3; i++) await expect(verify(rotated, env)).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(2);
    time += 61_000;
    expect((await verify(rotated, env)).principal).toBe(`${tenant}:${owner}`);
    expect(send).toHaveBeenCalledTimes(4);
  });
  it("fails closed without explicit registration and nonempty owner authorization", () => {
    for (const values of [
      {},
      { ...env, MICROSOFT_ALLOWED_IDENTITIES: "[]" },
      { ...env, MICROSOFT_CLIENT_ID: api },
    ])
      expect(() => microsoftConfiguration(values)).toThrow("CONFIGURATION_REQUIRED");
  });
});
