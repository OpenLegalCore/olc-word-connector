/* global AbortController, AbortSignal, ReadableStreamDefaultReader, RequestCredentials, RequestInit, Response, URL, clearTimeout, globalThis, setTimeout */

import type { ChatGateway, CompletionRequest, CompletionResult } from "./ChatGateway";
import { ChatGatewayError, type ChatGatewayErrorCode } from "./ChatGatewayError";
import { parseOpenWebUICompletionStream } from "./openWebUIContract";
import { serializePromptEnvelope } from "./promptEnvelope";

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RESPONSE_CHARS = 50_000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXACT_HTTP_LOOPBACK_AUTHORITY =
  /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?=\/|$)/i;
const RAW_USERINFO_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;

export interface OpenWebUIAdapterConfig {
  readonly baseUrl?: string;
  readonly modelId: string;
  readonly credential?: string;
  readonly transport?: "direct" | "same-origin";
  readonly requestTimeoutMs?: number;
  readonly maxResponseChars?: number;
}

export type OpenWebUIFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenWebUIAdapterDependencies {
  readonly fetch?: OpenWebUIFetch;
  readonly uuidV4?: () => string;
}

interface ModelsResponse {
  readonly data: ReadonlyArray<{ readonly id: string }>;
}

function invalidConfiguration(): never {
  throw new ChatGatewayError("INVALID_CONFIGURATION");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function isExactHttpLoopback(value: string, parsed: URL): boolean {
  const hasExactCanonicalHostname =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";

  return (
    parsed.protocol === "http:" &&
    hasExactCanonicalHostname &&
    EXACT_HTTP_LOOPBACK_AUTHORITY.test(value)
  );
}

function normalizeBaseUrl(value: string): string {
  if (
    value.length === 0 ||
    value.trim() !== value ||
    hasControlCharacter(value) ||
    value.includes("?") ||
    value.includes("#") ||
    RAW_USERINFO_AUTHORITY.test(value)
  ) {
    return invalidConfiguration();
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return invalidConfiguration();
  }

  const hasAllowedTransport = parsed.protocol === "https:" || isExactHttpLoopback(value, parsed);

  if (
    !hasAllowedTransport ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hostname === ""
  ) {
    return invalidConfiguration();
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
}

function requireNonEmpty(value: string): string {
  if (value.length === 0 || value.trim() !== value || hasControlCharacter(value)) {
    return invalidConfiguration();
  }
  return value;
}

function requirePositiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return invalidConfiguration();
  }
  return value;
}

function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof globalThis.fetch !== "function") {
    return Promise.reject(new ChatGatewayError("INVALID_CONFIGURATION"));
  }
  return globalThis.fetch(input, init);
}

function defaultUuidV4(): string {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    return invalidConfiguration();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => `0${byte.toString(16)}`.slice(-2));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function isModelsResponse(value: unknown): value is ModelsResponse {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    return false;
  }

  const data = (value as { readonly data?: unknown }).data;
  return (
    Array.isArray(data) &&
    data.every(
      (model) =>
        typeof model === "object" &&
        model !== null &&
        "id" in model &&
        typeof (model as { readonly id?: unknown }).id === "string"
    )
  );
}

function mediaType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
}

function statusError(status: number): ChatGatewayError {
  let code: ChatGatewayErrorCode;
  if (status === 401) {
    code = "AUTH_REQUIRED";
  } else if (status === 403) {
    code = "ACCESS_DENIED";
  } else if (status === 404) {
    code = "MODEL_NOT_AVAILABLE";
  } else if (status === 408) {
    code = "TIMEOUT";
  } else if (status === 429) {
    code = "RATE_LIMITED";
  } else if (status >= 500) {
    code = "SERVICE_UNAVAILABLE";
  } else {
    code = "INVALID_RESPONSE";
  }
  return new ChatGatewayError(code);
}

export class OpenWebUIAdapter implements ChatGateway {
  private readonly baseUrl: string;
  private readonly modelId: string;
  private credential: string | undefined;
  private readonly requestCredentials: RequestCredentials;
  private readonly requestRedirect: "error" | "manual";
  private readonly requestTimeoutMs: number;
  private readonly maxResponseChars: number;
  private readonly fetchImpl: OpenWebUIFetch;
  private readonly uuidV4: () => string;
  private readonly issuedChatIds = new Set<string>();
  private readonly activeRequestStops = new Set<() => void>();

  constructor(config: OpenWebUIAdapterConfig, dependencies: OpenWebUIAdapterDependencies = {}) {
    const transport = config.transport ?? "direct";
    if (transport === "same-origin") {
      if (config.baseUrl !== undefined || config.credential !== undefined) {
        invalidConfiguration();
      }
      this.baseUrl = "";
      this.credential = undefined;
      this.requestCredentials = "same-origin";
      this.requestRedirect = "manual";
    } else {
      if (config.baseUrl === undefined || config.credential === undefined) {
        invalidConfiguration();
      }
      this.baseUrl = normalizeBaseUrl(config.baseUrl);
      this.credential = requireNonEmpty(config.credential);
      this.requestCredentials = "omit";
      this.requestRedirect = "error";
    }
    this.modelId = requireNonEmpty(config.modelId);
    this.requestTimeoutMs = requirePositiveInteger(
      config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    );
    this.maxResponseChars = requirePositiveInteger(
      config.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS
    );
    this.fetchImpl = dependencies.fetch ?? defaultFetch;
    this.uuidV4 = dependencies.uuidV4 ?? defaultUuidV4;
  }

  async checkConnection(signal?: AbortSignal): Promise<void> {
    await this.withRequestBoundary(signal, async (requestSignal) => {
      const response = await this.fetchImpl(`${this.baseUrl}/api/models`, {
        method: "GET",
        headers: this.headers("application/json"),
        credentials: this.requestCredentials,
        redirect: this.requestRedirect,
        signal: requestSignal,
      });

      this.requireSuccessfulResponse(response, "application/json");

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new ChatGatewayError("INVALID_RESPONSE");
        }
        throw error;
      }

      if (!isModelsResponse(payload)) {
        throw new ChatGatewayError("INVALID_RESPONSE");
      }
      if (!payload.data.some((model) => model.id === this.modelId)) {
        throw new ChatGatewayError("MODEL_NOT_AVAILABLE");
      }
    });
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    return this.withRequestBoundary(signal, async (requestSignal) => {
      this.requireDirectAuthorization();
      const body = JSON.stringify({
        model: this.modelId,
        stream: true,
        chat_id: this.createFreshChatId(),
        messages: [
          {
            role: "user",
            content: serializePromptEnvelope(request),
          },
        ],
      });
      const response = await this.fetchImpl(`${this.baseUrl}/api/chat/completions`, {
        method: "POST",
        headers: this.headers("text/event-stream", "application/json"),
        body,
        credentials: this.requestCredentials,
        redirect: this.requestRedirect,
        signal: requestSignal,
      });

      this.requireSuccessfulResponse(response, "text/event-stream");
      if (!response.body || typeof response.body.getReader !== "function") {
        this.cancelResponseBody(response);
        throw new ChatGatewayError("INVALID_RESPONSE");
      }

      let reader: ReadableStreamDefaultReader<Uint8Array>;
      try {
        reader = response.body.getReader();
      } catch {
        this.cancelResponseBody(response);
        throw new ChatGatewayError("INVALID_RESPONSE");
      }

      return parseOpenWebUICompletionStream(reader, requestSignal, this.maxResponseChars);
    });
  }

  disconnect(): void {
    this.credential = undefined;
    for (const stop of [...this.activeRequestStops]) {
      stop();
    }
    this.issuedChatIds.clear();
  }

  private requireDirectAuthorization(): void {
    if (this.requestCredentials === "omit" && this.credential === undefined) {
      throw new ChatGatewayError("AUTH_REQUIRED");
    }
  }

  private headers(accept: string, contentType?: string): Record<string, string> {
    this.requireDirectAuthorization();
    const headers: Record<string, string> = { Accept: accept };
    if (contentType !== undefined) {
      headers["Content-Type"] = contentType;
    }
    if (this.credential !== undefined) {
      headers.Authorization = `Bearer ${this.credential}`;
    }
    return headers;
  }

  private createFreshChatId(): string {
    let uuid: string;
    try {
      uuid = this.uuidV4();
    } catch (error) {
      if (error instanceof ChatGatewayError) {
        throw error;
      }
      throw new ChatGatewayError("INVALID_CONFIGURATION");
    }

    const chatId = `local:${uuid}`;
    if (!UUID_V4_PATTERN.test(uuid) || this.issuedChatIds.has(chatId)) {
      throw new ChatGatewayError("INVALID_CONFIGURATION");
    }
    this.issuedChatIds.add(chatId);
    return chatId;
  }

  private requireSuccessfulResponse(response: Response, expectedType: string): void {
    const responseType = mediaType(response);
    if (
      this.requestCredentials === "same-origin" &&
      (response.type === "opaqueredirect" ||
        (response.status >= 300 && response.status < 400) ||
        response.redirected ||
        response.status === 401 ||
        response.status === 403 ||
        responseType === "text/html")
    ) {
      this.cancelResponseBody(response);
      throw new ChatGatewayError("SESSION_EXPIRED");
    }
    if (response.status !== 200) {
      this.cancelResponseBody(response);
      throw statusError(response.status);
    }
    if (response.redirected || responseType !== expectedType) {
      this.cancelResponseBody(response);
      throw new ChatGatewayError("INVALID_RESPONSE");
    }
  }

  private cancelResponseBody(response: Response): void {
    if (!response.body || typeof response.body.cancel !== "function") {
      return;
    }
    try {
      void response.body.cancel().catch(() => undefined);
    } catch {
      // Response cleanup must not replace a controlled gateway failure.
    }
  }

  private async withRequestBoundary<T>(
    externalSignal: AbortSignal | undefined,
    operation: (requestSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (externalSignal?.aborted) {
      throw new ChatGatewayError("CANCELLED");
    }

    const controller = new AbortController();
    let boundaryCode: "CANCELLED" | "TIMEOUT" | undefined;
    let rejectBoundary: (error: ChatGatewayError) => void = () => undefined;
    const boundary = new Promise<never>((_resolve, reject) => {
      rejectBoundary = reject;
    });
    const stop = (code: "CANCELLED" | "TIMEOUT"): void => {
      if (boundaryCode !== undefined) {
        return;
      }
      boundaryCode = code;
      controller.abort();
      rejectBoundary(new ChatGatewayError(code));
    };
    const onExternalAbort = (): void => stop("CANCELLED");
    this.activeRequestStops.add(onExternalAbort);
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    const timeout = setTimeout(() => stop("TIMEOUT"), this.requestTimeoutMs);

    try {
      return await Promise.race([operation(controller.signal), boundary]);
    } catch (error) {
      if (boundaryCode !== undefined) {
        throw new ChatGatewayError(boundaryCode);
      }
      if (error instanceof ChatGatewayError) {
        throw error;
      }
      throw new ChatGatewayError("NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      this.activeRequestStops.delete(onExternalAbort);
    }
  }
}
