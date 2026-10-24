/* global AbortController, AbortSignal, Headers, RequestInit, Response, TextDecoder, clearTimeout, setTimeout */
import { ChatGatewayError } from "../chat/ChatGatewayError";

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
  constructor(private readonly send: Fetch) {}

  readonly fetch: Fetch = async (url, init = {}) => {
    if (!this.token || this.expiresAt <= Date.now()) {
      this.token = undefined;
      throw new ChatGatewayError("SESSION_EXPIRED");
    }
    if (url !== "/v1/models" && url !== "/v1/chat/completions" && url !== "/session")
      throw new ChatGatewayError("INVALID_CONFIGURATION");
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
    if (response.status === 401 && this.token === token) this.token = undefined;
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
      const pending = this.send("/word-api/session/exchange", {
        method: "POST",
        credentials: "omit",
        redirect: "manual",
        cache: "no-store",
        signal: abort.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code, verifier, state }),
      }).then((response) => {
        if (abort.signal.aborted) {
          void response.body?.cancel().catch(() => undefined);
          throw new ChatGatewayError("CANCELLED");
        }
        return response;
      });
      const response = await interrupted(pending, abort.signal);
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
    this.exchanging?.abort();
    this.token = undefined;
    this.expiresAt = 0;
  }
}
