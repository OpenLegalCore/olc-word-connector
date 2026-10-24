/* global Date, URL */
import { CODE_TTL, SESSION_TTL, SCOPE, digest, random, opaque, reply, failure } from "./common.js";

/** SQLite-backed DO; code consumption, revocation and rate limits are transactional. */
export class WordSessionStore {
  constructor(state) {
    this.storage = state.storage;
  }
  async fetch(request) {
    if (request.method !== "POST") return failure(405, "METHOD_NOT_ALLOWED");
    const operation = new URL(request.url).pathname,
      input = await request.json();
    // A retried transaction must not expose intermediate data or reuse generated credentials.
    const key = opaque(input.code) ? "code:" + (await digest(input.code)) : "";
    const sessionKey = opaque(input.token) ? "session:" + (await digest(input.token)) : "";
    const challenge = opaque(input.verifier) ? await digest(input.verifier) : "";
    const token = random(),
      tokenKey = "session:" + (await digest(token));
    const code = random(),
      codeKey = "code:" + (await digest(code));
    return this.storage.transaction(async (tx) => {
      const now = Date.now();
      if (operation === "/issue" || operation === "/exchange") {
        for (const [bucket, max] of [
          ["global", 300],
          [input.client, 12],
        ]) {
          if (typeof bucket !== "string" || bucket.length > 64)
            return failure(400, "INVALID_REQUEST");
          const rateKey = "rate:" + operation + ":" + bucket;
          let rate = await tx.get(rateKey);
          if (!rate || rate.expiresAt <= now) rate = { count: 0, expiresAt: now + 60_000 };
          if (++rate.count > max) return failure(429, "RATE_LIMITED");
          await tx.put(rateKey, rate);
        }
        if ((await tx.getAlarm()) === null) await tx.setAlarm(now + 60_000);
      }
      if (operation === "/issue") {
        if (
          !opaque(input.challenge) ||
          !opaque(input.state) ||
          !Number.isFinite(input.identityExpiresAt) ||
          input.identityExpiresAt <= now
        )
          return failure(403, "ACCESS_DENIED");
        const expiresAt = Math.min(now + CODE_TTL, input.identityExpiresAt);
        await tx.put(codeKey, {
          challenge: input.challenge,
          state: input.state,
          origin: input.origin,
          identityExpiresAt: input.identityExpiresAt,
          expiresAt,
          attempts: 0,
        });
        return reply(200, { code });
      }
      if (operation === "/exchange") {
        const record = key ? await tx.get(key) : undefined;
        if (!record || record.expiresAt <= now) return failure(401, "INVALID_GRANT");
        if (
          record.challenge !== challenge ||
          record.state !== input.state ||
          record.origin !== input.origin
        ) {
          if (++record.attempts >= 5) await tx.delete(key);
          else await tx.put(key, record);
          return failure(401, "INVALID_GRANT");
        }
        const expiresAt = Math.min(now + SESSION_TTL, record.identityExpiresAt);
        if (expiresAt <= now) return failure(401, "INVALID_GRANT");
        await tx.delete(key);
        await tx.put(tokenKey, { origin: record.origin, scope: SCOPE, expiresAt });
        return reply(200, { token, expiresAt, scope: SCOPE });
      }
      if (operation === "/check" || operation === "/revoke") {
        const record = sessionKey ? await tx.get(sessionKey) : undefined;
        if (
          !record ||
          record.expiresAt <= now ||
          record.origin !== input.origin ||
          record.scope !== SCOPE
        )
          return failure(401, "SESSION_EXPIRED");
        if (operation === "/revoke") await tx.delete(sessionKey);
        return reply(200, { expiresAt: record.expiresAt, scope: record.scope });
      }
      return failure(404, "ROUTE_NOT_FOUND");
    });
  }
  async alarm() {
    // Cleanup must not delete a rate bucket renewed by a concurrent request.
    await this.storage.transaction(async (tx) => {
      const now = Date.now(),
        records = await tx.list(),
        expired = [];
      let remaining = false;
      for (const [key, record] of records) {
        if (record.expiresAt <= now) expired.push(key);
        else remaining = true;
      }
      for (let i = 0; i < expired.length; i += 128) await tx.delete(expired.slice(i, i + 128));
      if (remaining) await tx.setAlarm(now + 60_000);
    });
  }
}
