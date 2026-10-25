/* global fetch, AbortSignal */
const { ORIGIN } = require("./receiver");
// Explicit operator action after activation. Fixed routes only; no completion.
async function probeApi(accessToken, send = fetch) {
  const checks = [];
  async function request(path, method, token, expected) {
    const response = await send(ORIGIN + path, {
      method,
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Origin: ORIGIN,
        "User-Agent": "Mozilla/5.0 OLC staging verification",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    checks.push({ path, method, status: response.status, expected });
    if (response.status !== expected || response.headers.get("X-OLC-Word-Gateway") !== "1")
      throw new Error("Staging verification failed");
    return response;
  }
  let capability;
  try {
    await (await request("/word-api/session", "GET", undefined, 401)).body?.cancel();
    await (
      await request("/word-api/session/microsoft", "POST", "invalid-token", 401)
    ).body?.cancel();
    const session = await (
      await request("/word-api/session/microsoft", "POST", accessToken, 200)
    ).json();
    if (
      typeof session.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.token) ||
      typeof session.expiresAt !== "number" ||
      session.scope !== "word:models word:complete" ||
      session.expiresAt <= Date.now() ||
      session.expiresAt > Date.now() + 900_000
    )
      throw new Error("Invalid capability");
    capability = session.token;
    await (await request("/word-api/session", "GET", capability, 200)).body?.cancel();
    await (await request("/word-api/v1/models", "GET", capability, 200)).body?.cancel();
    await (await request("/word-api/session/revoke", "POST", capability, 200)).body?.cancel();
    await (await request("/word-api/session", "GET", capability, 401)).body?.cancel();
    capability = undefined;
    return { result: "PASS", checks, completionRequests: 0 };
  } catch {
    return { result: "FAIL", checks, completionRequests: 0 };
  } finally {
    if (capability) {
      await request("/word-api/session/revoke", "POST", capability, 200)
        .then((r) => r.body?.cancel())
        .catch(() => undefined);
    }
  }
}
module.exports = { probeApi };
