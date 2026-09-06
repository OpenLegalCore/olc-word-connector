import type { ChatGateway, CompletionRequest, CompletionResult } from "../../src/chat/ChatGateway";

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      complete();
    };
    const onAbort = (): void => finish(() => reject(abortError()));
    const timer = setTimeout(() => finish(() => resolve()), delayMs);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class FakeChatGateway implements ChatGateway {
  readonly requests: CompletionRequest[] = [];
  readonly completionSignals: Array<AbortSignal | undefined> = [];
  connectionChecks = 0;
  delayMs = 0;
  error?: Error;

  constructor(public result: CompletionResult) {}

  async checkConnection(signal?: AbortSignal): Promise<void> {
    this.connectionChecks++;
    await wait(this.delayMs, signal);
    if (this.error) {
      throw this.error;
    }
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    this.requests.push(request);
    this.completionSignals.push(signal);
    await wait(this.delayMs, signal);
    if (this.error) {
      throw this.error;
    }
    return this.result;
  }
}
