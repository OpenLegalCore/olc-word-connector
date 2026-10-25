/* global Request, Headers, URL, fetch */
import { handleRequest } from "../word-gateway-example/worker.js";
import { microsoftConfiguration, verifyMicrosoft } from "./microsoft-identity.js";
import {
  boundedObject,
  configuredOrigin,
  digest,
  failure,
  opaque,
  reply,
  store,
} from "./common.js";
const routes = new Map([
  ["/word-api/auth/config", "GET"],
  ["/word-api/session/microsoft", "POST"],
  ["/word-api/session", "GET"],
  ["/word-api/session/revoke", "POST"],
  ["/word-api/session/exchange", "POST"],
  ["/word-api/v1/models", "GET"],
  ["/word-api/v1/chat/completions", "POST"],
]);
export async function wordApi(
  request,
  env,
  fetchImpl = fetch,
  microsoftVerifier = verifyMicrosoft
) {
  try {
    const origin = configuredOrigin(env),
      url = new URL(request.url);
    if (url.origin !== origin) return failure(421, "PUBLIC_HOST_REQUIRED");
    if (url.search) return failure(400, "QUERY_STRING_NOT_ALLOWED");
    const method = routes.get(url.pathname);
    if (!method) return failure(404, "ROUTE_NOT_FOUND");
    if (method !== request.method) return failure(405, "METHOD_NOT_ALLOWED");
    const sentOrigin = request.headers.get("Origin");
    if (
      (sentOrigin && sentOrigin !== origin) ||
      (method === "POST" && sentOrigin !== origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )
      return failure(403, "ACCESS_DENIED");
    if (url.pathname === "/word-api/auth/config") {
      const config = microsoftConfiguration(env);
      return reply(200, {
        clientId: config.clientId,
        apiScope: `api://${config.audience}/Word.Access`,
      });
    }
    if (url.pathname === "/word-api/session/microsoft") {
      let identity;
      try {
        if (Object.keys(await boundedObject(request)).length)
          return failure(400, "INVALID_REQUEST");
        const authorization = request.headers.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) return failure(401, "SESSION_EXPIRED");
        identity = await microsoftVerifier(authorization.slice(7), env);
      } catch (error) {
        if (error.message === "CONFIGURATION_REQUIRED" || error.message === "SERVICE_UNAVAILABLE")
          return failure(503, "SERVICE_UNAVAILABLE");
        return failure(
          error.message === "ACCESS_DENIED" ? 403 : 401,
          error.message === "ACCESS_DENIED" ? "ACCESS_DENIED" : "SESSION_EXPIRED"
        );
      }
      return await store(env, "microsoft", {
        ...identity,
        origin,
        client: await digest(request.headers.get("CF-Connecting-IP") ?? "unknown"),
      });
    }
    if (url.pathname === "/word-api/session/exchange") {
      if (env.MICROSOFT_AUTH_ENABLED === "true") return failure(404, "ROUTE_NOT_FOUND");
      let input;
      try {
        input = await boundedObject(request);
      } catch {
        return failure(400, "INVALID_REQUEST");
      }
      if (
        Object.keys(input).sort().join(",") !== "code,state,verifier" ||
        !opaque(input.code) ||
        !opaque(input.state) ||
        !opaque(input.verifier)
      )
        return failure(400, "INVALID_REQUEST");
      return await store(env, "exchange", {
        ...input,
        origin,
        client: await digest(request.headers.get("CF-Connecting-IP") ?? "unknown"),
      });
    }
    const auth = request.headers.get("Authorization"),
      token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!opaque(token)) return failure(401, "SESSION_EXPIRED");
    if (url.pathname.endsWith("/revoke") && request.body) {
      try {
        if (Object.keys(await boundedObject(request)).length !== 0)
          return failure(400, "INVALID_REQUEST");
      } catch {
        return failure(400, "INVALID_REQUEST");
      }
    }
    const session = await store(env, url.pathname.endsWith("/revoke") ? "revoke" : "check", {
      token,
      origin,
    });
    if (!session.ok) return session;
    const sessionInfo = await session.json();
    const policyAllows = (info) => {
      if (env.MICROSOFT_AUTH_ENABLED !== "true") return true;
      const config = microsoftConfiguration(env);
      return (
        config.owners.includes(info.principal) &&
        info.clientId === config.clientId &&
        info.audience === config.audience
      );
    };
    if (!policyAllows(sessionInfo)) return failure(403, "ACCESS_DENIED");
    if (url.pathname === "/word-api/session" || url.pathname.endsWith("/revoke"))
      return reply(200, { expiresAt: sessionInfo.expiresAt, scope: sessionInfo.scope });
    // Fresh allowlisted request: Word bearer, cookies and identity never reach Engine.
    let body;
    if (method === "POST") {
      let input;
      try {
        input = await boundedObject(request, 64 * 1024);
      } catch {
        return failure(400, "INVALID_REQUEST");
      }
      const allowed = [
        "model",
        "messages",
        "stream",
        "stream_options",
        "response_format",
        "response_language",
      ];
      if (
        input.model !== "lexai-engine-local" ||
        input.stream !== true ||
        !["sl", "en"].includes(input.response_language) ||
        !Array.isArray(input.messages) ||
        Object.keys(input).some((name) => !allowed.includes(name))
      )
        return failure(400, "INVALID_REQUEST");
      body = JSON.stringify(input);
      // Body admission can take time. Recheck revocation/expiry immediately before SSE/upstream start.
      const admission = await store(env, "check", { token, origin });
      if (!admission.ok) return admission;
      if (!policyAllows(await admission.json())) return failure(403, "ACCESS_DENIED");
    }
    const target = new URL(url.pathname.slice("/word-api".length), origin),
      headers = new Headers();
    for (const name of ["Accept", "Content-Type"])
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    const forwarded = new Request(target, {
      method,
      headers,
      body,
      signal: request.signal,
      redirect: "manual",
      duplex: "half",
    });
    return await handleRequest(forwarded, { ...env, PUBLIC_HOST: url.hostname }, fetchImpl);
  } catch {
    return failure(503, "SERVICE_UNAVAILABLE");
  }
}
export default {
  fetch(request, env) {
    return wordApi(request, env);
  },
};
