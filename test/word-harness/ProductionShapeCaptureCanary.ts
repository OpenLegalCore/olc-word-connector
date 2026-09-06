/* global Word */

export type ProductionShapeProbePhase =
  | "production-shape-capture-entry"
  | "production-shape-capture-queue"
  | "production-shape-capture-sync"
  | "production-shape-captured"
  | "production-shape-reuse-entry"
  | "production-shape-reuse-queue"
  | "production-shape-reuse-sync"
  | "production-shape-pass"
  | "production-shape-cleanup-queue"
  | "production-shape-cleanup-sync";

export interface ProductionShapeProbeResult {
  readonly phase: ProductionShapeProbePhase;
  readonly code?: string;
  readonly name?: string;
  readonly errorLocation?: string;
}

type OfficeErrorLike = {
  readonly code?: unknown;
  readonly name?: unknown;
  readonly debugInfo?: {
    readonly errorLocation?: unknown;
  };
};

class ClassifiedProductionShapeFailure {
  constructor(
    readonly phase: ProductionShapeProbePhase,
    readonly cause: unknown
  ) {}
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 256) : undefined;
}

function safeFailure(error: unknown, phase: ProductionShapeProbePhase): ProductionShapeProbeResult {
  const officeError =
    typeof error === "object" && error !== null ? (error as OfficeErrorLike) : undefined;

  return {
    phase,
    code: safeString(officeError?.code),
    name: safeString(officeError?.name),
    errorLocation: safeString(officeError?.debugInfo?.errorLocation),
  };
}

function classifiedFailure(
  error: unknown,
  fallback: ProductionShapeProbePhase
): ProductionShapeProbeResult {
  return error instanceof ClassifiedProductionShapeFailure
    ? safeFailure(error.cause, error.phase)
    : safeFailure(error, fallback);
}

export class ProductionShapeCaptureCanary {
  private retainedRange?: Word.Range;

  async captureForLaterReuse(): Promise<ProductionShapeProbeResult | undefined> {
    const previousRange = this.retainedRange;
    this.retainedRange = undefined;
    if (previousRange) {
      await this.cleanup(previousRange);
    }

    let exactRange: Word.Range | undefined;
    let callbackStarted = false;
    let captureQueueCompleted = false;
    let hasNonEmptySelection = false;

    try {
      await Word.run(async (context) => {
        callbackStarted = true;
        try {
          const selectedRange = context.document.getSelection();
          exactRange = selectedRange;
          context.trackedObjects.add(selectedRange);

          const body = selectedRange.parentBody;
          const parentTable = selectedRange.parentTableOrNullObject;
          const parentTableCell = selectedRange.parentTableCellOrNullObject;
          const tables = selectedRange.tables;
          const inlinePictures = selectedRange.inlinePictures;
          const ooxml = selectedRange.getOoxml();

          selectedRange.load(["text", "isEmpty"]);
          body.load("type");
          parentTable.load("isNullObject");
          parentTableCell.load("isNullObject");
          tables.load("items");
          inlinePictures.load("items");
          captureQueueCompleted = true;

          try {
            await context.sync();
          } catch (error) {
            throw new ClassifiedProductionShapeFailure("production-shape-capture-sync", error);
          }

          hasNonEmptySelection = !selectedRange.isEmpty && selectedRange.text.trim().length > 0;
          void body.type;
          void parentTable.isNullObject;
          void parentTableCell.isNullObject;
          void tables.items;
          void inlinePictures.items;
          void ooxml.value;
        } catch (error) {
          if (error instanceof ClassifiedProductionShapeFailure) {
            throw error;
          }
          throw new ClassifiedProductionShapeFailure(
            captureQueueCompleted
              ? "production-shape-capture-sync"
              : "production-shape-capture-queue",
            error
          );
        }
      });
    } catch (error) {
      const primaryResult = classifiedFailure(
        error,
        !callbackStarted
          ? "production-shape-capture-entry"
          : captureQueueCompleted
            ? "production-shape-capture-sync"
            : "production-shape-capture-queue"
      );
      if (exactRange) {
        await this.cleanup(exactRange);
      }
      return primaryResult;
    }

    if (!exactRange || !hasNonEmptySelection) {
      if (exactRange) {
        await this.cleanup(exactRange);
      }
      return undefined;
    }

    this.retainedRange = exactRange;
    return { phase: "production-shape-captured" };
  }

  async reuseCapturedRange(): Promise<ProductionShapeProbeResult | undefined> {
    const exactRange = this.retainedRange;
    if (!exactRange) {
      return undefined;
    }
    this.retainedRange = undefined;

    let callbackStarted = false;
    let validationLoadQueued = false;
    let primaryResult: ProductionShapeProbeResult;
    try {
      await Word.run(exactRange, async (context) => {
        callbackStarted = true;
        try {
          exactRange.load(["text", "isEmpty"]);
          validationLoadQueued = true;
        } catch (error) {
          throw new ClassifiedProductionShapeFailure("production-shape-reuse-queue", error);
        }
        try {
          await context.sync();
        } catch (error) {
          throw new ClassifiedProductionShapeFailure("production-shape-reuse-sync", error);
        }
      });
      primaryResult = { phase: "production-shape-pass" };
    } catch (error) {
      primaryResult = classifiedFailure(
        error,
        !callbackStarted
          ? "production-shape-reuse-entry"
          : validationLoadQueued
            ? "production-shape-reuse-sync"
            : "production-shape-reuse-queue"
      );
    }

    const cleanupResult = await this.cleanup(exactRange);
    return primaryResult.phase === "production-shape-pass" && cleanupResult
      ? cleanupResult
      : primaryResult;
  }

  private async cleanup(range: Word.Range): Promise<ProductionShapeProbeResult | undefined> {
    let untrackQueued = false;
    try {
      await Word.run(range, async (context) => {
        try {
          range.untrack();
          untrackQueued = true;
        } catch (error) {
          throw new ClassifiedProductionShapeFailure("production-shape-cleanup-queue", error);
        }
        try {
          await context.sync();
        } catch (error) {
          throw new ClassifiedProductionShapeFailure("production-shape-cleanup-sync", error);
        }
      });
      return undefined;
    } catch (error) {
      return classifiedFailure(
        error,
        untrackQueued ? "production-shape-cleanup-sync" : "production-shape-cleanup-queue"
      );
    }
  }
}
