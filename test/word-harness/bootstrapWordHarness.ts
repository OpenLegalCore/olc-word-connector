import { TaskPaneController } from "../../src/app/TaskPaneController";
import type { WordAdapter } from "../../src/office/WordAdapter";
import { FakeChatGateway } from "../fakes/FakeChatGateway";
import { MutableOfficeWordAdapter } from "../office/MutableOfficeWordAdapter";
import { bindControllerHarness } from "../harness/bindControllerHarness";
import { WordHarnessOfficeRuntime, type SafeOfficeErrorMetadata } from "./WordHarnessOfficeRuntime";
import {
  ProductionShapeCaptureCanary,
  type ProductionShapeProbeResult,
} from "./ProductionShapeCaptureCanary";
import {
  RetainedRangeContractCanary,
  type RetainedRangeProbeResult,
  type TwoGestureCaptureResult,
  type TwoGestureProbeResult,
} from "./RetainedRangeContractCanary";

export interface WordHarnessOfficeReady {
  readonly wordHost: unknown;
  onReady(callback: (info: { readonly host?: unknown }) => void): void;
}

export interface WordHarnessComposition {
  readonly word: MutableOfficeWordAdapter;
  readonly chat: FakeChatGateway;
  readonly controller: TaskPaneController;
  readonly probeRetainedRange: () => Promise<RetainedRangeProbeResult>;
  readonly captureProbeRange: () => Promise<TwoGestureCaptureResult | undefined>;
  readonly reuseProbeRange: () => Promise<TwoGestureProbeResult | undefined>;
  readonly captureProductionShapeRange: () => Promise<ProductionShapeProbeResult | undefined>;
  readonly reuseProductionShapeRange: () => Promise<ProductionShapeProbeResult | undefined>;
}

interface WordHarnessBindingComposition {
  readonly chat: FakeChatGateway;
  readonly controller: TaskPaneController;
  readonly probeRetainedRange: () => Promise<RetainedRangeProbeResult>;
  readonly captureProbeRange: () => Promise<TwoGestureCaptureResult | undefined>;
  readonly reuseProbeRange: () => Promise<TwoGestureProbeResult | undefined>;
  readonly captureProductionShapeRange: () => Promise<ProductionShapeProbeResult | undefined>;
  readonly reuseProductionShapeRange: () => Promise<ProductionShapeProbeResult | undefined>;
}

type OfficeDiagnosticReporter = (metadata: SafeOfficeErrorMetadata) => void;

function element<T extends HTMLElement>(root: Document, id: string): T {
  const value = root.getElementById(id);
  if (!value) {
    throw new Error(`Word harness element is missing: ${id}`);
  }
  return value as T;
}

export function createWordHarnessComposition(
  reportOfficeError: OfficeDiagnosticReporter = () => undefined
): WordHarnessComposition {
  const runtime = new WordHarnessOfficeRuntime(reportOfficeError);
  const retainedRangeCanary = new RetainedRangeContractCanary();
  const productionShapeCanary = new ProductionShapeCaptureCanary();
  const word = new MutableOfficeWordAdapter(runtime);
  const diagnosticWord: WordAdapter = {
    captureSelection: () => word.captureSelection(),
    releaseSelection: (snapshot) =>
      runtime.withRetainedOperation("cleanup", () => word.releaseSelection(snapshot)),
  };
  const chat = new FakeChatGateway({ text: "Synthetic legal-source answer." });
  return {
    word,
    chat,
    controller: new TaskPaneController(diagnosticWord, chat),
    probeRetainedRange: () => retainedRangeCanary.probe(),
    captureProbeRange: () => retainedRangeCanary.captureForLaterReuse(),
    reuseProbeRange: () => retainedRangeCanary.reuseCapturedRange(),
    captureProductionShapeRange: () => productionShapeCanary.captureForLaterReuse(),
    reuseProductionShapeRange: () => productionShapeCanary.reuseCapturedRange(),
  };
}

export function bootstrapWordHarness(
  root: Document,
  office: WordHarnessOfficeReady,
  createComposition: (
    reportOfficeError: OfficeDiagnosticReporter
  ) => WordHarnessBindingComposition = createWordHarnessComposition
): void {
  const bootstrapStatus = element<HTMLElement>(root, "bootstrap-status");
  const bootstrapError = element<HTMLElement>(root, "bootstrap-error");
  const harnessContent = element<HTMLElement>(root, "harness-content");
  const officeDiagnostic = element<HTMLElement>(root, "office-diagnostic");
  const probeRetainedRange = element<HTMLButtonElement>(root, "probe-retained-range");
  const retainedRangeProbeResult = element<HTMLElement>(root, "retained-range-probe-result");
  const captureProbeRange = element<HTMLButtonElement>(root, "capture-probe-range");
  const reuseProbeRange = element<HTMLButtonElement>(root, "reuse-probe-range");
  const twoGestureProbeResult = element<HTMLElement>(root, "two-gesture-probe-result");
  const captureProductionShapeRange = element<HTMLButtonElement>(
    root,
    "capture-production-shape-range"
  );
  const reuseProductionShapeRange = element<HTMLButtonElement>(
    root,
    "reuse-production-shape-range"
  );
  const productionShapeProbeResult = element<HTMLElement>(root, "production-shape-probe-result");

  bootstrapStatus.textContent = "waiting-for-office";
  bootstrapError.textContent = "";
  officeDiagnostic.textContent = "";
  retainedRangeProbeResult.textContent = "";
  twoGestureProbeResult.textContent = "";
  productionShapeProbeResult.textContent = "";
  captureProbeRange.disabled = true;
  reuseProbeRange.disabled = true;
  captureProductionShapeRange.disabled = true;
  reuseProductionShapeRange.disabled = true;
  harnessContent.hidden = true;

  office.onReady((info) => {
    if (info.host !== office.wordHost) {
      bootstrapStatus.textContent = "error";
      bootstrapError.textContent = "WORD_HOST_REQUIRED";
      return;
    }

    const composition = createComposition((metadata) => {
      if (officeDiagnostic.textContent === "") {
        officeDiagnostic.textContent = JSON.stringify(metadata);
      }
    });
    bindControllerHarness(root, composition.controller, composition.chat, {
      describeCalls: () => [`complete: ${composition.chat.requests.length}`],
      prepareSearch: () => {
        officeDiagnostic.textContent = "";
      },
    });
    probeRetainedRange.addEventListener("click", () => {
      probeRetainedRange.disabled = true;
      retainedRangeProbeResult.textContent = "";
      void composition
        .probeRetainedRange()
        .then((result) => {
          retainedRangeProbeResult.textContent = JSON.stringify(result);
        })
        .finally(() => {
          probeRetainedRange.disabled = false;
        });
    });
    captureProbeRange.addEventListener("click", () => {
      captureProbeRange.disabled = true;
      reuseProbeRange.disabled = true;
      twoGestureProbeResult.textContent = "";
      void composition
        .captureProbeRange()
        .then((result) => {
          if (result) {
            twoGestureProbeResult.textContent = JSON.stringify(result);
            reuseProbeRange.disabled = false;
          }
        })
        .finally(() => {
          captureProbeRange.disabled = false;
        });
    });
    reuseProbeRange.addEventListener("click", () => {
      captureProbeRange.disabled = true;
      reuseProbeRange.disabled = true;
      twoGestureProbeResult.textContent = "";
      void composition
        .reuseProbeRange()
        .then((result) => {
          if (result) {
            twoGestureProbeResult.textContent = JSON.stringify(result);
          }
        })
        .finally(() => {
          captureProbeRange.disabled = false;
          reuseProbeRange.disabled = true;
        });
    });
    captureProductionShapeRange.addEventListener("click", () => {
      captureProductionShapeRange.disabled = true;
      reuseProductionShapeRange.disabled = true;
      productionShapeProbeResult.textContent = "";
      void composition
        .captureProductionShapeRange()
        .then((result) => {
          if (result) {
            productionShapeProbeResult.textContent = JSON.stringify(result);
            reuseProductionShapeRange.disabled = result.phase !== "production-shape-captured";
          }
        })
        .finally(() => {
          captureProductionShapeRange.disabled = false;
        });
    });
    reuseProductionShapeRange.addEventListener("click", () => {
      captureProductionShapeRange.disabled = true;
      reuseProductionShapeRange.disabled = true;
      productionShapeProbeResult.textContent = "";
      void composition
        .reuseProductionShapeRange()
        .then((result) => {
          if (result) {
            productionShapeProbeResult.textContent = JSON.stringify(result);
          }
        })
        .finally(() => {
          captureProductionShapeRange.disabled = false;
          reuseProductionShapeRange.disabled = true;
        });
    });
    captureProbeRange.disabled = false;
    reuseProbeRange.disabled = true;
    captureProductionShapeRange.disabled = false;
    reuseProductionShapeRange.disabled = true;
    bootstrapStatus.textContent = "ready";
    harnessContent.hidden = false;
  });
}
