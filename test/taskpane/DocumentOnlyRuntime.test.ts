import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import {
  createSameOriginProductionGateways,
  ProductionTaskPaneRuntime,
} from "../../src/taskpane/ProductionTaskPaneRuntime";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import { FakeOfficeWordRuntime } from "../office/FakeOfficeWordRuntime";
import {
  contentEvent,
  documentOnlyFixture,
  documentReviewFixture,
  successTerminal,
} from "../fixtures/documentReview";

let runtime: ProductionTaskPaneRuntime | undefined;
let root: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren(document.createElement("div"));
  root = document.body.firstElementChild as HTMLElement;
});
afterEach(() => {
  runtime?.dispose();
  vi.restoreAllMocks();
});
function button(id: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`button[data-action-id="${id}"]`);
}
function click(id: string): void {
  const target = button(id);
  expect(target).not.toBeNull();
  target!.click();
}
function state(): string | undefined {
  return root.querySelector<HTMLElement>(".olc-app")?.dataset.viewState;
}
function response(wire: string): Response {
  return new Response(wire, { headers: { "Content-Type": "text/event-stream" } });
}
async function setup(value: unknown, locale: "sl-SI" | "en-US" = "sl-SI", wire?: string) {
  const office = new FakeOfficeWordRuntime({
    text: "Frozen synthetic selection",
    locationId: "original",
  });
  const word = new OfficeWordAdapter(office);
  let modelFailure = false;
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      if (wire === "held") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              stream = c;
            },
          }),
          {
            headers: { "Content-Type": "text/event-stream" },
          }
        );
      }
      return response(wire ?? contentEvent(JSON.stringify(value)) + successTerminal);
    }
    if (modelFailure) return new Response("", { status: 403 });
    return new Response(JSON.stringify({ object: "list", data: [{ id: "lexai-engine-local" }] }), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const gateways = createSameOriginProductionGateways({ fetch });
  const clipboard = { writeText: vi.fn(async () => {}) };
  runtime = new ProductionTaskPaneRuntime(
    root,
    new TaskPaneView(root),
    word,
    gateways,
    "STAGING",
    clipboard,
    undefined,
    locale
  );
  runtime.start();
  await vi.waitFor(() => expect(root.querySelector(".olc-selection-attachment")).not.toBeNull());
  const input = root.querySelector<HTMLTextAreaElement>("#runtime-legal-question")!;
  input.value = locale === "sl-SI" ? "Preoblikuj ta odstavek." : "Rewrite this paragraph.";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  click("send");
  const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === "POST");
  return {
    office,
    posts,
    clipboard,
    gateways,
    fetch,
    failModels: (fail: boolean) => {
      modelFailure = fail;
    },
    stream: () => stream,
  };
}

describe("document-only real adapter, controller, view and Office boundary (controlled transport)", () => {
  it.each([
    ["sl-SI", true],
    ["en-US", true],
    ["sl-SI", false],
    ["en-US", false],
  ] as const)(
    "renders and explicitly replaces %s legal=%s with an empty explanation",
    async (locale, legal) => {
      const value = documentOnlyFixture(locale === "sl-SI" ? "sl" : "en", legal);
      const s = await setup(value, locale);
      await vi.waitFor(() => expect(state()).toBe("result"));
      expect(root.querySelector(".olc-legal-answer")?.textContent).toBe("");
      expect(root.querySelector(".olc-proposal-text")?.textContent).toBe(value.proposal!.markdown);
      expect(root.querySelectorAll(".olc-legal-sources li")).toHaveLength(legal ? 1 : 0);
      expect(button("copy-answer")?.disabled).toBe(true);
      click("copy-answer");
      expect(s.clipboard.writeText).not.toHaveBeenCalled();
      expect(s.office.mutationCount).toBe(0);
      const sent = JSON.parse(s.posts()[0][1]!.body as string);
      expect(sent.messages[0].content).toEqual([
        {
          type: "text",
          text: locale === "sl-SI" ? "Preoblikuj ta odstavek." : "Rewrite this paragraph.",
        },
        { type: "text", text: "Frozen synthetic selection" },
      ]);
      click("replace-proposal");
      await vi.waitFor(() => expect(s.office.mutationCount).toBe(1));
      expect(s.office.insertCalls[0]).toEqual({
        locationId: "original",
        text: value.proposal!.markdown,
        insertLocation: "Replace",
      });
      await vi.waitFor(() => expect(button("replace-proposal")?.disabled).toBe(true));
      click("replace-proposal");
      expect(s.office.mutationCount).toBe(1);
      expect(s.posts()).toHaveLength(1);
    }
  );

  it("shows required notice and separate proposal, and inserts only after an explicit cursor action", async () => {
    const value = documentOnlyFixture();
    value.status = "PARTIAL";
    value.notice = "Sintetično obvezno opozorilo.";
    const s = await setup(value);
    await vi.waitFor(() => expect(state()).toBe("result"));
    expect(root.querySelector(".olc-legal-answer")?.textContent).toBe(value.notice);
    expect(root.querySelector(".olc-proposal-text")?.textContent).toBe(value.proposal!.markdown);
    s.office.setSelection({ text: "", locationId: "cursor" });
    expect(s.office.mutationCount).toBe(0);
    click("insert-proposal");
    await vi.waitFor(() => expect(s.office.mutationCount).toBe(1));
    expect(s.office.insertCalls[0].text).toBe(value.proposal!.markdown);
    expect(s.office.insertCalls[0].text).not.toContain(value.notice);
  });

  it("reopens the retained result after a settings-check failure without resubmission and rejects selection drift", async () => {
    const value = documentOnlyFixture("sl", false);
    const s = await setup(value);
    await vi.waitFor(() => expect(state()).toBe("result"));
    click("toggle-settings");
    s.failModels(true);
    click("check-connection");
    await vi.waitFor(() => expect(state()).toBe("connection-error"));
    s.failModels(false);
    click("retry-connection");
    await vi.waitFor(() => expect(state()).toBe("result"));
    expect(root.querySelector(".olc-proposal-text")?.textContent).toBe(value.proposal!.markdown);
    expect(s.posts()).toHaveLength(1);
    expect(s.office.mutationCount).toBe(0);
    // Equal text at a different location is still a different selection.
    s.office.setSelection({ text: "Frozen synthetic selection", locationId: "foreign" });
    click("replace-proposal");
    await vi.waitFor(() => expect(button("replace-proposal")?.disabled).toBe(true));
    await vi.waitFor(() =>
      expect(root.querySelector(".olc-proposal-feedback")?.getAttribute("role")).toBe("alert")
    );
    expect(s.office.mutationCount).toBe(0);
    click("insert-proposal");
    expect(s.office.mutationCount).toBe(0);
    expect(s.posts()).toHaveLength(1);
  });

  it.each(["explanation", "question", "clarification"])(
    "keeps %s behavior in actual consumers",
    async (scenario) => {
      const value =
        scenario === "clarification"
          ? {
              status: "NEEDS_CLARIFICATION",
              claims: [],
              sources: [],
              notice: "Katero besedilo?",
              proposal: null,
            }
          : documentReviewFixture("sl", scenario === "explanation");
      const s = await setup(value);
      await vi.waitFor(() => expect(state()).toBe("result"));
      expect(root.querySelector(".olc-legal-answer")?.textContent).not.toBe("");
      expect(Boolean(button("replace-proposal"))).toBe(scenario === "explanation");
      expect(s.office.mutationCount).toBe(0);
      expect(s.posts()).toHaveLength(1);
    }
  );

  it.each(["before-stop", "before-done", "delta-error", "disconnect", "cancel"])(
    "cannot apply after %s",
    async (scenario) => {
      const value = documentOnlyFixture();
      const s = await setup(value, "sl-SI", "held");
      await vi.waitFor(() => expect(s.stream()).toBeDefined());
      const send = (wire: string) => s.stream().enqueue(new TextEncoder().encode(wire));
      send(contentEvent(JSON.stringify(value)));
      await vi.waitFor(() => expect(state()).toBe("searching"));
      expect(button("replace-proposal")).toBeNull();
      expect(button("insert-proposal")).toBeNull();
      expect(s.office.mutationCount).toBe(0);
      if (scenario === "before-stop") {
        send(successTerminal);
        s.stream().close();
        await vi.waitFor(() => expect(state()).toBe("result"));
        expect(s.office.mutationCount).toBe(0);
        return;
      }
      if (scenario === "before-done") {
        send(successTerminal.split("data: [DONE]")[0]);
        s.stream().close();
      } else if (scenario === "delta-error") {
        send('data: {"error":{"code":"document_output_invalid"}}\n\n');
        s.stream().close();
      } else if (scenario === "disconnect") {
        s.gateways.olcEngine.disconnect();
      } else if (scenario === "cancel") {
        click("cancel");
      }
      await vi.waitFor(() => expect(state()).not.toBe("searching"));
      expect(button("replace-proposal")).toBeNull();
      expect(button("insert-proposal")).toBeNull();
      expect(s.office.mutationCount).toBe(0);
      expect(s.posts()).toHaveLength(1);
    }
  );
});
