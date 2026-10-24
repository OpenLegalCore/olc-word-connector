/* global crypto, TextEncoder, URL, Response, btoa */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { configuredOrigin, failure, opaque, store, digest } from "./common.js";
export { WordSessionStore } from "./store.js";

const resolvers = new Map();
export async function verifyIdentity(assertion, env, key) {
  const issuer = new URL(env.ACCESS_ISSUER);
  if (
    issuer.origin !== env.ACCESS_ISSUER ||
    issuer.protocol !== "https:" ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer.hostname) ||
    issuer.port ||
    typeof env.ACCESS_AUDIENCE !== "string" ||
    !/^[a-f0-9]{64}$/.test(env.ACCESS_AUDIENCE)
  )
    throw new Error("CONFIGURATION_ERROR");
  if (!key) {
    key = resolvers.get(issuer.origin);
    if (!key) {
      key = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer), { timeoutDuration: 5000 });
      resolvers.set(issuer.origin, key);
    }
  }
  const { payload } = await jwtVerify(assertion, key, {
    algorithms: ["RS256"],
    issuer: issuer.origin,
    audience: env.ACCESS_AUDIENCE,
    requiredClaims: ["exp", "iat", "sub", "type"],
    maxTokenAge: "24h",
  });
  if (
    payload.type !== "app" ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.iat > Date.now() / 1000
  )
    throw new Error("ACCESS_DENIED");
  return payload.exp * 1000;
}

async function landing(state, challenge, code) {
  // Only validated base64url values are embedded. No identity or upstream credential.
  const script = `(function(){var state=${JSON.stringify(state)},challenge=${JSON.stringify(challenge)},code=${JSON.stringify(code)};Office.onReady().then(function(){Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived,function(e){try{var v=JSON.parse(e.message);if(e.origin===location.origin&&Object.keys(v).sort().join(',')==='challenge,state,type'&&v.type==='olc-word-authorize'&&v.state===state&&v.challenge===challenge)Office.context.ui.messageParent(JSON.stringify(code?{type:'olc-word-authorized',state:state,code:code}:{type:'olc-word-authorization-denied',state:state}),{targetOrigin:location.origin});}catch(_){}},function(){});}).catch(function(){});})();`;
  const hash = btoa(
    String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(script)))
    )
  );
  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><title>Word sign-in</title></head><body><p>Return to Word / Vrnite se v Word.</p><script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script><script>' +
      script +
      "</script></body></html>",
    {
      status: code ? 200 : 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src https://appsforoffice.microsoft.com 'sha256-${hash}'`,
      },
    }
  );
}
export async function authorize(request, env, key) {
  try {
    const origin = configuredOrigin(env),
      url = new URL(request.url);
    if (url.origin !== origin) return failure(421, "PUBLIC_HOST_REQUIRED");
    if (url.pathname !== "/word-auth/authorize") return failure(404, "ROUTE_NOT_FOUND");
    if (request.method !== "GET") return failure(405, "METHOD_NOT_ALLOWED");
    const fields = [...url.searchParams.keys()].sort().join(",");
    const challenge = url.searchParams.get("challenge"),
      state = url.searchParams.get("state");
    if (fields !== "challenge,state" || !opaque(challenge) || !opaque(state))
      return failure(400, "INVALID_REQUEST");
    let identityExpiresAt;
    try {
      identityExpiresAt = await verifyIdentity(
        request.headers.get("Cf-Access-Jwt-Assertion"),
        env,
        key
      );
    } catch {
      return landing(state, challenge, null);
    }
    const result = await store(env, "issue", {
      origin,
      challenge,
      state,
      identityExpiresAt,
      client: await digest(request.headers.get("CF-Connecting-IP") ?? "unknown"),
    });
    if (!result.ok) return result;
    return landing(state, challenge, (await result.json()).code);
  } catch {
    return failure(503, "AUTH_UNAVAILABLE");
  }
}
export default {
  fetch(request, env) {
    return authorize(request, env);
  },
};
