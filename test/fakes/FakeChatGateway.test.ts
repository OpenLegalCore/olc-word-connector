import { expect, it, vi } from "vitest";

import type { CompletionRequest } from "../../src/chat/ChatGateway";
import { FakeChatGateway } from "./FakeChatGateway";

const request: CompletionRequest = {
  question: "Which law applies?",
  context: { type: "none" },
  uiLocale: "en-US",
};

it("removes its abort listener after a normal completion", async () => {
  const abortController = new AbortController();
  const addListener = vi.spyOn(abortController.signal, "addEventListener");
  const removeListener = vi.spyOn(abortController.signal, "removeEventListener");
  const gateway = new FakeChatGateway({ text: "Completed text" });

  const completion = gateway.complete(request, abortController.signal);
  expect(await completion).toEqual({ text: "Completed text" });
  expect(addListener).toHaveBeenCalledTimes(1);
  expect(removeListener).toHaveBeenCalledTimes(1);

  abortController.abort();

  expect(await completion).toEqual({ text: "Completed text" });
  expect(removeListener).toHaveBeenCalledTimes(1);
});
