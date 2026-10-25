/* global fetch, URL, AbortSignal */
import { createLocalJWKSet, decodeJwt, decodeProtectedHeader, jwtVerify } from "jose";

const authority = "https://login.microsoftonline.com";
const metadataUrl = authority + "/common/v2.0/.well-known/openid-configuration";
const keysUrl = authority + "/common/discovery/v2.0/keys";
const issuerTemplate = authority + "/{tenantid}/v2.0";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function microsoftConfiguration(env) {
  if (
    env.MICROSOFT_AUTH_ENABLED !== "true" ||
    !guid.test(env.MICROSOFT_CLIENT_ID ?? "") ||
    !guid.test(env.MICROSOFT_API_AUDIENCE ?? "") ||
    env.MICROSOFT_CLIENT_ID === env.MICROSOFT_API_AUDIENCE
  )
    throw new Error("CONFIGURATION_REQUIRED");
  const owners = JSON.parse(env.MICROSOFT_ALLOWED_IDENTITIES ?? "[]");
  if (
    !Array.isArray(owners) ||
    owners.length === 0 ||
    owners.length > 32 ||
    owners.some(
      (value) =>
        typeof value !== "string" ||
        value.split(":").length !== 2 ||
        !value.split(":").every((part) => guid.test(part))
    )
  )
    throw new Error("CONFIGURATION_REQUIRED");
  return { clientId: env.MICROSOFT_CLIENT_ID, audience: env.MICROSOFT_API_AUDIENCE, owners };
}

async function trustedJson(url, send) {
  const response = await send(url, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(5000),
  });
  if (
    !response.ok ||
    response.redirected ||
    !response.headers.get("Content-Type")?.includes("application/json")
  )
    throw new Error("SERVICE_UNAVAILABLE");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SERVICE_UNAVAILABLE");
  let text = "",
    size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 128 * 1024) throw new Error("SERVICE_UNAVAILABLE");
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Fixed Microsoft discovery only. No URL, tenant or key from an unverified token is fetched. */
export function createMicrosoftVerifier(send = fetch, now = Date.now) {
  let cached,
    pending,
    loadedAt = 0,
    attemptedAt = -Infinity;
  async function discovery(refresh) {
    if (pending) return pending;
    if (cached && now() - loadedAt < 3600_000 && (!refresh || now() - attemptedAt < 60_000))
      return cached;
    if (now() - attemptedAt < 60_000) throw new Error("SERVICE_UNAVAILABLE");
    attemptedAt = now();
    pending = (async () => {
      const metadata = await trustedJson(metadataUrl, send);
      if (metadata.issuer !== issuerTemplate || metadata.jwks_uri !== keysUrl)
        throw new Error("SERVICE_UNAVAILABLE");
      const jwks = await trustedJson(keysUrl, send);
      if (!Array.isArray(jwks.keys) || jwks.keys.length > 100)
        throw new Error("SERVICE_UNAVAILABLE");
      cached = jwks;
      loadedAt = now();
      return jwks;
    })();
    try {
      return await pending;
    } catch {
      throw new Error("SERVICE_UNAVAILABLE");
    } finally {
      pending = undefined;
    }
  }
  return async function verifyMicrosoft(token, env) {
    const config = microsoftConfiguration(env);
    if (typeof token !== "string" || token.length > 16 * 1024) throw new Error("INVALID_TOKEN");
    const untrusted = decodeJwt(token),
      header = decodeProtectedHeader(token);
    if (!guid.test(untrusted.tid ?? "") || header.alg !== "RS256" || typeof header.kid !== "string")
      throw new Error("INVALID_TOKEN");
    const issuer = issuerTemplate.replace("{tenantid}", untrusted.tid);
    let jwks = await discovery(false);
    if (!jwks.keys.some((key) => key.kid === header.kid)) jwks = await discovery(true);
    const keys = jwks.keys.filter(
      (key) =>
        key.kid === header.kid &&
        key.kty === "RSA" &&
        key.use === "sig" &&
        typeof key.issuer === "string" &&
        key.issuer.replace("{tenantid}", untrusted.tid) === issuer
    );
    const { payload } = await jwtVerify(token, createLocalJWKSet({ keys }), {
      issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["iss", "aud", "exp", "iat", "nbf", "sub", "tid", "oid", "azp", "scp", "ver"],
      currentDate: new Date(now()),
      clockTolerance: 0,
    });
    if (
      payload.ver !== "2.0" ||
      payload.azp !== config.clientId ||
      !guid.test(payload.oid ?? "") ||
      typeof payload.iat !== "number" ||
      payload.iat > now() / 1000 ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.scp !== "string" ||
      !payload.scp.split(" ").includes("Word.Access")
    )
      throw new Error("INVALID_TOKEN");
    const principal = payload.tid + ":" + payload.oid;
    if (!config.owners.includes(principal)) throw new Error("ACCESS_DENIED");
    return {
      principal,
      audience: config.audience,
      clientId: config.clientId,
      identityExpiresAt: payload.exp * 1000,
    };
  };
}
export const verifyMicrosoft = createMicrosoftVerifier();
