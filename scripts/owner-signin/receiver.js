/* global Buffer, URL, setTimeout, clearTimeout */
// Operator-only loopback receiver. Never imported by a production entry point.
const http = require("node:http");
const { randomBytes, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const ORIGIN = "https://word-staging.openlegalcore.org";
const PORT = 8766;

async function verifyOwner(token, clientId, audience) {
  const { decodeJwt } = await import("jose");
  const { createMicrosoftVerifier } =
    await import("../../infrastructure/cloudflare/word-session/microsoft-identity.js");
  const proposed = decodeJwt(token);
  // A proposed principal is NOT authorization. It is returned only after all
  // signature/issuer/audience/time/client/delegated-scope checks succeed.
  return createMicrosoftVerifier()(token, {
    MICROSOFT_AUTH_ENABLED: "true",
    MICROSOFT_CLIENT_ID: clientId,
    MICROSOFT_API_AUDIENCE: audience,
    MICROSOFT_ALLOWED_IDENTITIES: JSON.stringify([`${proposed.tid}:${proposed.oid}`]),
  });
}

function createReceiver({ clientId, audience, output, verify = verifyOwner, port = PORT }) {
  const nonce = randomBytes(32).toString("hex");
  let pending = false,
    accepted = false,
    accessToken,
    identityExpiresAt = 0;
  function equalNonce(value) {
    return (
      typeof value === "string" &&
      /^[a-f0-9]{64}$/.test(value) &&
      timingSafeEqual(Buffer.from(value), Buffer.from(nonce))
    );
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const end = (status, text) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(text);
    };
    if (req.headers.host !== `127.0.0.1:${port}`) return end(403, "Denied");
    if (req.method === "GET" && req.url === "/start") {
      if (
        req.headers.origin ||
        ![undefined, "none", "same-origin"].includes(req.headers["sec-fetch-site"])
      )
        return end(403, "Denied");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        `<!doctype html><html lang="sl"><meta charset="utf-8"><title>OLC — preverjanje računa</title><h1>Preverjanje ownerjevega Microsoftovega računa</h1><p>Uporabi isti račun kot v Wordu. Žeton bo preverjen v pomnilniku na tem računalniku. To še ne omogoči dostopa do Engine.</p><a href="${ORIGIN}/owner-enrollment.html#${nonce}">Nadaljuj na Microsoftovo prijavo</a></html>`
      );
    }
    if (req.headers.origin !== ORIGIN || req.url !== "/identity") return end(403, "Denied");
    res.setHeader("Access-Control-Allow-Origin", ORIGIN);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-OLC-Enrollment");
      return end(204, "");
    }
    if (
      req.method !== "POST" ||
      !equalNonce(req.headers["x-olc-enrollment"]) ||
      req.headers["content-type"] !== "application/json"
    )
      return end(403, "Denied");
    if (accepted || pending) return end(409, "Already received or verification in progress");
    pending = true;
    try {
      let size = 0,
        body = "";
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 20 * 1024) return end(413, "Too large");
        body += chunk.toString("utf8");
      }
      let value = JSON.parse(body);
      body = "";
      if (
        !value ||
        Object.keys(value).join(",") !== "accessToken" ||
        typeof value.accessToken !== "string" ||
        value.accessToken.length > 16 * 1024
      )
        return end(400, "Invalid request");
      const identity = await verify(value.accessToken, clientId, audience);
      fs.writeFileSync(
        output,
        JSON.stringify({ principal: identity.principal, clientId, audience }, null, 2) + "\n",
        { flag: "wx", mode: 0o600 }
      );
      accessToken = value.accessToken;
      identityExpiresAt = identity.identityExpiresAt;
      value = undefined;
      accepted = true;
      return end(
        200,
        "Microsoftova identiteta je kriptografsko preverjena. Vrni se v Codex; žetona ne kopiraj. Staging dostop še ni aktiviran."
      );
    } catch {
      return end(
        401,
        "Preverjanje ni uspelo. Identiteta ni bila sprejeta. Poskusi znova ali sporoči samo to napako."
      );
    } finally {
      pending = false;
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return {
    server,
    getVerifiedToken() {
      if (!accepted || identityExpiresAt <= Date.now())
        throw new Error("Verified token unavailable");
      return accessToken;
    },
    clear() {
      accessToken = undefined;
      identityExpiresAt = 0;
    },
  };
}
module.exports = { createReceiver, verifyOwner, ORIGIN, PORT };
