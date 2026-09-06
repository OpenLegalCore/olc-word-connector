const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_JSON_RESPONSE_BYTES = 1024 * 1024;
const MAX_STREAM_RESPONSE_BYTES = 1024 * 1024;
const GATEWAY_RESPONSE_MARKER = "1";
const SESSION_PATH = "/api/session";
const SESSION_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const SESSION_HTML = Object.freeze({
  "en-US":
    '<!doctype html><html lang="en-US"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Sign-in complete</title></head><body><main><h1>Sign-in complete</h1>" +
    "<p>Return to Word and select “Retry search”.</p>" +
    "<p>You can close this tab.</p></main></body></html>",
  "sl-SI":
    '<!doctype html><html lang="sl-SI"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Prijava je končana</title></head><body><main><h1>Prijava je končana</h1>" +
    "<p>Vrnite se v Word in izberite »Ponovi iskanje«.</p>" +
    "<p>Ta zavihek lahko zaprete.</p></main></body></html>",
});

const ROUTES = new Map([
  ["/api/models", { method: "GET", provider: "owui", responseType: "application/json" }],
  [
    "/api/chat/completions",
    { method: "POST", provider: "owui", responseType: "text/event-stream" },
  ],
  ["/v1/models", { method: "GET", provider: "engine", responseType: "application/json" }],
  [
    "/v1/chat/completions",
    { method: "POST", provider: "engine", responseType: "application/json" },
  ],
]);

function responseHeaders(contentType = "application/json; charset=utf-8") {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-OLC-Word-Gateway": GATEWAY_RESPONSE_MARKER,
  });
}

function gatewayError(status, code, extraHeaders) {
  const headers = responseHeaders();
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers.set(name, value);
    }
  }
  return new Response(JSON.stringify({ error: { code } }), { status, headers });
}

function sessionHeaders(contentType) {
  const headers = responseHeaders(contentType);
  headers.set("Content-Security-Policy", SESSION_CSP);
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}

function sessionLocale(acceptLanguage) {
  if (typeof acceptLanguage !== "string" || acceptLanguage.trim() === "") {
    return "en-US";
  }

  const candidates = [];
  const ranges = acceptLanguage.split(",");
  for (let index = 0; index < ranges.length; index += 1) {
    const parts = ranges[index].split(";").map((part) => part.trim());
    const range = parts.shift();
    if (!range || !/^(?:\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/.test(range)) {
      return "en-US";
    }
    if (parts.length > 1 || (parts.length === 1 && !/^q=/i.test(parts[0]))) {
      return "en-US";
    }

    let quality = 1;
    if (parts.length === 1) {
      const qualityValue = parts[0].slice(2);
      if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(qualityValue)) {
        return "en-US";
      }
      quality = Number(qualityValue);
    }
    if (quality === 0 || range === "*") {
      continue;
    }

    const primaryLanguage = range.split("-", 1)[0].toLowerCase();
    if (primaryLanguage === "en" || primaryLanguage === "sl") {
      candidates.push({
        locale: primaryLanguage === "sl" ? "sl-SI" : "en-US",
        quality,
        index,
      });
    }
  }

  candidates.sort((left, right) => right.quality - left.quality || left.index - right.index);
  return candidates[0]?.locale ?? "en-US";
}

function sessionResponse(request) {
  if (request.method !== "GET") {
    const headers = sessionHeaders("application/json; charset=utf-8");
    headers.set("Allow", "GET");
    return new Response(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED" } }), {
      status: 405,
      headers,
    });
  }
  const locale = sessionLocale(request.headers.get("Accept-Language"));
  return new Response(SESSION_HTML[locale], {
    status: 200,
    headers: sessionHeaders("text/html; charset=UTF-8"),
  });
}

function hasControlCharacter(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function exactPublicHost(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value !== value.toLowerCase() ||
    hasControlCharacter(value) ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      value
    )
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(`https://${value}`);
    return parsed.hostname === value && parsed.origin === `https://${value}` ? value : undefined;
  } catch {
    return undefined;
  }
}

function exactHttpsOrigin(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    hasControlCharacter(value)
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      parsed.hostname === "" ||
      parsed.hostname.endsWith(".")
    ) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function exactSecret(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !hasControlCharacter(value)
  );
}

function configuredEnvironment(env) {
  if (
    !env ||
    !exactSecret(env.OWUI_API_KEY) ||
    !exactSecret(env.CF_ACCESS_CLIENT_ID) ||
    !exactSecret(env.CF_ACCESS_CLIENT_SECRET)
  ) {
    return undefined;
  }

  const publicHost = exactPublicHost(env.PUBLIC_HOST);
  const owuiOrigin = exactHttpsOrigin(env.OWUI_ORIGIN);
  const engineOrigin = exactHttpsOrigin(env.ENGINE_ORIGIN);
  if (!publicHost || !owuiOrigin || !engineOrigin) {
    return undefined;
  }
  return { publicHost, owuiOrigin, engineOrigin };
}

function upstreamHeaders(route, env) {
  const headers = new Headers({
    Accept: route.responseType,
    "CF-Access-Client-ID": env.CF_ACCESS_CLIENT_ID,
    "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
  });
  if (route.method === "POST") {
    headers.set("Content-Type", "application/json");
  }
  if (route.provider === "owui") {
    headers.set("Authorization", `Bearer ${env.OWUI_API_KEY}`);
  }
  return headers;
}

function declaredByteLength(headers, maximum) {
  const value = headers.get("Content-Length");
  if (value === null) {
    return { length: undefined };
  }
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    return { error: "INVALID" };
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    return { error: "INVALID" };
  }
  return length > maximum ? { error: "TOO_LARGE" } : { length };
}

async function cancelBody(body) {
  try {
    await body?.cancel();
  } catch {
    // Cleanup must not replace a controlled gateway response.
  }
}

function isByteChunk(value) {
  return (
    ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]"
  );
}

async function readBoundedBytes(body, maximum) {
  if (!body || typeof body.getReader !== "function") {
    return { bytes: new Uint8Array() };
  }

  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      if (!isByteChunk(chunk.value)) {
        await reader.cancel().catch(() => undefined);
        return { error: "READ_FAILED" };
      }
      total += chunk.value.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => undefined);
        return { error: "TOO_LARGE" };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { error: "READ_FAILED" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

async function boundedJsonBody(request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { error: gatewayError(415, "JSON_CONTENT_TYPE_REQUIRED") };
  }

  const declared = declaredByteLength(request.headers, MAX_REQUEST_BYTES);
  if (declared.error === "INVALID") {
    return { error: gatewayError(400, "INVALID_CONTENT_LENGTH") };
  }
  if (declared.error === "TOO_LARGE") {
    await cancelBody(request.body);
    return { error: gatewayError(413, "REQUEST_BODY_TOO_LARGE") };
  }

  const measured = await readBoundedBytes(request.body, MAX_REQUEST_BYTES);
  if (measured.error === "TOO_LARGE") {
    return { error: gatewayError(413, "REQUEST_BODY_TOO_LARGE") };
  }
  if (measured.error || !measured.bytes) {
    return { error: gatewayError(400, "INVALID_REQUEST_BODY") };
  }

  let parsed;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(measured.bytes);
    parsed = JSON.parse(text);
  } catch {
    return { error: gatewayError(400, "INVALID_JSON") };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: gatewayError(400, "JSON_OBJECT_REQUIRED") };
  }
  return { body: JSON.stringify(parsed) };
}

function expectedContentType(route, contentType) {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === route.responseType;
}

async function bufferedJsonResponse(upstream, contentType) {
  const declared = declaredByteLength(upstream.headers, MAX_JSON_RESPONSE_BYTES);
  if (declared.error === "INVALID") {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_PROTOCOL_ERROR");
  }
  if (declared.error === "TOO_LARGE") {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_RESPONSE_TOO_LARGE");
  }

  const measured = await readBoundedBytes(upstream.body, MAX_JSON_RESPONSE_BYTES);
  if (measured.error === "TOO_LARGE") {
    return gatewayError(502, "UPSTREAM_RESPONSE_TOO_LARGE");
  }
  if (measured.error || !measured.bytes) {
    return gatewayError(502, "UPSTREAM_UNAVAILABLE");
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(measured.bytes);
    JSON.parse(text);
  } catch {
    return gatewayError(502, "UPSTREAM_PROTOCOL_ERROR");
  }
  return new Response(text, { status: 200, headers: responseHeaders(contentType) });
}

function boundedEventStream(body) {
  const reader = body.getReader();
  let total = 0;
  let closed = false;

  function release() {
    if (!closed) {
      closed = true;
      reader.releaseLock();
    }
  }

  return new ReadableStream({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          release();
          controller.close();
          return;
        }
        if (!isByteChunk(chunk.value)) {
          await reader.cancel().catch(() => undefined);
          release();
          controller.error(new Error("UPSTREAM_PROTOCOL_ERROR"));
          return;
        }
        total += chunk.value.byteLength;
        if (total > MAX_STREAM_RESPONSE_BYTES) {
          await reader.cancel().catch(() => undefined);
          release();
          controller.error(new Error("UPSTREAM_RESPONSE_TOO_LARGE"));
          return;
        }
        controller.enqueue(chunk.value);
      } catch {
        release();
        controller.error(new Error("UPSTREAM_UNAVAILABLE"));
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}

async function streamedEventResponse(upstream, contentType) {
  const declared = declaredByteLength(upstream.headers, MAX_STREAM_RESPONSE_BYTES);
  if (declared.error === "INVALID") {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_PROTOCOL_ERROR");
  }
  if (declared.error === "TOO_LARGE") {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_RESPONSE_TOO_LARGE");
  }
  if (!upstream.body || typeof upstream.body.getReader !== "function") {
    return gatewayError(502, "UPSTREAM_PROTOCOL_ERROR");
  }
  return new Response(boundedEventStream(upstream.body), {
    status: 200,
    headers: responseHeaders(contentType),
  });
}

export async function handleRequest(request, env, fetchImpl = fetch) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return gatewayError(400, "INVALID_REQUEST_URL");
  }

  const configuration = configuredEnvironment(env);
  if (!configuration) {
    return gatewayError(503, "GATEWAY_CONFIGURATION_ERROR");
  }
  if (url.protocol !== "https:" || url.hostname !== configuration.publicHost || url.port !== "") {
    return gatewayError(421, "PUBLIC_HOST_REQUIRED");
  }
  if (url.search !== "") {
    return gatewayError(400, "QUERY_STRING_NOT_ALLOWED");
  }

  if (url.pathname === SESSION_PATH) {
    return sessionResponse(request);
  }

  const route = ROUTES.get(url.pathname);
  if (!route) {
    return gatewayError(404, "ROUTE_NOT_FOUND");
  }
  if (request.method !== route.method) {
    return gatewayError(405, "METHOD_NOT_ALLOWED", { Allow: route.method });
  }

  let body;
  if (route.method === "POST") {
    const parsed = await boundedJsonBody(request);
    if (parsed.error) {
      return parsed.error;
    }
    body = parsed.body;
  }

  const base = route.provider === "owui" ? configuration.owuiOrigin : configuration.engineOrigin;
  const upstreamUrl = new URL(url.pathname, base);
  let upstream;
  try {
    upstream = await fetchImpl(
      new Request(upstreamUrl, {
        method: route.method,
        headers: upstreamHeaders(route, env),
        body,
        redirect: "manual",
        signal: request.signal,
      })
    );
  } catch (error) {
    if (request.signal.aborted || (error && error.name === "AbortError")) {
      throw error;
    }
    return gatewayError(502, "UPSTREAM_UNAVAILABLE");
  }

  if (upstream.status !== 200 || upstream.redirected) {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_REJECTED");
  }
  const contentType = upstream.headers.get("Content-Type");
  if (!expectedContentType(route, contentType)) {
    await cancelBody(upstream.body);
    return gatewayError(502, "UPSTREAM_PROTOCOL_ERROR");
  }

  return route.responseType === "application/json"
    ? bufferedJsonResponse(upstream, contentType)
    : streamedEventResponse(upstream, contentType);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
