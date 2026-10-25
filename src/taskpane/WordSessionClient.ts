/* global AbortController, AbortSignal, Headers, RequestInit, Response, TextDecoder, clearTimeout, setTimeout */
import { ChatGatewayError } from "../chat/ChatGatewayError";
import type { MicrosoftTokenSource } from "./MicrosoftAccess";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const opaque = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

async function interrupted<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void pending.catch(() => undefined);
    throw new ChatGatewayError("CANCELLED");
  }
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        cancel = () => reject(new ChatGatewayError("CANCELLED"));
        signal.addEventListener("abort", cancel, { once: true });
      }),
    ]);
  } finally {
    if (cancel) signal.removeEventListener("abort", cancel);
  }
}

/** Opaque Word capability, memory only. No cookie, refresh token or provider credential. */
export class WordSessionClient {
  private token?: string;
  private expiresAt = 0;
  private generation = 0;
  private exchanging?: AbortController;
  private renewal?: Promise<void>;
  private identityToken?: string;
  constructor(
    private readonly send: Fetch,
    private readonly identity?: MicrosoftTokenSource
  ) {}

  authenticate(interactive = false, forceRefresh = false): Promise<void> {
    if (!this.identity) return Promise.resolve();
    if (this.renewal) return this.renewal;
    const generation = this.generation;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), interactive ? 5 * 60_000 : 30_000);
    this.renewal = (async () => {
      const token = await interrupted(
        this.identity!.acquire(interactive, forceRefresh),
        abort.signal
      );
      if (generation !== this.generation) throw new ChatGatewayError("CANCELLED");
      if (!token.accessToken || token.expiresAt <= Date.now())
        throw new ChatGatewayError("SESSION_EXPIRED");
      if (
        interactive ||
        forceRefresh ||
        !this.token ||
        token.accessToken !== this.identityToken ||
        this.expiresAt <= Date.now() + 30_000
      ) {
        await this.requestSession({}, token.accessToken, abort.signal);
        this.identityToken = token.accessToken;
      }
    })()
      .catch((error: unknown) => {
        if (abort.signal.aborted) throw new ChatGatewayError("TIMEOUT");
        throw error;
      })
      .finally(() => {
        clearTimeout(timer);
        this.renewal = undefined;
      });
    return this.renewal;
  }

  prepare(signal?: AbortSignal): Promise<void> {
    const pending = this.authenticate();
    return signal ? interrupted(pending, signal) : pending;
  }

  readonly fetch: Fetch = async (url, init = {}) => {
    if (url !== "/v1/models" && url !== "/v1/chat/completions" && url !== "/session")
      throw new ChatGatewayError("INVALID_CONFIGURATION");
    if (this.identity) {
      const pending = this.authenticate();
      if (init.signal) await interrupted(pending, init.signal);
      else await pending;
    }
    if (!this.token || this.expiresAt <= Date.now()) {
      this.token = undefined;
      throw new ChatGatewayError("SESSION_EXPIRED");
    }
    const token = this.token;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await this.send("/word-api" + url, {
      ...init,
      headers,
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
    });
    if (response.status === 401) {
      const stillCurrent = this.token === token;
      if (stillCurrent) this.token = undefined;
      // Only replay an idempotent discovery GET. Never replay a completion body.
      if (this.identity && (init.method ?? "GET") === "GET" && url !== "/v1/chat/completions") {
        void response.body?.cancel().catch(() => undefined);
        if (stillCurrent) await this.authenticate(false, true);
        if (init.signal?.aborted) throw new ChatGatewayError("CANCELLED");
        headers.set("Authorization", `Bearer ${this.token}`);
        const retry = await this.send("/word-api" + url, {
          ...init,
          headers,
          credentials: "omit",
          redirect: "manual",
          cache: "no-store",
        });
        if (retry.status === 401) {
          this.token = undefined;
          void retry.body?.cancel().catch(() => undefined);
          throw new ChatGatewayError("ACCESS_DENIED");
        }
        return retry;
      }
      if (this.identity) {
        void response.body?.cancel().catch(() => undefined);
        throw new ChatGatewayError("ACCESS_DENIED");
      }
    }
    return response;
  };

  async exchange(
    code: string,
    verifier: string,
    state: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (!opaque(code) || !opaque(verifier) || !opaque(state) || this.exchanging)
      throw new ChatGatewayError("INVALID_RESPONSE");
    return this.requestSession({ code, verifier, state }, undefined, signal);
  }

  private async requestSession(
    body: Record<string, string>,
    microsoftToken?: string,
    signal?: AbortSignal
  ): Promise<void> {
    const generation = this.generation;
    const abort = new AbortController();
    const cancel = (): void => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) abort.abort();
    this.exchanging = abort;
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      abort.abort();
    }, 15_000);
    try {
      if (abort.signal.aborted) throw new ChatGatewayError("CANCELLED");
      const pending = this.send(
        microsoftToken ? "/word-api/session/microsoft" : "/word-api/session/exchange",
        {
          method: "POST",
          credentials: "omit",
          redirect: "manual",
          cache: "no-store",
          signal: abort.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(microsoftToken ? { Authorization: `Bearer ${microsoftToken}` } : {}),
          },
          body: JSON.stringify(body),
        }
      ).then((response) => {
        if (abort.signal.aborted) {
          void response.body?.cancel().catch(() => undefined);
          throw new ChatGatewayError("CANCELLED");
        }
        return response;
      });
      const response = await interrupted(pending, abort.signal);
      // Only MSAL can request Microsoft interaction. An API-rejected token is
      // an authorization/configuration failure, not a reason for a login loop.
      if (microsoftToken && response.status === 401) {
        void response.body?.cancel().catch(() => undefined);
        throw new ChatGatewayError("ACCESS_DENIED");
      }
      this.requireResponse(response);
      const reader = response.body?.getReader();
      if (!reader) throw new ChatGatewayError("INVALID_RESPONSE");
      let text = "",
        size = 0;
      const decoder = new TextDecoder("utf-8", { fatal: true });
      try {
        while (true) {
          const chunk = await interrupted(reader.read(), abort.signal);
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 1024) throw new ChatGatewayError("INVALID_RESPONSE");
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        void reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new ChatGatewayError("INVALID_RESPONSE");
      }
      if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ChatGatewayError("INVALID_RESPONSE");
      if (
        Object.keys(value).sort().join(",") !== "expiresAt,scope,token" ||
        !opaque(value.token) ||
        value.scope !== "word:models word:complete" ||
        typeof value.expiresAt !== "number" ||
        value.expiresAt <= Date.now() ||
        value.expiresAt > Date.now() + 15 * 60_000
      )
        throw new ChatGatewayError("INVALID_RESPONSE");
      if (generation !== this.generation || abort.signal.aborted)
        throw new ChatGatewayError("CANCELLED");
      this.token = value.token;
      this.expiresAt = value.expiresAt;
    } catch (error) {
      if (timeout) throw new ChatGatewayError("TIMEOUT");
      throw error instanceof ChatGatewayError
        ? error
        : new ChatGatewayError(abort.signal.aborted ? "CANCELLED" : "NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (this.exchanging === abort) this.exchanging = undefined;
    }
  }

  async check(signal?: AbortSignal): Promise<void> {
    const abort = new AbortController();
    const cancel = (): void => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      abort.abort();
    }, 15_000);
    let response: Response | undefined;
    try {
      if (abort.signal.aborted) throw new ChatGatewayError("CANCELLED");
      const checked = await interrupted<Response>(
        this.fetch("/session", {
          method: "GET",
          signal: abort.signal,
          headers: { Accept: "application/json" },
        }).then((result) => {
          if (abort.signal.aborted) {
            void result.body?.cancel().catch(() => undefined);
            throw new ChatGatewayError("CANCELLED");
          }
          return result;
        }),
        abort.signal
      );
      response = checked;
      this.requireResponse(checked);
    } catch (error) {
      if (timeout) throw new ChatGatewayError("TIMEOUT");
      throw error instanceof ChatGatewayError
        ? error
        : new ChatGatewayError(abort.signal.aborted ? "CANCELLED" : "NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      void response?.body?.cancel().catch(() => undefined);
    }
  }

  private requireResponse(response: Response): void {
    if (response.status === 401) throw new ChatGatewayError("SESSION_EXPIRED");
    if (response.status === 403) throw new ChatGatewayError("ACCESS_DENIED");
    if (response.status === 429) throw new ChatGatewayError("RATE_LIMITED");
    if (response.status >= 500) throw new ChatGatewayError("SERVICE_UNAVAILABLE");
    if (
      response.status !== 200 ||
      response.redirected ||
      response.type === "opaqueredirect" ||
      response.headers.get("Content-Type")?.split(";", 1)[0] !== "application/json" ||
      response.headers.get("X-OLC-Word-Gateway") !== "1"
    )
      throw new ChatGatewayError("INVALID_RESPONSE");
  }

  clear(): void {
    this.generation++;
    this.identity?.close();
    this.identityToken = undefined;
    this.exchanging?.abort();
    this.token = undefined;
    this.expiresAt = 0;
  }
}
