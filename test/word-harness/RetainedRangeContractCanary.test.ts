import { afterEach, expect, it, vi } from "vitest";

import {
  RetainedRangeContractCanary,
  type RetainedRangeProbeResult,
} from "./RetainedRangeContractCanary";

type ContextStub = {
  readonly document: { getSelection: ReturnType<typeof vi.fn> };
  readonly trackedObjects: { add: ReturnType<typeof vi.fn> };
  readonly sync: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function officeError(location?: string) {
  return {
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    message: "private selected document text",
    debugInfo: {
      errorLocation: location,
      statement: "private selected document text",
    },
  };
}

function createRuntime(
  options: {
    readonly failCaptureSync?: unknown;
    readonly failReuseQueue?: unknown;
    readonly failReuseRunEntry?: unknown;
    readonly failReuseSync?: unknown;
    readonly failCleanupQueue?: unknown;
    readonly failCleanupSync?: unknown;
  } = {}
) {
  let trackingQueued = false;
  let trackingCommitted = false;
  let loadCalls = 0;
  const events: string[] = [];
  const range = {
    isEmpty: false,
    load: vi.fn(() => {
      loadCalls++;
      events.push(`load-${loadCalls}`);
      if (loadCalls === 2 && options.failReuseQueue) {
        throw options.failReuseQueue;
      }
    }),
    untrack: vi.fn(() => {
      events.push("untrack");
      if (options.failCleanupQueue) {
        throw options.failCleanupQueue;
      }
    }),
  } as unknown as Word.Range;
  const captureContext: ContextStub = {
    document: { getSelection: vi.fn(() => range) },
    trackedObjects: {
      add: vi.fn((trackedRange: Word.Range) => {
        expect(trackedRange).toBe(range);
        trackingQueued = true;
        events.push("track");
      }),
    },
    sync: vi.fn(async () => {
      events.push("capture-sync");
      trackingCommitted = trackingQueued;
      if (options.failCaptureSync) {
        throw options.failCaptureSync;
      }
    }),
  };
  const reuseContext = {
    sync: vi.fn(async () => {
      events.push("reuse-sync");
      if (options.failReuseSync) {
        throw options.failReuseSync;
      }
    }),
  } as unknown as Word.RequestContext;
  const cleanupContext = {
    sync: vi.fn(async () => {
      events.push("cleanup-sync");
      if (options.failCleanupSync) {
        throw options.failCleanupSync;
      }
    }),
  } as unknown as Word.RequestContext;
  let retainedRuns = 0;
  const wordRun = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) {
      const callback = args[0] as (context: Word.RequestContext) => Promise<unknown>;
      return callback(captureContext as unknown as Word.RequestContext);
    }

    expect(args[0]).toBe(range);
    expect(trackingCommitted).toBe(true);
    retainedRuns++;
    if (retainedRuns === 1 && options.failReuseRunEntry) {
      throw options.failReuseRunEntry;
    }
    const callback = args[1] as (context: Word.RequestContext) => Promise<unknown>;
    return callback(retainedRuns === 1 ? reuseContext : cleanupContext);
  });
  vi.stubGlobal("Word", { run: wordRun });

  return { events, range, wordRun, captureContext, reuseContext, cleanupContext };
}

function expectContentFree(result: {
  readonly phase: string;
  readonly code?: string;
  readonly name?: string;
  readonly errorLocation?: string;
}): void {
  expect(result).toEqual({
    phase: result.phase,
    code: result.code,
    name: result.name,
    errorLocation: result.errorLocation,
  });
  expect(JSON.stringify(result)).not.toContain("private selected document text");
}

it("tracks the exact selection through the first sync and reuses that proxy in Word.run", async () => {
  const runtime = createRuntime();

  await expect(new RetainedRangeContractCanary().probe()).resolves.toEqual({
    phase: "probe-pass",
  });

  expect(runtime.wordRun).toHaveBeenCalledTimes(3);
  expect(runtime.captureContext.document.getSelection).toHaveBeenCalledOnce();
  expect(runtime.captureContext.trackedObjects.add).toHaveBeenCalledWith(runtime.range);
  expect(runtime.wordRun.mock.calls[1][0]).toBe(runtime.range);
  expect(runtime.wordRun.mock.calls[2][0]).toBe(runtime.range);
  expect(runtime.range.load).toHaveBeenNthCalledWith(1, "isEmpty");
  expect(runtime.range.load).toHaveBeenNthCalledWith(2, "isEmpty");
  expect(runtime.range.untrack).toHaveBeenCalledOnce();
  expect(runtime.events).toEqual([
    "track",
    "load-1",
    "capture-sync",
    "load-2",
    "reuse-sync",
    "untrack",
    "cleanup-sync",
  ]);
  expect("insertText" in (runtime.range as object)).toBe(false);
  expect("search" in (runtime.range as object)).toBe(false);
});

it.each([
  ["queue", { failReuseQueue: officeError("Range.load") }, "probe-reuse-queue"],
  ["sync", { failReuseSync: officeError("RequestContext.sync") }, "probe-reuse-sync"],
  ["run entry", { failReuseRunEntry: officeError("Word.run") }, "probe-reuse-run-entry"],
] as const)(
  "classifies a retained-range reuse %s failure without content",
  async (_label, options, phase) => {
    createRuntime(options);

    const result = await new RetainedRangeContractCanary().probe();

    expect(result).toEqual({
      phase,
      code: "InvalidObjectPath",
      name: "RichApi.Error",
      errorLocation:
        phase === "probe-reuse-queue"
          ? "Range.load"
          : phase === "probe-reuse-sync"
            ? "RequestContext.sync"
            : "Word.run",
    });
    expectContentFree(result);
  }
);

it("keeps the primary reuse failure when best-effort cleanup also fails", async () => {
  createRuntime({
    failReuseQueue: officeError("Range.load"),
    failCleanupQueue: officeError("Range.untrack"),
  });

  const result = await new RetainedRangeContractCanary().probe();

  expect(result).toEqual({
    phase: "probe-reuse-queue",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: "Range.load",
  });
  expectContentFree(result);
});

it("keeps the primary capture-sync failure when best-effort cleanup also fails", async () => {
  createRuntime({
    failCaptureSync: officeError("RequestContext.sync"),
    failCleanupQueue: officeError("Range.untrack"),
  });

  const result = await new RetainedRangeContractCanary().probe();

  expect(result).toEqual({
    phase: "probe-capture-sync",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: "RequestContext.sync",
  });
  expectContentFree(result);
});

it.each([
  ["queue", { failCleanupQueue: officeError("Range.untrack") }, "probe-cleanup-untrack-queue"],
  ["sync", { failCleanupSync: officeError("RequestContext.sync") }, "probe-cleanup-untrack-sync"],
] as const)(
  "reports a cleanup %s failure only after the primary probe passes",
  async (_label, options, phase) => {
    createRuntime(options);

    const result = await new RetainedRangeContractCanary().probe();

    expect(result).toMatchObject({
      phase,
      code: "InvalidObjectPath",
      name: "RichApi.Error",
    });
    expectContentFree(result);
  }
);

it("captures and reuses the exact proxy through two separate exported invocations", async () => {
  const runtime = createRuntime();
  const canary = new RetainedRangeContractCanary();

  await expect(canary.captureForLaterReuse()).resolves.toEqual({
    phase: "two-gesture-captured",
  });

  expect(runtime.wordRun).toHaveBeenCalledOnce();
  expect(runtime.captureContext.trackedObjects.add).toHaveBeenCalledWith(runtime.range);
  expect(runtime.range.load).toHaveBeenCalledOnce();
  expect(runtime.range.untrack).not.toHaveBeenCalled();

  await expect(canary.reuseCapturedRange()).resolves.toEqual({
    phase: "two-gesture-pass",
  });

  expect(runtime.wordRun).toHaveBeenCalledTimes(3);
  expect(runtime.wordRun.mock.calls[1][0]).toBe(runtime.range);
  expect(runtime.wordRun.mock.calls[2][0]).toBe(runtime.range);
  expect(runtime.events).toEqual([
    "track",
    "load-1",
    "capture-sync",
    "load-2",
    "reuse-sync",
    "untrack",
    "cleanup-sync",
  ]);
  expect("insertText" in (runtime.range as object)).toBe(false);
  expect("search" in (runtime.range as object)).toBe(false);
});

it.each([
  ["queue", { failReuseQueue: officeError("Range.load") }, "two-gesture-reuse-queue"],
  ["sync", { failReuseSync: officeError("RequestContext.sync") }, "two-gesture-reuse-sync"],
  ["run entry", { failReuseRunEntry: officeError("Word.run") }, "two-gesture-reuse-run-entry"],
] as const)(
  "classifies a two-gesture reuse %s failure without content",
  async (_label, options, phase) => {
    createRuntime(options);
    const canary = new RetainedRangeContractCanary();
    await canary.captureForLaterReuse();

    const result = await canary.reuseCapturedRange();

    expect(result).toEqual({
      phase,
      code: "InvalidObjectPath",
      name: "RichApi.Error",
      errorLocation:
        phase === "two-gesture-reuse-queue"
          ? "Range.load"
          : phase === "two-gesture-reuse-sync"
            ? "RequestContext.sync"
            : "Word.run",
    });
    expectContentFree(result!);
  }
);

it("does not let two-gesture cleanup replace the primary reuse failure", async () => {
  createRuntime({
    failReuseQueue: officeError("Range.load"),
    failCleanupQueue: officeError("Range.untrack"),
  });
  const canary = new RetainedRangeContractCanary();
  await canary.captureForLaterReuse();

  const result = await canary.reuseCapturedRange();

  expect(result).toEqual({
    phase: "two-gesture-reuse-queue",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: "Range.load",
  });
  expectContentFree(result!);
});

it.each([
  [
    "queue",
    { failCleanupQueue: officeError("Range.untrack") },
    "two-gesture-cleanup-untrack-queue",
  ],
  [
    "sync",
    { failCleanupSync: officeError("RequestContext.sync") },
    "two-gesture-cleanup-untrack-sync",
  ],
] as const)(
  "reports a two-gesture cleanup %s failure only after reuse passes",
  async (_label, options, phase) => {
    createRuntime(options);
    const canary = new RetainedRangeContractCanary();
    await canary.captureForLaterReuse();

    const result = await canary.reuseCapturedRange();

    expect(result).toMatchObject({
      phase,
      code: "InvalidObjectPath",
      name: "RichApi.Error",
    });
    expectContentFree(result!);
  }
);

it("best-effort cleans the previous capture and retains only the newest exact proxy", async () => {
  const events: string[] = [];
  const ranges = ["first", "second"].map((label) => ({
    isEmpty: false,
    load: vi.fn(() => events.push(`${label}-load`)),
    untrack: vi.fn(() => events.push(`${label}-untrack`)),
  })) as unknown as [Word.Range, Word.Range];
  let captureIndex = 0;
  const retainedRuns: Word.Range[] = [];
  const wordRun = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) {
      const range = ranges[captureIndex++];
      const callback = args[0] as (context: Word.RequestContext) => Promise<unknown>;
      return callback({
        document: { getSelection: () => range },
        trackedObjects: { add: (tracked: Word.Range) => expect(tracked).toBe(range) },
        sync: vi.fn(async () => events.push("capture-sync")),
      } as unknown as Word.RequestContext);
    }

    const range = args[0] as Word.Range;
    retainedRuns.push(range);
    const callback = args[1] as (context: Word.RequestContext) => Promise<unknown>;
    return callback({
      sync: vi.fn(async () => events.push("retained-sync")),
    } as unknown as Word.RequestContext);
  });
  vi.stubGlobal("Word", { run: wordRun });
  const canary = new RetainedRangeContractCanary();

  await expect(canary.captureForLaterReuse()).resolves.toEqual({
    phase: "two-gesture-captured",
  });
  await expect(canary.captureForLaterReuse()).resolves.toEqual({
    phase: "two-gesture-captured",
  });
  await expect(canary.reuseCapturedRange()).resolves.toEqual({
    phase: "two-gesture-pass",
  });

  expect(retainedRuns).toEqual([ranges[0], ranges[1], ranges[1]]);
  expect(ranges[0].untrack).toHaveBeenCalledOnce();
  expect(ranges[1].untrack).toHaveBeenCalledOnce();
  expect(ranges[0].load).toHaveBeenCalledOnce();
  expect(ranges[1].load).toHaveBeenCalledTimes(2);
  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
});

it("rejects an empty capture without retaining a proxy or exposing content", async () => {
  const runtime = createRuntime();
  (runtime.range as unknown as { isEmpty: boolean }).isEmpty = true;
  const canary = new RetainedRangeContractCanary();

  await expect(canary.captureForLaterReuse()).resolves.toBeUndefined();

  expect(runtime.range.untrack).toHaveBeenCalledOnce();
  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
  expect(runtime.wordRun).toHaveBeenCalledTimes(2);
});
