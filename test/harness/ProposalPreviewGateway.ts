import type {
  ChatGateway,
  CompletionObserver,
  CompletionRequest,
  CompletionResult,
} from "../../src/chat/ChatGateway";
import { ChatGatewayError } from "../../src/chat/ChatGatewayError";

/** Local deterministic fixture only; this is not an Engine wire-contract adapter. */
export class ProposalPreviewGateway implements ChatGateway {
  constructor(
    private readonly withProposal = false,
    private readonly failAfterDelta = false
  ) {}
  async checkConnection(): Promise<void> {}
  disconnect(): void {}
  async complete(
    request: CompletionRequest,
    signal?: AbortSignal,
    observer?: CompletionObserver
  ): Promise<CompletionResult> {
    const sl = request.uiLocale === "sl-SI";
    const deltas = sl
      ? [
          "## Odgovor\n",
          "Sintetična razlaga ostane ločena od predloga [Z1].\n\n",
          "## Viri\n- [Z1] [Sintetični vir](https://pisrs.si/pregledPredpisa?id=ZAKO2008)",
        ]
      : [
          "## Answer\n",
          "The synthetic explanation is separate from the proposal [Z1].\n\n",
          "## Sources\n- [Z1] [Synthetic source](https://pisrs.si/pregledPredpisa?id=ZAKO2008)",
        ];
    for (const delta of deltas) {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        const abort = () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = window.setTimeout(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        }, 450);
        signal?.addEventListener("abort", abort, { once: true });
      });
      observer?.onTextDelta?.(delta);
      if (this.failAfterDelta) throw new ChatGatewayError("SERVICE_UNAVAILABLE");
    }
    return {
      text: deltas.join(""),
      model: "lexai-engine-local",
      usage: { inputTokens: 84, outputTokens: 47, totalTokens: 131 },
      proposal: this.withProposal
        ? {
            text: sl
              ? "Stranki se dogovorita o roku plačila."
              : "The parties agree on the payment deadline.",
            language: sl ? "sl" : "en",
            changeSummary: sl
              ? "Izrecen sintetični predlog za lokalni pregled."
              : "Explicit synthetic proposal for local review.",
          }
        : null,
    };
  }
}
