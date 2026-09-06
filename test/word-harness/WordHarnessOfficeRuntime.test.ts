import { afterEach, expect, it, vi } from "vitest";

import { MutableOfficeWordAdapter } from "../office/MutableOfficeWordAdapter";
import {
  APPLY_VALIDATION_STATEMENT_PHASES,
  WordHarnessOfficeRuntime,
  readSafeOfficeErrorMetadata,
  type OfficeDiagnosticPhase,
  type SafeOfficeErrorMetadata,
} from "./WordHarnessOfficeRuntime";

afterEach(() => {
  vi.unstubAllGlobals();
});

const privateSelectedText = "private selected document text";

function invalidObjectPathError(location: string) {
  return {
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    message: privateSelectedText,
    debugInfo: {
      errorLocation: location,
      statement: privateSelectedText,
    },
  };
}

function createApplyValidationFixture(
  options: {
    readonly failStatement?: number;
    readonly failApplySync?: number;
  } = {}
) {
  const statementError = invalidObjectPathError("Range.validationStatement");
  const syncError = invalidObjectPathError("RequestContext.sync");
  let applyStatementCalls = 0;
  let applySyncCalls = 0;
  let mutationCalls = 0;
  let retainedRunCalls = 0;
  let applying = false;
  let compareTarget: Word.Range | undefined;
  let applyWorkingRange: Word.Range | undefined;
  let retainedRange: Word.Range | undefined;

  const hitStatement = () => {
    if (!applying) {
      return;
    }
    applyStatementCalls++;
    if (applyStatementCalls === options.failStatement) {
      throw statementError;
    }
  };

  const makeRange = (): Word.Range => {
    const body = {
      type: "MainDoc",
      load: vi.fn(() => hitStatement()),
    } as unknown as Word.Body;
    const parentTable = {
      isNullObject: true,
      load: vi.fn(() => hitStatement()),
    } as unknown as Word.Table;
    const parentTableCell = {
      isNullObject: true,
      load: vi.fn(() => hitStatement()),
    } as unknown as Word.TableCell;
    const tables = {
      items: [],
      load: vi.fn(() => hitStatement()),
    } as unknown as Word.TableCollection;
    const inlinePictures = {
      items: [],
      load: vi.fn(() => hitStatement()),
    } as unknown as Word.InlinePictureCollection;
    const range = {
      text: privateSelectedText,
      isEmpty: false,
      get parentBody() {
        hitStatement();
        return body;
      },
      get parentTableOrNullObject() {
        hitStatement();
        return parentTable;
      },
      get parentTableCellOrNullObject() {
        hitStatement();
        return parentTableCell;
      },
      get tables() {
        hitStatement();
        return tables;
      },
      get inlinePictures() {
        hitStatement();
        return inlinePictures;
      },
      getOoxml: vi.fn(() => {
        hitStatement();
        return {
          value:
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p /></w:body></w:document>',
        };
      }),
      getRange: vi.fn((rangeLocation: string) => {
        hitStatement();
        if (rangeLocation !== "Whole") {
          throw new Error("Unexpected range location");
        }
        const clone = makeRange();
        if (applying) {
          applyWorkingRange = clone;
        }
        return clone;
      }),
      load: vi.fn(() => hitStatement()),
      compareLocationWith: vi.fn((other: Word.Range) => {
        hitStatement();
        compareTarget = other;
        return { value: "Equal" };
      }),
      insertText: vi.fn(() => {
        mutationCalls++;
        return { select: vi.fn() };
      }),
      untrack: vi.fn(),
    } as unknown as Word.Range;
    return range;
  };

  const captureSelectionRange = makeRange();
  const currentRange = makeRange();
  const makeContext = (selection: Word.Range, applyContext: boolean) =>
    ({
      document: {
        getSelection: vi.fn(() => {
          hitStatement();
          return selection;
        }),
      },
      trackedObjects: {
        add: vi.fn((range: Word.Range) => {
          retainedRange ??= range;
        }),
      },
      sync: vi.fn(async () => {
        if (!applyContext) {
          return;
        }
        applySyncCalls++;
        if (applySyncCalls === options.failApplySync) {
          throw syncError;
        }
      }),
    }) as unknown as Word.RequestContext;
  const captureContext = makeContext(captureSelectionRange, false);
  const applyContext = makeContext(currentRange, true);
  const cleanupContext = makeContext(captureSelectionRange, false);

  const wordRun = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) {
      const callback = args[0] as (context: Word.RequestContext) => Promise<unknown>;
      return callback(captureContext);
    }

    expect(args[0]).toBe(retainedRange);
    retainedRunCalls++;
    const callback = args[1] as (context: Word.RequestContext) => Promise<unknown>;
    applying = retainedRunCalls === 1;
    try {
      return await callback(applying ? applyContext : cleanupContext);
    } finally {
      applying = false;
    }
  });
  vi.stubGlobal("Word", { run: wordRun });

  return {
    get applyStatementCalls() {
      return applyStatementCalls;
    },
    get applySyncCalls() {
      return applySyncCalls;
    },
    get applyWorkingRange() {
      return applyWorkingRange;
    },
    get compareTarget() {
      return compareTarget;
    },
    get mutationCalls() {
      return mutationCalls;
    },
    currentRange,
    get retainedRange() {
      return retainedRange;
    },
    statementError,
    syncError,
    wordRun,
  };
}

async function captureAndApply(
  runtime: WordHarnessOfficeRuntime,
  replacement = privateSelectedText
): Promise<void> {
  const adapter = new MutableOfficeWordAdapter(runtime);
  const snapshot = await adapter.captureSelection();
  await runtime.withRetainedOperation("apply", () =>
    adapter.applyReplacement(snapshot, replacement)
  );
}

it("uses the owning-range Word.run overload for retained proxies", async () => {
  const context = {} as Word.RequestContext;
  const range = {} as Word.Range;
  const batch = vi.fn(async (_context: Word.RequestContext) => "done");
  const wordRun = vi.fn(async (...args: unknown[]) => {
    const callback = args.at(-1) as (value: Word.RequestContext) => Promise<string>;
    return callback(context);
  });
  vi.stubGlobal("Word", { run: wordRun });
  const runtime = new WordHarnessOfficeRuntime(() => undefined);

  await expect(runtime.runWithRange(range, batch)).resolves.toBe("done");

  expect(wordRun).toHaveBeenCalledOnce();
  expect(wordRun.mock.calls[0][0]).toBe(range);
  expect(wordRun.mock.calls[0][1]).toEqual(expect.any(Function));
  expect(batch).toHaveBeenCalledOnce();
  expect(batch.mock.calls[0][0]).not.toBe(context);
});

it("reports only a closed phase, code, name, and errorLocation before rethrowing", async () => {
  const officeError = {
    code: "GeneralException",
    name: "OfficeExtension.Error",
    message: "private document text",
    debugInfo: {
      errorLocation: "Range.insertText",
      fullStatements: ["private document text"],
      statement: "private document text",
    },
  };
  vi.stubGlobal("Word", {
    run: vi.fn(async () => {
      throw officeError;
    }),
  });
  const reportError = vi.fn();
  const runtime = new WordHarnessOfficeRuntime(reportError);

  await expect(runtime.run(async () => undefined)).rejects.toBe(officeError);

  expect(reportError).toHaveBeenCalledWith({
    phase: "capture-run-entry",
    code: "GeneralException",
    name: "OfficeExtension.Error",
    errorLocation: "Range.insertText",
  });
  expect(JSON.stringify(reportError.mock.calls)).not.toContain("private document text");
  expect(readSafeOfficeErrorMetadata("not-an-office-error", "capture-run-entry")).toEqual({
    phase: "capture-run-entry",
    code: undefined,
    name: undefined,
    errorLocation: undefined,
  });
});

it("localizes a retained-range cleanup failure at its sync", async () => {
  const officeError = {
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    message: "private document text",
    debugInfo: { statement: "private document text" },
  };
  let syncCalls = 0;
  const context = {
    sync: vi.fn(async () => {
      syncCalls++;
      if (syncCalls === 1) {
        throw officeError;
      }
    }),
  } as unknown as Word.RequestContext;
  vi.stubGlobal("Word", {
    run: vi.fn(async (_range: Word.Range, batch: (value: Word.RequestContext) => Promise<void>) =>
      batch(context)
    ),
  });
  const reportError = vi.fn();
  const runtime = new WordHarnessOfficeRuntime(reportError);
  const range = {} as Word.Range;

  await expect(
    runtime.withRetainedOperation("cleanup", () =>
      runtime.runWithRange(range, async (observedContext) => {
        await observedContext.sync();
      })
    )
  ).rejects.toBe(officeError);

  expect(reportError).toHaveBeenCalledOnce();
  expect(reportError).toHaveBeenCalledWith({
    phase: "cleanup-untrack-sync",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: undefined,
  });
  expect(JSON.stringify(reportError.mock.calls)).not.toContain("private document text");
});

it("observes every real Apply validation statement once, in exact order, on exact proxies", async () => {
  const fixture = createApplyValidationFixture();
  const observedPhases: OfficeDiagnosticPhase[] = [];
  const runtime = new WordHarnessOfficeRuntime(
    () => undefined,
    (phase) => observedPhases.push(phase)
  );

  await captureAndApply(runtime);

  const applyValidationPhases = observedPhases.filter((phase) =>
    phase.startsWith("apply-validation")
  );
  expect(applyValidationPhases).toEqual([
    ...APPLY_VALIDATION_STATEMENT_PHASES,
    "apply-validation-sync",
  ]);
  expect(new Set(APPLY_VALIDATION_STATEMENT_PHASES).size).toBe(
    APPLY_VALIDATION_STATEMENT_PHASES.length
  );
  expect(fixture.applyStatementCalls).toBe(APPLY_VALIDATION_STATEMENT_PHASES.length);
  expect(fixture.applySyncCalls).toBe(1);
  expect(fixture.compareTarget).toBe(fixture.applyWorkingRange);
  expect(fixture.applyWorkingRange).not.toBe(fixture.retainedRange);
  expect(fixture.mutationCalls).toBe(0);
  expect(fixture.wordRun.mock.calls[1][0]).toBe(fixture.retainedRange);
});

it.each(APPLY_VALIDATION_STATEMENT_PHASES.map((phase, index) => [phase, index + 1] as const))(
  "maps InvalidObjectPath at real statement %s to that exact content-free phase",
  async (phase, failStatement) => {
    const fixture = createApplyValidationFixture({ failStatement });
    const reports: SafeOfficeErrorMetadata[] = [];
    const runtime = new WordHarnessOfficeRuntime((metadata) => reports.push(metadata));

    await expect(captureAndApply(runtime)).rejects.toMatchObject({
      name: "WordAdapterError",
      code: "WORD_WRITE_FAILED",
    });

    expect(reports).toEqual([
      {
        phase,
        code: "InvalidObjectPath",
        name: "RichApi.Error",
        errorLocation: "Range.validationStatement",
      },
    ]);
    expect(fixture.applyStatementCalls).toBe(failStatement);
    expect(fixture.applySyncCalls).toBe(0);
    expect(fixture.mutationCalls).toBe(0);
    expect(JSON.stringify(reports)).not.toContain(privateSelectedText);
  }
);

it.each([
  [1, "apply-validation-sync"],
  [2, "apply-mutation-sync"],
  [3, "post-commit-select-sync"],
] as const satisfies ReadonlyArray<readonly [number, OfficeDiagnosticPhase]>)(
  "keeps Apply sync %s separate from statement phases",
  async (failedSync, phase) => {
    const fixture = createApplyValidationFixture({ failApplySync: failedSync });
    const reports: SafeOfficeErrorMetadata[] = [];
    const runtime = new WordHarnessOfficeRuntime((metadata) => reports.push(metadata));

    const operation = captureAndApply(runtime, "replacement");
    if (failedSync < 3) {
      await expect(operation).rejects.toMatchObject({
        name: "WordAdapterError",
        code: "WORD_WRITE_FAILED",
      });
    } else {
      await expect(operation).resolves.toBeUndefined();
    }

    expect(reports).toEqual([
      {
        phase,
        code: "InvalidObjectPath",
        name: "RichApi.Error",
        errorLocation: "RequestContext.sync",
      },
    ]);
    expect(fixture.applyStatementCalls).toBe(APPLY_VALIDATION_STATEMENT_PHASES.length);
    expect(JSON.stringify(reports)).not.toContain(privateSelectedText);
  }
);

it("localizes failure before the retained-range Apply callback starts", async () => {
  const officeError = {
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    message: "private document text",
  };
  vi.stubGlobal("Word", {
    run: vi.fn(async () => {
      throw officeError;
    }),
  });
  const reportError = vi.fn();
  const runtime = new WordHarnessOfficeRuntime(reportError);

  await expect(
    runtime.withRetainedOperation("apply", () =>
      runtime.runWithRange({} as Word.Range, async () => undefined)
    )
  ).rejects.toBe(officeError);

  expect(reportError).toHaveBeenCalledWith({
    phase: "apply-run-entry",
    code: "InvalidObjectPath",
    name: "RichApi.Error",
    errorLocation: undefined,
  });
  expect(JSON.stringify(reportError.mock.calls)).not.toContain("private document text");
});
