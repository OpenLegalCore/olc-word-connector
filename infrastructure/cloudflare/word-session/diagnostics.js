/* global Date, ReadableStream, Response, setTimeout, clearTimeout */
import { store } from "./common.js";
export const validAttemptId = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const validVersion = (value) =>
  typeof value === "string" && /^(?:word-[0-9a-f]{64}|unbundled-test)$/.test(value);
const stages = [
  "accepted",
  "upstream_http",
  "upstream_unavailable",
  "response_http",
  "transfer_closed",
  "transfer_cancelled",
  "transfer_error",
];
export function validEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;
  const status = event.stage === "upstream_http" || event.stage === "response_http";
  return (
    Object.keys(event).sort().join(",") === (status ? "at,httpStatus,stage" : "at,stage") &&
    stages.includes(event.stage) &&
    typeof event.at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at) &&
    Number.isFinite(Date.parse(event.at)) &&
    (!status ||
      (Number.isInteger(event.httpStatus) && event.httpStatus >= 100 && event.httpStatus <= 599))
  );
}
// Best effort writes, serialized per attempt; never persist bytes, headers or error messages.
export class DiagnosticTrace {
  constructor(env, context) {
    this.env = env;
    this.context = context;
    this.pending = Promise.resolve();
  }
  activate(token, origin, attemptId, frontendVersion) {
    this.auth = { token, origin, attemptId, frontendVersion };
    this.record("accepted");
  }
  record(stage, httpStatus) {
    if (!this.auth) return;
    const event = {
      stage,
      at: new Date().toISOString(),
      ...(httpStatus === undefined ? {} : { httpStatus }),
    };
    if (!validEvent(event)) return;
    this.pending = this.pending.then(async () => {
      let timer;
      try {
        const result = await Promise.race([
          store(this.env, "diagnostic-write", { ...this.auth, event }),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(undefined), 1000);
          }),
        ]);
        void result?.body?.cancel().catch(() => undefined);
      } catch {
        /* Diagnostics cannot change the functional result. */
      } finally {
        clearTimeout(timer);
      }
    });
    try {
      this.context?.waitUntil(this.pending);
    } catch {
      /* Lifecycle bookkeeping must not change the response. */
    }
  }
  response(response, signal) {
    if (!this.auth) return response;
    this.record("response_http", response.status);
    if (response.status !== 200 || !response.body) {
      if (signal.aborted) this.record("transfer_cancelled");
      return response;
    }
    const reader = response.body.getReader();
    let terminal = false;
    const end = (stage) => {
      if (terminal) return;
      terminal = true;
      signal.removeEventListener("abort", abort);
      this.record(stage);
    };
    const abort = () => end("transfer_cancelled");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    // This observes transport only. It does not parse SSE or claim model success.
    const body = new ReadableStream(
      {
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) {
              end("transfer_closed");
              reader.releaseLock();
              controller.close();
            } else controller.enqueue(chunk.value);
          } catch {
            end("transfer_error");
            reader.releaseLock();
            controller.error(new Error("TRANSFER_ERROR"));
          }
        },
        async cancel() {
          end("transfer_cancelled");
          try {
            await reader.cancel();
          } catch {
            /* safe cleanup */
          } finally {
            reader.releaseLock();
          }
        },
      },
      { highWaterMark: 0 }
    );
    return new Response(body, { status: response.status, headers: response.headers });
  }
}
