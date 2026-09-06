import { afterEach, expect, it, vi } from "vitest";

import { TaskPaneController } from "../../src/app/TaskPaneController";
import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { FakeWordAdapter } from "../fakes/FakeWordAdapter";
import {
  bootstrapWordHarness,
  createWordHarnessComposition,
  type WordHarnessOfficeReady,
} from "./bootstrapWordHarness";
import { WordHarnessOfficeRuntime } from "./WordHarnessOfficeRuntime";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function renderWordHarness(): void {
  document.body.innerHTML = `
    <div id="bootstrap-status"></div>
    <div id="bootstrap-error"></div>
    <section id="harness-content">
      <input id="question" value="Harness legal question">
      <input id="selected-context" type="checkbox">
      <textarea id="fake-response">Harness answer</textarea>
      <input id="delay" value="0">
      <input id="gateway-error" type="checkbox">
      <button id="search">Search</button>
      <button id="cancel"></button>
      <button id="reset"></button>
      <button id="probe-retained-range"></button>
      <button id="capture-probe-range"></button>
      <button id="reuse-probe-range"></button>
      <button id="capture-production-shape-range"></button>
      <button id="reuse-production-shape-range"></button>
      <div id="answer"></div>
      <div id="state"></div>
      <div id="error"></div>
      <div id="office-diagnostic"></div>
      <div id="retained-range-probe-result"></div>
      <div id="two-gesture-probe-result"></div>
      <div id="production-shape-probe-result"></div>
      <div id="calls"></div>
    </section>
  `;
}

function controllableOffice() {
  let readyCallback: ((info: { readonly host?: unknown }) => void) | undefined;
  const office: WordHarnessOfficeReady = {
    wordHost: "Word",
    onReady(callback) {
      readyCallback = callback;
    },
  };
  return {
    office,
    signalReady(host: unknown) {
      if (!readyCallback) {
        throw new Error("Office readiness callback was not registered");
      }
      readyCallback({ host });
    },
  };
}

function fakeComposition() {
  const word = new FakeWordAdapter({
    snapshotId: "word-harness-selection",
    text: "Real document selection",
    characterCount: 23,
    context: "body",
    capturedAt: "2026-08-26T00:00:00.000Z",
  });
  const chat = new FakeChatGateway({ text: "Harness answer" });
  return {
    word,
    chat,
    controller: new TaskPaneController(word, chat),
    probeRetainedRange: vi.fn(async () => ({ phase: "probe-pass" as const })),
    captureProbeRange: vi.fn(async () => ({ phase: "two-gesture-captured" as const })),
    reuseProbeRange: vi.fn(async () => ({ phase: "two-gesture-pass" as const })),
    captureProductionShapeRange: vi.fn(async () => ({
      phase: "production-shape-captured" as const,
    })),
    reuseProductionShapeRange: vi.fn(async () => ({ phase: "production-shape-pass" as const })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

it("waits for Office readiness before composing or binding the Word harness", () => {
  renderWordHarness();
  const ready = controllableOffice();
  const createComposition = vi.fn(fakeComposition);

  bootstrapWordHarness(document, ready.office, createComposition);

  expect(document.getElementById("bootstrap-status")!.textContent).toBe("waiting-for-office");
  expect((document.getElementById("harness-content") as HTMLElement).hidden).toBe(true);
  expect(createComposition).not.toHaveBeenCalled();
});

it("fails closed with a generic controlled error outside Word", () => {
  renderWordHarness();
  const ready = controllableOffice();
  const createComposition = vi.fn(fakeComposition);
  bootstrapWordHarness(document, ready.office, createComposition);

  ready.signalReady("Excel");

  expect(document.getElementById("bootstrap-status")!.textContent).toBe("error");
  expect(document.getElementById("bootstrap-error")!.textContent).toBe("WORD_HOST_REQUIRED");
  expect((document.getElementById("harness-content") as HTMLElement).hidden).toBe(true);
  expect(createComposition).not.toHaveBeenCalled();
});

it("builds the Word-host composition from the real adapter, controller, and fake gateway", () => {
  const composition = createWordHarnessComposition();

  expect(composition.word).toBeInstanceOf(OfficeWordAdapter);
  expect(composition.controller).toBeInstanceOf(TaskPaneController);
  expect(composition.chat).toBeInstanceOf(FakeChatGateway);
  expect(composition.probeRetainedRange).toEqual(expect.any(Function));
  expect(composition.captureProbeRange).toEqual(expect.any(Function));
  expect(composition.reuseProbeRange).toEqual(expect.any(Function));
  expect(composition.captureProductionShapeRange).toEqual(expect.any(Function));
  expect(composition.reuseProductionShapeRange).toEqual(expect.any(Function));
});

it("runs the retained-range canary without controller, gateway, or document adapter calls", async () => {
  renderWordHarness();
  const ready = controllableOffice();
  const composition = fakeComposition();
  bootstrapWordHarness(document, ready.office, () => composition);
  ready.signalReady("Word");

  document.getElementById("probe-retained-range")!.click();

  await vi.waitFor(() =>
    expect(document.getElementById("retained-range-probe-result")!.textContent).toBe(
      '{"phase":"probe-pass"}'
    )
  );
  expect(composition.probeRetainedRange).toHaveBeenCalledOnce();
  expect(composition.chat.requests).toHaveLength(0);
  expect(composition.word.captureCalls).toBe(0);
  expect(composition.word.applyCalls).toHaveLength(0);
  expect(composition.word.releaseCalls).toHaveLength(0);
  expect(composition.controller.getState().kind).toBe("ready");
});

it("keeps two-gesture capture and reuse in separate clicks with correct button state", async () => {
  renderWordHarness();
  const ready = controllableOffice();
  const composition = fakeComposition();
  const capture = deferred<{ readonly phase: "two-gesture-captured" }>();
  const reuse = deferred<{ readonly phase: "two-gesture-pass" }>();
  composition.captureProbeRange.mockImplementationOnce(() => capture.promise);
  composition.reuseProbeRange.mockImplementationOnce(() => reuse.promise);
  bootstrapWordHarness(document, ready.office, () => composition);
  const captureButton = document.getElementById("capture-probe-range") as HTMLButtonElement;
  const reuseButton = document.getElementById("reuse-probe-range") as HTMLButtonElement;

  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  ready.signalReady("Word");
  expect(captureButton.disabled).toBe(false);
  expect(reuseButton.disabled).toBe(true);

  captureButton.click();
  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  expect(composition.captureProbeRange).toHaveBeenCalledOnce();
  expect(composition.reuseProbeRange).not.toHaveBeenCalled();

  capture.resolve({ phase: "two-gesture-captured" });
  await vi.waitFor(() => expect(reuseButton.disabled).toBe(false));
  expect(captureButton.disabled).toBe(false);
  expect(document.getElementById("two-gesture-probe-result")!.textContent).toBe(
    '{"phase":"two-gesture-captured"}'
  );
  expect(composition.reuseProbeRange).not.toHaveBeenCalled();

  reuseButton.click();
  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  expect(composition.reuseProbeRange).toHaveBeenCalledOnce();

  reuse.resolve({ phase: "two-gesture-pass" });
  await vi.waitFor(() => expect(captureButton.disabled).toBe(false));
  expect(reuseButton.disabled).toBe(true);
  expect(document.getElementById("two-gesture-probe-result")!.textContent).toBe(
    '{"phase":"two-gesture-pass"}'
  );
  expect(composition.chat.requests).toHaveLength(0);
  expect(composition.word.captureCalls).toBe(0);
  expect(composition.word.applyCalls).toHaveLength(0);
  expect(composition.word.releaseCalls).toHaveLength(0);
  expect(composition.controller.getState().kind).toBe("ready");
});

it("keeps production-shape Capture and Reuse in separate clicks with correct button state", async () => {
  renderWordHarness();
  const ready = controllableOffice();
  const composition = fakeComposition();
  const capture = deferred<{ readonly phase: "production-shape-captured" }>();
  const reuse = deferred<{ readonly phase: "production-shape-pass" }>();
  composition.captureProductionShapeRange.mockImplementationOnce(() => capture.promise);
  composition.reuseProductionShapeRange.mockImplementationOnce(() => reuse.promise);
  bootstrapWordHarness(document, ready.office, () => composition);
  const captureButton = document.getElementById(
    "capture-production-shape-range"
  ) as HTMLButtonElement;
  const reuseButton = document.getElementById("reuse-production-shape-range") as HTMLButtonElement;

  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  ready.signalReady("Word");
  expect(captureButton.disabled).toBe(false);
  expect(reuseButton.disabled).toBe(true);

  captureButton.click();
  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  expect(composition.captureProductionShapeRange).toHaveBeenCalledOnce();
  expect(composition.reuseProductionShapeRange).not.toHaveBeenCalled();

  capture.resolve({ phase: "production-shape-captured" });
  await vi.waitFor(() => expect(reuseButton.disabled).toBe(false));
  expect(captureButton.disabled).toBe(false);
  expect(document.getElementById("production-shape-probe-result")!.textContent).toBe(
    '{"phase":"production-shape-captured"}'
  );
  expect(composition.reuseProductionShapeRange).not.toHaveBeenCalled();

  reuseButton.click();
  expect(captureButton.disabled).toBe(true);
  expect(reuseButton.disabled).toBe(true);
  expect(composition.reuseProductionShapeRange).toHaveBeenCalledOnce();

  reuse.resolve({ phase: "production-shape-pass" });
  await vi.waitFor(() => expect(captureButton.disabled).toBe(false));
  expect(reuseButton.disabled).toBe(true);
  expect(document.getElementById("production-shape-probe-result")!.textContent).toBe(
    '{"phase":"production-shape-pass"}'
  );
  expect(composition.chat.requests).toHaveLength(0);
  expect(composition.word.captureCalls).toBe(0);
  expect(composition.word.applyCalls).toHaveLength(0);
  expect(composition.word.releaseCalls).toHaveLength(0);
  expect(composition.controller.getState().kind).toBe("ready");
});

it("renders only safe Office error metadata from the development runtime", async () => {
  renderWordHarness();
  const ready = controllableOffice();
  const composition = fakeComposition();
  bootstrapWordHarness(document, ready.office, (reportOfficeError) => {
    reportOfficeError({
      phase: "apply-mutation-sync",
      code: "GeneralException",
      name: "OfficeExtension.Error",
      errorLocation: "Range.insertText",
    });
    return composition;
  });

  ready.signalReady("Word");

  expect(document.getElementById("office-diagnostic")!.textContent).toBe(
    '{"phase":"apply-mutation-sync","code":"GeneralException","name":"OfficeExtension.Error","errorLocation":"Range.insertText"}'
  );
});

it("binds after Word readiness and renders user-controlled content only as plain text", async () => {
  renderWordHarness();
  const ready = controllableOffice();
  const composition = fakeComposition();
  bootstrapWordHarness(document, ready.office, () => composition);
  ready.signalReady("Word");

  const fakeResponse = document.getElementById("fake-response") as HTMLTextAreaElement;
  fakeResponse.value = '<b data-test="unsafe">Literal markup</b>';
  document.getElementById("search")!.click();

  await vi.waitFor(() =>
    expect(document.getElementById("answer")!.textContent).toBe(
      '<b data-test="unsafe">Literal markup</b>'
    )
  );
  expect(document.querySelector('[data-test="unsafe"]')).toBeNull();
  expect(composition.word.captureCalls).toBe(0);
  expect(document.getElementById("bootstrap-status")!.textContent).toBe("ready");
});

it("loads the real entrypoint without reading the Word host before Office readiness", async () => {
  renderWordHarness();
  vi.resetModules();

  let ready = false;
  let hostTypeReads = 0;
  let officeReadyCallback: ((info: { readonly host?: unknown }) => void) | undefined;
  const office = {
    onReady: vi.fn((callback: (info: { readonly host?: unknown }) => void) => {
      officeReadyCallback = callback;
    }),
  };
  Object.defineProperty(office, "HostType", {
    configurable: true,
    get() {
      hostTypeReads++;
      if (!ready) {
        throw new Error("Office.HostType was read before Office readiness");
      }
      return { Word: "Word" };
    },
  });
  vi.stubGlobal("Office", office);

  await expect(import("./wordHarness.js")).resolves.toBeDefined();
  expect(office.onReady).toHaveBeenCalledOnce();
  expect(hostTypeReads).toBe(0);
  expect(officeReadyCallback).toBeDefined();

  ready = true;
  officeReadyCallback!({ host: "Word" });

  expect(hostTypeReads).toBe(1);
  expect(document.getElementById("bootstrap-status")!.textContent).toBe("ready");
  expect((document.getElementById("harness-content") as HTMLElement).hidden).toBe(false);
});
