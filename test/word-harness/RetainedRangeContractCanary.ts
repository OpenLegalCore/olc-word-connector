/* global Word */

export type RetainedRangeProbePhase =
  | "probe-capture-sync"
  | "probe-reuse-run-entry"
  | "probe-reuse-queue"
  | "probe-reuse-sync"
  | "probe-cleanup-untrack-queue"
  | "probe-cleanup-untrack-sync"
  | "probe-pass";

export interface RetainedRangeProbeResult {
  readonly phase: RetainedRangeProbePhase;
  readonly code?: string;
  readonly name?: string;
  readonly errorLocation?: string;
}

export interface TwoGestureCaptureResult {
  readonly phase: "two-gesture-captured";
}

export type TwoGestureProbePhase =
  | "two-gesture-reuse-run-entry"
  | "two-gesture-reuse-queue"
  | "two-gesture-reuse-sync"
  | "two-gesture-cleanup-untrack-queue"
  | "two-gesture-cleanup-untrack-sync"
  | "two-gesture-pass";

export interface TwoGestureProbeResult {
  readonly phase: TwoGestureProbePhase;
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

class ClassifiedProbeFailure {
  constructor(
    readonly phase: RetainedRangeProbePhase,
    readonly cause: unknown
  ) {}
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 256) : undefined;
}

function safeFailure(error: unknown, phase: RetainedRangeProbePhase): RetainedRangeProbeResult {
  const officeError =
    typeof error === "object" && error !== null ? (error as OfficeErrorLike) : undefined;

  return {
    phase,
    code: safeString(officeError?.code),
    name: safeString(officeError?.name),
    errorLocation: safeString(officeError?.debugInfo?.errorLocation),
  };
}

function classifiedFailure(error: unknown, fallback: RetainedRangeProbePhase) {
  return error instanceof ClassifiedProbeFailure
    ? safeFailure(error.cause, error.phase)
    : safeFailure(error, fallback);
}

function twoGestureFailure(error: unknown, phase: TwoGestureProbePhase): TwoGestureProbeResult {
  const officeError =
    typeof error === "object" && error !== null ? (error as OfficeErrorLike) : undefined;

  return {
    phase,
    code: safeString(officeError?.code),
    name: safeString(officeError?.name),
    errorLocation: safeString(officeError?.debugInfo?.errorLocation),
  };
}

export class RetainedRangeContractCanary {
  private twoGestureRange?: Word.Range;

  async probe(): Promise<RetainedRangeProbeResult> {
    let retainedRange: Word.Range | undefined;

    try {
      retainedRange = await Word.run(async (context) => {
        const selectedRange = context.document.getSelection();
        retainedRange = selectedRange;
        context.trackedObjects.add(selectedRange);
        selectedRange.load("isEmpty");
        try {
          await context.sync();
        } catch (error) {
          throw new ClassifiedProbeFailure("probe-capture-sync", error);
        }
        return selectedRange;
      });
    } catch (error) {
      const primaryResult = classifiedFailure(error, "probe-capture-sync");
      if (retainedRange) {
        await this.cleanup(retainedRange);
      }
      return primaryResult;
    }
    if (!retainedRange) {
      return { phase: "probe-capture-sync" };
    }
    const exactRange = retainedRange;

    let primaryResult: RetainedRangeProbeResult;
    let reuseCallbackStarted = false;
    try {
      await Word.run(exactRange, async (context) => {
        reuseCallbackStarted = true;
        try {
          exactRange.load("isEmpty");
        } catch (error) {
          throw new ClassifiedProbeFailure("probe-reuse-queue", error);
        }
        try {
          await context.sync();
        } catch (error) {
          throw new ClassifiedProbeFailure("probe-reuse-sync", error);
        }
      });
      primaryResult = { phase: "probe-pass" };
    } catch (error) {
      primaryResult = classifiedFailure(
        error,
        reuseCallbackStarted ? "probe-reuse-queue" : "probe-reuse-run-entry"
      );
    }

    const cleanupResult = await this.cleanup(exactRange);
    return primaryResult.phase === "probe-pass" && cleanupResult ? cleanupResult : primaryResult;
  }

  async captureForLaterReuse(): Promise<TwoGestureCaptureResult | undefined> {
    const previousRange = this.twoGestureRange;
    this.twoGestureRange = undefined;
    if (previousRange) {
      await this.cleanupTwoGestureRange(previousRange);
    }

    let capturedRange: Word.Range | undefined;
    try {
      capturedRange = await Word.run(async (context) => {
        const selectedRange = context.document.getSelection();
        capturedRange = selectedRange;
        context.trackedObjects.add(selectedRange);
        selectedRange.load("isEmpty");
        await context.sync();
        return selectedRange;
      });
    } catch {
      if (capturedRange) {
        await this.cleanupTwoGestureRange(capturedRange);
      }
      return undefined;
    }

    if (capturedRange.isEmpty) {
      await this.cleanupTwoGestureRange(capturedRange);
      return undefined;
    }

    this.twoGestureRange = capturedRange;
    return { phase: "two-gesture-captured" };
  }

  async reuseCapturedRange(): Promise<TwoGestureProbeResult | undefined> {
    const exactRange = this.twoGestureRange;
    if (!exactRange) {
      return undefined;
    }
    this.twoGestureRange = undefined;

    let callbackStarted = false;
    let loadQueued = false;
    let primaryResult: TwoGestureProbeResult;
    try {
      await Word.run(exactRange, async (context) => {
        callbackStarted = true;
        exactRange.load("isEmpty");
        loadQueued = true;
        await context.sync();
      });
      primaryResult = { phase: "two-gesture-pass" };
    } catch (error) {
      const phase: TwoGestureProbePhase = !callbackStarted
        ? "two-gesture-reuse-run-entry"
        : loadQueued
          ? "two-gesture-reuse-sync"
          : "two-gesture-reuse-queue";
      primaryResult = twoGestureFailure(error, phase);
    }

    const cleanupResult = await this.cleanupTwoGestureRange(exactRange);
    return primaryResult.phase === "two-gesture-pass" && cleanupResult
      ? cleanupResult
      : primaryResult;
  }

  private async cleanup(range: Word.Range): Promise<RetainedRangeProbeResult | undefined> {
    let untrackQueued = false;
    try {
      await Word.run(range, async (context) => {
        try {
          range.untrack();
          untrackQueued = true;
        } catch (error) {
          throw new ClassifiedProbeFailure("probe-cleanup-untrack-queue", error);
        }
        try {
          await context.sync();
        } catch (error) {
          throw new ClassifiedProbeFailure("probe-cleanup-untrack-sync", error);
        }
      });
      return undefined;
    } catch (error) {
      return classifiedFailure(
        error,
        untrackQueued ? "probe-cleanup-untrack-sync" : "probe-cleanup-untrack-queue"
      );
    }
  }

  private async cleanupTwoGestureRange(
    range: Word.Range
  ): Promise<TwoGestureProbeResult | undefined> {
    let untrackQueued = false;
    try {
      await Word.run(range, async (context) => {
        range.untrack();
        untrackQueued = true;
        await context.sync();
      });
      return undefined;
    } catch (error) {
      return twoGestureFailure(
        error,
        untrackQueued ? "two-gesture-cleanup-untrack-sync" : "two-gesture-cleanup-untrack-queue"
      );
    }
  }
}
