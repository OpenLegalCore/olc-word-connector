import { readFileSync } from "node:fs";

import { afterEach, expect, it, vi } from "vitest";

import {
  ProductionShapeCaptureCanary,
  type ProductionShapeProbeResult,
} from "./ProductionShapeCaptureCanary";

afterEach(() => {
  vi.unstubAllGlobals();
});

function officeError(location: string) {
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

function expectContentFree(result: ProductionShapeProbeResult): void {
  expect(result).toEqual({
    phase: result.phase,
    code: result.code,
    name: result.name,
    errorLocation: result.errorLocation,
  });
  expect(JSON.stringify(result)).not.toContain("private selected document text");
}

function createRuntime(
  options: {
    readonly empty?: boolean;
    readonly failCaptureEntry?: unknown;
    readonly failCaptureQueue?: unknown;
    readonly failCaptureSync?: unknown;
    readonly failReuseEntry?: unknown;
    readonly failReuseQueue?: unknown;
    readonly failReuseSync?: unknown;
    readonly failCleanupQueue?: unknown;
    readonly failCleanupSync?: unknown;
  } = {}
) {
  const events: string[] = [];
  let rangeLoadCalls = 0;
  let trackingQueued = false;
  let trackingCommitted = false;
  let reuseEntryAttempted = false;
  let cleanupQueuedForRun = false;

  const body = {
    type: "MainDoc",
    load: vi.fn((property: string) => events.push(`body-load:${property}`)),
  } as unknown as Word.Body;
  const parentTable = {
    isNullObject: true,
    load: vi.fn((property: string) => events.push(`parent-table-load:${property}`)),
  } as unknown as Word.Table;
  const parentTableCell = {
    isNullObject: true,
    load: vi.fn((property: string) => events.push(`parent-cell-load:${property}`)),
  } as unknown as Word.TableCell;
  const tables = {
    items: [],
    load: vi.fn((property: string) => events.push(`tables-load:${property}`)),
  } as unknown as Word.TableCollection;
  const inlinePictures = {
    items: [],
    load: vi.fn((property: string) => events.push(`pictures-load:${property}`)),
  } as unknown as Word.InlinePictureCollection;
  const ooxml = { value: "private selected document OOXML" };

  const range = {
    text: options.empty ? "   " : "private selected document text",
    isEmpty: options.empty ?? false,
    get parentBody() {
      events.push("derive-parent-body");
      return body;
    },
    get parentTableOrNullObject() {
      events.push("derive-parent-table");
      return parentTable;
    },
    get parentTableCellOrNullObject() {
      events.push("derive-parent-cell");
      return parentTableCell;
    },
    get tables() {
      events.push("derive-tables");
      return tables;
    },
    get inlinePictures() {
      events.push("derive-inline-pictures");
      return inlinePictures;
    },
    getOoxml: vi.fn(() => {
      events.push("get-ooxml");
      return ooxml;
    }),
    load: vi.fn((properties: string | string[]) => {
      rangeLoadCalls++;
      events.push(
        `range-load-${rangeLoadCalls}:${Array.isArray(properties) ? properties.join(",") : properties}`
      );
      if (rangeLoadCalls === 1 && options.failCaptureQueue) {
        throw options.failCaptureQueue;
      }
      if (rangeLoadCalls === 2 && options.failReuseQueue) {
        throw options.failReuseQueue;
      }
    }),
    untrack: vi.fn(() => {
      events.push("untrack");
      if (options.failCleanupQueue) {
        throw options.failCleanupQueue;
      }
      cleanupQueuedForRun = true;
    }),
  } as unknown as Word.Range;

  const captureContext = {
    document: {
      getSelection: vi.fn(() => {
        events.push("get-selection");
        return range;
      }),
    },
    trackedObjects: {
      add: vi.fn((trackedRange: Word.Range) => {
        expect(trackedRange).toBe(range);
        trackingQueued = true;
        events.push("track");
      }),
    },
    sync: vi.fn(async () => {
      events.push("capture-sync");
      if (options.failCaptureSync) {
        throw options.failCaptureSync;
      }
      trackingCommitted = trackingQueued;
    }),
  } as unknown as Word.RequestContext;

  const wordRun = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) {
      if (options.failCaptureEntry) {
        throw options.failCaptureEntry;
      }
      const callback = args[0] as (context: Word.RequestContext) => Promise<unknown>;
      return callback(captureContext);
    }

    expect(args[0]).toBe(range);
    if (!trackingCommitted && !options.failCaptureQueue && !options.failCaptureSync) {
      throw new Error("retained range was reused before tracking sync");
    }
    if (!reuseEntryAttempted && options.failReuseEntry) {
      reuseEntryAttempted = true;
      throw options.failReuseEntry;
    }
    reuseEntryAttempted = true;
    cleanupQueuedForRun = false;
    const callback = args[1] as (context: Word.RequestContext) => Promise<unknown>;
    return callback({
      sync: vi.fn(async () => {
        if (cleanupQueuedForRun) {
          events.push("cleanup-sync");
          if (options.failCleanupSync) {
            throw options.failCleanupSync;
          }
          return;
        }
        events.push("reuse-sync");
        if (options.failReuseSync) {
          throw options.failReuseSync;
        }
      }),
    } as unknown as Word.RequestContext);
  });
  vi.stubGlobal("Word", { run: wordRun });

  return {
    body,
    captureContext,
    events,
    inlinePictures,
    parentTable,
    parentTableCell,
    range,
    tables,
    wordRun,
  };
}

it("mirrors the exact production Capture queue order before a single tracking/load sync", async () => {
  const runtime = createRuntime();
  const canary = new ProductionShapeCaptureCanary();

  await expect(canary.captureForLaterReuse()).resolves.toEqual({
    phase: "production-shape-captured",
  });

  expect(runtime.events).toEqual([
    "get-selection",
    "track",
    "derive-parent-body",
    "derive-parent-table",
    "derive-parent-cell",
    "derive-tables",
    "derive-inline-pictures",
    "get-ooxml",
    "range-load-1:text,isEmpty",
    "body-load:type",
    "parent-table-load:isNullObject",
    "parent-cell-load:isNullObject",
    "tables-load:items",
    "pictures-load:items",
    "capture-sync",
  ]);
  expect(runtime.captureContext.trackedObjects.add).toHaveBeenCalledWith(runtime.range);
  expect(runtime.range.load).toHaveBeenCalledOnce();
  expect(runtime.captureContext.sync).toHaveBeenCalledOnce();
  expect(runtime.range.untrack).not.toHaveBeenCalled();
  expect(runtime.wordRun).toHaveBeenCalledOnce();
});

it("reuses the exact stored proxy only in a later invocation with the Apply validation load", async () => {
  const runtime = createRuntime();
  const canary = new ProductionShapeCaptureCanary();

  await canary.captureForLaterReuse();
  expect(runtime.wordRun).toHaveBeenCalledOnce();

  await expect(canary.reuseCapturedRange()).resolves.toEqual({
    phase: "production-shape-pass",
  });

  expect(runtime.wordRun).toHaveBeenCalledTimes(3);
  expect(runtime.wordRun.mock.calls[1][0]).toBe(runtime.range);
  expect(runtime.wordRun.mock.calls[2][0]).toBe(runtime.range);
  expect(runtime.range.load).toHaveBeenNthCalledWith(1, ["text", "isEmpty"]);
  expect(runtime.range.load).toHaveBeenNthCalledWith(2, ["text", "isEmpty"]);
  expect(runtime.range.untrack).toHaveBeenCalledOnce();
  expect(runtime.events.slice(-4)).toEqual([
    "range-load-2:text,isEmpty",
    "reuse-sync",
    "untrack",
    "cleanup-sync",
  ]);
  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
});

it.each([
  ["entry", { failCaptureEntry: officeError("Word.run") }, "production-shape-capture-entry"],
  ["queue", { failCaptureQueue: officeError("Range.load") }, "production-shape-capture-queue"],
  [
    "sync",
    { failCaptureSync: officeError("RequestContext.sync") },
    "production-shape-capture-sync",
  ],
] as const)(
  "classifies a production-shape Capture %s failure without content",
  async (_label, options, phase) => {
    createRuntime(options);

    const result = await new ProductionShapeCaptureCanary().captureForLaterReuse();

    expect(result).toMatchObject({
      phase,
      code: "InvalidObjectPath",
      name: "RichApi.Error",
    });
    expectContentFree(result!);
  }
);

it.each([
  ["entry", { failReuseEntry: officeError("Word.run") }, "production-shape-reuse-entry"],
  ["queue", { failReuseQueue: officeError("Range.load") }, "production-shape-reuse-queue"],
  ["sync", { failReuseSync: officeError("RequestContext.sync") }, "production-shape-reuse-sync"],
] as const)(
  "classifies a production-shape Reuse %s failure without content",
  async (_label, options, phase) => {
    createRuntime(options);
    const canary = new ProductionShapeCaptureCanary();
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

it.each([
  ["queue", { failCleanupQueue: officeError("Range.untrack") }, "production-shape-cleanup-queue"],
  [
    "sync",
    { failCleanupSync: officeError("RequestContext.sync") },
    "production-shape-cleanup-sync",
  ],
] as const)(
  "reports a production-shape cleanup %s failure only after Reuse passes",
  async (_label, options, phase) => {
    createRuntime(options);
    const canary = new ProductionShapeCaptureCanary();
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

it("keeps the primary Reuse failure when best-effort cleanup also fails", async () => {
  createRuntime({
    failReuseQueue: officeError("Range.load"),
    failCleanupQueue: officeError("Range.untrack"),
  });
  const canary = new ProductionShapeCaptureCanary();
  await canary.captureForLaterReuse();

  const result = await canary.reuseCapturedRange();

  expect(result).toEqual({
    phase: "production-shape-reuse-queue",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: "Range.load",
  });
  expectContentFree(result!);
});

it("best-effort cleans the previous production-shape range and retains only the newest proxy", async () => {
  const ranges = [createRuntime(), createRuntime()];
  let captureIndex = 0;
  const retainedRuns: Word.Range[] = [];
  let retainedSyncs = 0;
  const wordRun = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) {
      const runtime = ranges[captureIndex++];
      const callback = args[0] as (context: Word.RequestContext) => Promise<unknown>;
      return callback(runtime.captureContext);
    }
    const range = args[0] as Word.Range;
    retainedRuns.push(range);
    const callback = args[1] as (context: Word.RequestContext) => Promise<unknown>;
    return callback({
      sync: vi.fn(async () => {
        retainedSyncs++;
      }),
    } as unknown as Word.RequestContext);
  });
  vi.stubGlobal("Word", { run: wordRun });
  const canary = new ProductionShapeCaptureCanary();

  await expect(canary.captureForLaterReuse()).resolves.toMatchObject({
    phase: "production-shape-captured",
  });
  await expect(canary.captureForLaterReuse()).resolves.toMatchObject({
    phase: "production-shape-captured",
  });
  await expect(canary.reuseCapturedRange()).resolves.toMatchObject({
    phase: "production-shape-pass",
  });

  expect(retainedRuns).toEqual([ranges[0].range, ranges[1].range, ranges[1].range]);
  expect(retainedSyncs).toBe(3);
  expect(ranges[0].range.untrack).toHaveBeenCalledOnce();
  expect(ranges[1].range.untrack).toHaveBeenCalledOnce();
  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
});

it("rejects an empty production-shape Capture and exposes no mutation or wider lifecycle surface", async () => {
  const runtime = createRuntime({ empty: true });
  const canary = new ProductionShapeCaptureCanary();

  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
  await expect(canary.captureForLaterReuse()).resolves.toBeUndefined();
  await expect(canary.reuseCapturedRange()).resolves.toBeUndefined();
  expect(runtime.range.untrack).toHaveBeenCalledOnce();

  const source = readFileSync("test/word-harness/ProductionShapeCaptureCanary.ts", "utf8");
  expect(source).not.toMatch(
    /insertText|\.search\s*\(|TaskPaneController|ChatGateway|trackedSelections|snapshotId/
  );
  expect("insertText" in (runtime.range as object)).toBe(false);
  expect("search" in (runtime.range as object)).toBe(false);
});
