/* global AbortController, AbortSignal, Document, RequestInit, Response, clearTimeout, setTimeout */

import { ChatGatewayError } from "../chat/ChatGatewayError";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Reachability of the existing protected landing, never a claim about user identity. */
export async function checkProtectedSession(fetch: Fetch, signal?: AbortSignal): Promise<void> {
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
  let rejectAbort: (() => void) | undefined;
  try {
    if (abort.signal.aborted) throw new ChatGatewayError("CANCELLED");
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(new ChatGatewayError(timeout ? "TIMEOUT" : "CANCELLED"));
      abort.signal.addEventListener("abort", rejectAbort, { once: true });
    });
    const pending = fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: abort.signal,
    }).then((result) => {
      if (abort.signal.aborted) {
        void result.body?.cancel().catch(() => undefined);
        throw new ChatGatewayError(timeout ? "TIMEOUT" : "CANCELLED");
      }
      return result;
    });
    response = await Promise.race([pending, interrupted]);
    if (abort.signal.aborted) throw new ChatGatewayError(timeout ? "TIMEOUT" : "CANCELLED");
    const html =
      (response.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase() ===
      "text/html";
    const marker = response.headers.get("X-OLC-Word-Gateway") === "1";
    if (
      response.type === "opaqueredirect" ||
      response.redirected ||
      (response.status >= 300 && response.status < 400) ||
      response.status === 401 ||
      (html && !marker)
    )
      throw new ChatGatewayError("SESSION_EXPIRED");
    if (response.status === 403) throw new ChatGatewayError("ACCESS_DENIED");
    if (response.status !== 200 || !html || !marker) throw new ChatGatewayError("INVALID_RESPONSE");
  } catch (error) {
    if (abort.signal.aborted) throw new ChatGatewayError(timeout ? "TIMEOUT" : "CANCELLED");
    throw error instanceof ChatGatewayError ? error : new ChatGatewayError("NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (rejectAbort) abort.signal.removeEventListener("abort", rejectAbort);
    try {
      void response?.body?.cancel().catch(() => undefined);
    } catch {
      /* do not inspect/log login bodies */
    }
  }
}

export function canRequestPaneCookieAccess(document: Document): boolean {
  return typeof document.requestStorageAccess === "function";
}

/** Called only from an explicit user gesture, before any await can consume it. */
export async function requestPaneCookieAccess(document: Document): Promise<boolean> {
  if (!canRequestPaneCookieAccess(document)) return false;
  try {
    await document.requestStorageAccess();
    return typeof document.hasStorageAccess === "function" && (await document.hasStorageAccess());
  } catch {
    return false;
  }
}
