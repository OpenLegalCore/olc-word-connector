/* global AbortController, AbortSignal, RequestCredentials, RequestInit, Response, TextDecoder, URL, clearTimeout, globalThis, setTimeout */

import type { ChatGateway, CompletionRequest, CompletionResult } from "./ChatGateway";
import { ChatGatewayError, type ChatGatewayErrorCode } from "./ChatGatewayError";
import { serializePromptEnvelope } from "./promptEnvelope";

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_MAX_RESPONSE_CHARS = 50_000;
const EXACT_HTTP_LOOPBACK_AUTHORITY =
  /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?=\/|$)/i;
const RAW_USERINFO_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i;
const WILDCARD_HOSTS = new Set(["0.0.0.0", "[::]", "*"]);

export interface OpenAICompatibleAdapterConfig {
  readonly baseUrl?: string;
  readonly modelId: string;
  readonly credential?: string;
  readonly transport?: "direct" | "same-origin";
  readonly requestTimeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly maxResponseChars?: number;
}

export type OpenAICompatibleFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenAICompatibleAdapterDependencies {
  readonly fetch?: OpenAICompatibleFetch;
}

interface ModelsResponse {
  readonly object: "list";
  readonly data: ReadonlyArray<{ readonly id: string }>;
}

interface CompletionResponse {
  readonly model?: string;
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly content: string;
    };
  }>;
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
  const hasRootPath = parsed.pathname === "/";

  if (
    !hasAllowedTransport ||
    !hasRootPath ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hostname === "" ||
    parsed.port === "0" ||
    WILDCARD_HOSTS.has(parsed.hostname)
  ) {
    return invalidConfiguration();
  }

  return parsed.origin;
}

function requireNonEmpty(value: string): string {
  if (value.length === 0 || value.trim() !== value || hasControlCharacter(value)) {
    return invalidConfiguration();
  }
  return value;
}

function optionalCredential(value: string | undefined): string | undefined {
  return value === undefined ? undefined : requireNonEmpty(value);
}

function requirePositiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return invalidConfiguration();
  }
  return value;
}

function isByteChunk(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]"
  );
}

function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof globalThis.fetch !== "function") {
    return Promise.reject(new ChatGatewayError("INVALID_CONFIGURATION"));
  }
  return globalThis.fetch(input, init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModelsResponse(value: unknown): value is ModelsResponse {
  if (!isRecord(value) || value.object !== "list" || !Array.isArray(value.data)) {
    return false;
  }

  return value.data.every(
    (model) => isRecord(model) && typeof model.id === "string" && model.id.length > 0
  );
}

function isCompletionResponse(value: unknown): value is CompletionResponse {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    return false;
  }

  const firstChoice = value.choices[0];
  return (
    isRecord(firstChoice) &&
    isRecord(firstChoice.message) &&
    typeof firstChoice.message.content === "string"
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

export class OpenAICompatibleAdapter implements ChatGateway {
  private readonly baseUrl: string;
  private readonly modelId: string;
  private credential: string | undefined;
  private readonly requestCredentials: RequestCredentials;
  private readonly requestRedirect: "error" | "manual";
  private readonly requestTimeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly maxResponseChars: number;
  private readonly fetchImpl: OpenAICompatibleFetch;
  private readonly activeRequestStops = new Set<() => void>();

  constructor(
    config: OpenAICompatibleAdapterConfig,
    dependencies: OpenAICompatibleAdapterDependencies = {}
  ) {
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
      if (config.baseUrl === undefined) {
        invalidConfiguration();
      }
      this.baseUrl = normalizeBaseUrl(config.baseUrl);
      this.credential = optionalCredential(config.credential);
      this.requestCredentials = "omit";
      this.requestRedirect = "error";
    }
    this.modelId = requireNonEmpty(config.modelId);
    this.requestTimeoutMs = requirePositiveInteger(
      config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    );
    this.maxResponseBytes = requirePositiveInteger(
      config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    );
    this.maxResponseChars = requirePositiveInteger(
      config.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS
    );
    this.fetchImpl = dependencies.fetch ?? defaultFetch;
  }

  async checkConnection(signal?: AbortSignal): Promise<void> {
    await this.withRequestBoundary(signal, async (requestSignal) => {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
        method: "GET",
        headers: this.headers("application/json"),
        credentials: this.requestCredentials,
        redirect: this.requestRedirect,
        signal: requestSignal,
      });

      this.requireSuccessfulJsonResponse(response);
      const payload = await this.parseJson(response);
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
      const body = JSON.stringify({
        model: this.modelId,
        stream: false,
        messages: [
          {
            role: "user",
            content: serializePromptEnvelope(request),
          },
        ],
      });
      const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.headers("application/json", "application/json"),
        body,
        credentials: this.requestCredentials,
        redirect: this.requestRedirect,
        signal: requestSignal,
      });

      this.requireSuccessfulJsonResponse(response);
      const payload = await this.parseJson(response);
      if (!isCompletionResponse(payload)) {
        throw new ChatGatewayError("INVALID_RESPONSE");
      }

      const text = payload.choices[0].message.content;
      if (text.includes("\u0000")) {
        throw new ChatGatewayError("INVALID_RESPONSE");
      }
      if (text.trim().length === 0) {
        throw new ChatGatewayError("EMPTY_RESPONSE");
      }
      if (text.length > this.maxResponseChars) {
        throw new ChatGatewayError("INVALID_RESPONSE");
      }

      return typeof payload.model === "string" ? { text, model: payload.model } : { text };
    });
  }

  disconnect(): void {
    this.credential = undefined;
    for (const stop of [...this.activeRequestStops]) {
      stop();
    }
  }

  private headers(accept: string, contentType?: string): Record<string, string> {
    const headers: Record<string, string> = { Accept: accept };
    if (contentType !== undefined) {
      headers["Content-Type"] = contentType;
    }
    if (this.credential !== undefined) {
      headers.Authorization = `Bearer ${this.credential}`;
    }
    return headers;
  }

  private requireSuccessfulJsonResponse(response: Response): void {
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
    if (response.redirected || responseType !== "application/json") {
      this.cancelResponseBody(response);
      throw new ChatGatewayError("INVALID_RESPONSE");
    }
  }

  private async parseJson(response: Response): Promise<unknown> {
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null) {
      if (!/^(?:0|[1-9]\d*)$/.test(declaredLength)) {
        this.cancelResponseBody(response);
        throw new ChatGatewayError("INVALID_RESPONSE");
      }
      const declaredBytes = Number(declaredLength);
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes > this.maxResponseBytes) {
        this.cancelResponseBody(response);
        throw new ChatGatewayError("INVALID_RESPONSE");
      }
    }

    if (!response.body || typeof response.body.getReader !== "function") {
      throw new ChatGatewayError("INVALID_RESPONSE");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        if (!isByteChunk(chunk.value)) {
          void reader.cancel().catch(() => undefined);
          throw new ChatGatewayError("INVALID_RESPONSE");
        }
        totalBytes += chunk.value.byteLength;
        if (totalBytes > this.maxResponseBytes) {
          void reader.cancel().catch(() => undefined);
          throw new ChatGatewayError("INVALID_RESPONSE");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text) as unknown;
    } catch {
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
