/* global crypto, TextEncoder, TextDecoder, Response, URL, btoa, setTimeout, clearTimeout */
export const CODE_TTL = 60_000;
export const SESSION_TTL = 15 * 60_000;
export const SCOPE = "word:models word:complete";
export const opaque = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
export const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (value) =>
  base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
export function reply(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-OLC-Word-Gateway": "1",
      ...extra,
    },
  });
}
export const failure = (status, code) => reply(status, { error: { code } });
export function configuredOrigin(env) {
  const url = new URL(env.PUBLIC_ORIGIN);
  if (
    url.origin !== env.PUBLIC_ORIGIN ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("CONFIGURATION_ERROR");
  return url.origin;
}
export async function boundedObject(request, maximum = 1024) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0] !== "application/json")
    throw new Error("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  const chunks = [];
  let size = 0;
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("INVALID_REQUEST")), 5000);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error("INVALID_REQUEST");
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("INVALID_REQUEST");
  return value;
}
// Internal binding only; this address is never routed publicly.
export function store(env, operation, body) {
  const stub = env.WORD_SESSIONS.get(env.WORD_SESSIONS.idFromName("word-session-v1"));
  return stub.fetch("https://session.internal/" + operation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
