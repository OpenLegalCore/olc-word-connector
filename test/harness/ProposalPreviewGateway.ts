/* global AbortSignal, ReadableStream, Response, TextEncoder, window */

import type {
  ChatGateway,
  CompletionObserver,
  CompletionRequest,
  CompletionResult,
} from "../../src/chat/ChatGateway";
import { OpenAICompatibleAdapter } from "../../src/chat/OpenAICompatibleAdapter";
import { contentEvent, documentReviewFixture, successTerminal } from "../fixtures/documentReview";

/** Actual Word transport/parser, with local synthetic HTTP/SSE only. No network. */
export class ProposalPreviewGateway implements ChatGateway {
  private readonly adapter: OpenAICompatibleAdapter;

  constructor(withProposal = false, failAfterDelta = false) {
    this.adapter = new OpenAICompatibleAdapter(
      {
        transport: "same-origin",
        modelId: "lexai-engine-local",
        responseProfile: "document-review",
      },
      {
        fetch: async (path, init) => {
          if (path === "/v1/models")
            return new Response(
              JSON.stringify({ object: "list", data: [{ id: "lexai-engine-local" }] }),
              { headers: { "Content-Type": "application/json" } }
            );
          const body = JSON.parse(init!.body as string) as { response_language: "sl" | "en" };
          const characters = Array.from(
            JSON.stringify(documentReviewFixture(body.response_language, withProposal))
          );
          let position = 0;
          let timer: number;
          let cancelled = false;
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                const next = (): void => {
                  if (cancelled) return;
                  if (failAfterDelta && position >= 160) {
                    controller.enqueue(
                      new TextEncoder().encode('data: {"error":{"code":"synthetic_failure"}}\n\n')
                    );
                    controller.close();
                    return;
                  }
                  if (position >= characters.length) {
                    controller.enqueue(new TextEncoder().encode(successTerminal));
                    controller.close();
                    return;
                  }
                  controller.enqueue(
                    new TextEncoder().encode(
                      contentEvent(characters.slice(position, position + 80).join(""))
                    )
                  );
                  position += 80;
                  timer = window.setTimeout(next, 180);
                };
                timer = window.setTimeout(next, 450);
              },
              cancel() {
                cancelled = true;
                window.clearTimeout(timer);
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } }
          );
        },
      }
    );
  }

  checkConnection(signal?: AbortSignal): Promise<void> {
    return this.adapter.checkConnection(signal);
  }
  disconnect(): void {
    this.adapter.disconnect();
  }
  complete(
    request: CompletionRequest,
    signal?: AbortSignal,
    observer?: CompletionObserver
  ): Promise<CompletionResult> {
    return this.adapter.complete(request, signal, observer);
  }
}
