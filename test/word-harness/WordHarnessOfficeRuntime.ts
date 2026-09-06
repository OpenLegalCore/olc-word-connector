/* global Word */

import type { OfficeWordRuntime } from "../../src/office/OfficeWordAdapter";

export const APPLY_VALIDATION_STATEMENT_PHASES = [
  "apply-validation-current-selection-get",
  "apply-validation-retained-working-range-get",
  "apply-validation-current-parent-body-access",
  "apply-validation-current-parent-table-or-null-access",
  "apply-validation-current-parent-table-cell-or-null-access",
  "apply-validation-current-tables-access",
  "apply-validation-current-inline-pictures-access",
  "apply-validation-current-ooxml-queue",
  "apply-validation-current-range-load",
  "apply-validation-current-parent-body-load",
  "apply-validation-current-parent-table-or-null-load",
  "apply-validation-current-parent-table-cell-or-null-load",
  "apply-validation-current-tables-load",
  "apply-validation-current-inline-pictures-load",
  "apply-validation-retained-parent-body-access",
  "apply-validation-retained-parent-table-or-null-access",
  "apply-validation-retained-parent-table-cell-or-null-access",
  "apply-validation-retained-tables-access",
  "apply-validation-retained-inline-pictures-access",
  "apply-validation-retained-ooxml-queue",
  "apply-validation-retained-range-load",
  "apply-validation-retained-parent-body-load",
  "apply-validation-retained-parent-table-or-null-load",
  "apply-validation-retained-parent-table-cell-or-null-load",
  "apply-validation-retained-tables-load",
  "apply-validation-retained-inline-pictures-load",
  "apply-validation-compare-location-queue",
] as const;

export type ApplyValidationStatementPhase = (typeof APPLY_VALIDATION_STATEMENT_PHASES)[number];

export type OfficeDiagnosticPhase =
  | "capture-run-entry"
  | "capture-load-queue"
  | "capture-sync"
  | "capture-after-sync"
  | "capture-unexpected-sync"
  | "apply-run-entry"
  | "apply-validation-queue"
  | ApplyValidationStatementPhase
  | "apply-validation-sync"
  | "apply-validation-read-or-mutation-queue"
  | "apply-mutation-sync"
  | "post-commit-select-queue"
  | "post-commit-select-sync"
  | "apply-after-post-commit-select-sync"
  | "apply-unexpected-sync"
  | "cleanup-run-entry"
  | "cleanup-untrack-queue"
  | "cleanup-untrack-sync"
  | "cleanup-after-untrack-sync"
  | "cleanup-unexpected-sync";

export interface SafeOfficeErrorMetadata {
  readonly phase: OfficeDiagnosticPhase;
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

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 256) : undefined;
}

export function readSafeOfficeErrorMetadata(
  error: unknown,
  phase: OfficeDiagnosticPhase
): SafeOfficeErrorMetadata {
  const officeError =
    typeof error === "object" && error !== null ? (error as OfficeErrorLike) : undefined;

  return {
    phase,
    code: safeString(officeError?.code),
    name: safeString(officeError?.name),
    errorLocation: safeString(officeError?.debugInfo?.errorLocation),
  };
}

type ObservedRunKind = "capture" | "apply" | "cleanup";
type RetainedOperation = Exclude<ObservedRunKind, "capture">;
type ApplyValidationOperation =
  | "selection-get"
  | "working-range-get"
  | "parent-body-access"
  | "parent-table-or-null-access"
  | "parent-table-cell-or-null-access"
  | "tables-access"
  | "inline-pictures-access"
  | "ooxml-queue"
  | "range-load"
  | "parent-body-load"
  | "parent-table-or-null-load"
  | "parent-table-cell-or-null-load"
  | "tables-load"
  | "inline-pictures-load"
  | "compare-location-queue";

interface ApplyValidationStatement {
  readonly operation: ApplyValidationOperation;
  readonly phase: ApplyValidationStatementPhase;
}

const APPLY_VALIDATION_STATEMENTS: readonly ApplyValidationStatement[] = [
  { operation: "selection-get", phase: APPLY_VALIDATION_STATEMENT_PHASES[0] },
  { operation: "working-range-get", phase: APPLY_VALIDATION_STATEMENT_PHASES[1] },
  { operation: "parent-body-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[2] },
  {
    operation: "parent-table-or-null-access",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[3],
  },
  {
    operation: "parent-table-cell-or-null-access",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[4],
  },
  { operation: "tables-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[5] },
  { operation: "inline-pictures-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[6] },
  { operation: "ooxml-queue", phase: APPLY_VALIDATION_STATEMENT_PHASES[7] },
  { operation: "range-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[8] },
  { operation: "parent-body-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[9] },
  {
    operation: "parent-table-or-null-load",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[10],
  },
  {
    operation: "parent-table-cell-or-null-load",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[11],
  },
  { operation: "tables-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[12] },
  { operation: "inline-pictures-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[13] },
  { operation: "parent-body-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[14] },
  {
    operation: "parent-table-or-null-access",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[15],
  },
  {
    operation: "parent-table-cell-or-null-access",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[16],
  },
  { operation: "tables-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[17] },
  { operation: "inline-pictures-access", phase: APPLY_VALIDATION_STATEMENT_PHASES[18] },
  { operation: "ooxml-queue", phase: APPLY_VALIDATION_STATEMENT_PHASES[19] },
  { operation: "range-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[20] },
  { operation: "parent-body-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[21] },
  {
    operation: "parent-table-or-null-load",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[22],
  },
  {
    operation: "parent-table-cell-or-null-load",
    phase: APPLY_VALIDATION_STATEMENT_PHASES[23],
  },
  { operation: "tables-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[24] },
  { operation: "inline-pictures-load", phase: APPLY_VALIDATION_STATEMENT_PHASES[25] },
  { operation: "compare-location-queue", phase: APPLY_VALIDATION_STATEMENT_PHASES[26] },
];

interface ExactStatementFailure {
  readonly error: unknown;
  readonly phase: ApplyValidationStatementPhase;
}

function findPropertyDescriptor(target: object, property: PropertyKey): PropertyDescriptor {
  let owner: object | null = target;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, property);
    if (descriptor) {
      return descriptor;
    }
    owner = Object.getPrototypeOf(owner) as object | null;
  }
  throw new Error("WORD_HARNESS_INSTRUMENTATION_UNAVAILABLE");
}

class ApplyValidationStatementInstrumentation {
  private readonly restores: Array<() => void> = [];
  private readonly instrumentedRanges = new WeakSet<object>();
  private readonly instrumentedLoads = new WeakSet<object>();
  private statementIndex = 0;
  private exactFailure?: ExactStatementFailure;

  constructor(private readonly observePhase: (phase: OfficeDiagnosticPhase) => void) {}

  install(context: Word.RequestContext, retainedRange: Word.Range): void {
    try {
      this.patchMethod(retainedRange, "getRange", "working-range-get", (workingRange) =>
        this.instrumentRange(workingRange as Word.Range)
      );
      this.patchMethod(context.document, "getSelection", "selection-get", (selection) =>
        this.instrumentRange(selection as Word.Range)
      );
    } catch (error) {
      this.restore();
      throw error;
    }
  }

  assertComplete(): void {
    if (this.statementIndex !== APPLY_VALIDATION_STATEMENTS.length) {
      throw new Error("WORD_HARNESS_APPLY_VALIDATION_SHAPE_MISMATCH");
    }
  }

  failurePhase(error: unknown): ApplyValidationStatementPhase | undefined {
    const failure = this.exactFailure;
    if (failure && failure.error === error) {
      return failure.phase;
    }
    return undefined;
  }

  restore(): void {
    for (let index = this.restores.length - 1; index >= 0; index--) {
      try {
        this.restores[index]();
      } catch {
        // Development-only cleanup must not replace the primary Apply result.
      }
    }
    this.restores.length = 0;
  }

  private instrumentRange(range: Word.Range): void {
    const target = range as object;
    if (this.instrumentedRanges.has(target)) {
      return;
    }
    this.instrumentedRanges.add(target);

    this.patchGetter(range, "parentBody", "parent-body-access", (body) =>
      this.instrumentLoad(body as object, "parent-body-load")
    );
    this.patchGetter(range, "parentTableOrNullObject", "parent-table-or-null-access", (table) =>
      this.instrumentLoad(table as object, "parent-table-or-null-load")
    );
    this.patchGetter(
      range,
      "parentTableCellOrNullObject",
      "parent-table-cell-or-null-access",
      (cell) => this.instrumentLoad(cell as object, "parent-table-cell-or-null-load")
    );
    this.patchGetter(range, "tables", "tables-access", (tables) =>
      this.instrumentLoad(tables as object, "tables-load")
    );
    this.patchGetter(range, "inlinePictures", "inline-pictures-access", (pictures) =>
      this.instrumentLoad(pictures as object, "inline-pictures-load")
    );
    this.patchMethod(range, "getOoxml", "ooxml-queue");
    this.patchMethod(range, "load", "range-load");
    this.patchMethod(range, "compareLocationWith", "compare-location-queue");
  }

  private instrumentLoad(target: object, operation: ApplyValidationOperation): void {
    if (this.instrumentedLoads.has(target)) {
      return;
    }
    this.instrumentedLoads.add(target);
    this.patchMethod(target, "load", operation);
  }

  private patchGetter(
    target: object,
    property: PropertyKey,
    operation: ApplyValidationOperation,
    afterAccess: (value: unknown) => void
  ): void {
    const descriptor = findPropertyDescriptor(target, property);
    const ownDescriptor = Object.getOwnPropertyDescriptor(target, property);
    const read =
      typeof descriptor.get === "function"
        ? () => descriptor.get?.call(target)
        : () => descriptor.value as unknown;

    this.defineInstrumentedProperty(target, property, ownDescriptor, {
      configurable: true,
      enumerable: descriptor.enumerable ?? false,
      get: () => {
        const value = this.execute(operation, read);
        afterAccess(value);
        return value;
      },
    });
  }

  private patchMethod(
    target: object,
    property: PropertyKey,
    operation: ApplyValidationOperation,
    afterCall: (value: unknown) => void = () => undefined
  ): void {
    const original = Reflect.get(target, property, target) as unknown;
    if (typeof original !== "function") {
      throw new Error("WORD_HARNESS_INSTRUMENTATION_UNAVAILABLE");
    }
    const ownDescriptor = Object.getOwnPropertyDescriptor(target, property);

    this.defineInstrumentedProperty(target, property, ownDescriptor, {
      configurable: true,
      enumerable: findPropertyDescriptor(target, property).enumerable ?? false,
      writable: true,
      value: (...args: readonly unknown[]) => {
        const value = this.execute(operation, () => Reflect.apply(original, target, args));
        afterCall(value);
        return value;
      },
    });
  }

  private defineInstrumentedProperty(
    target: object,
    property: PropertyKey,
    ownDescriptor: PropertyDescriptor | undefined,
    instrumentedDescriptor: PropertyDescriptor
  ): void {
    Object.defineProperty(target, property, instrumentedDescriptor);
    this.restores.push(() => {
      if (ownDescriptor) {
        Object.defineProperty(target, property, ownDescriptor);
      } else {
        Reflect.deleteProperty(target, property);
      }
    });
  }

  private execute<T>(operation: ApplyValidationOperation, statement: () => T): T {
    const expected = APPLY_VALIDATION_STATEMENTS[this.statementIndex];
    if (!expected || expected.operation !== operation) {
      throw new Error("WORD_HARNESS_APPLY_VALIDATION_SHAPE_MISMATCH");
    }
    this.statementIndex++;
    this.notify(expected.phase);
    try {
      return statement();
    } catch (error) {
      this.exactFailure = { error, phase: expected.phase };
      throw error;
    }
  }

  private notify(phase: OfficeDiagnosticPhase): void {
    try {
      this.observePhase(phase);
    } catch {
      // Observation must not affect the isolated Word operation.
    }
  }
}

function syncPhase(kind: ObservedRunKind, completedSyncs: number): OfficeDiagnosticPhase {
  if (kind === "capture") {
    return completedSyncs === 0 ? "capture-sync" : "capture-unexpected-sync";
  }
  if (kind === "cleanup") {
    return completedSyncs === 0 ? "cleanup-untrack-sync" : "cleanup-unexpected-sync";
  }
  if (completedSyncs === 0) {
    return "apply-validation-sync";
  }
  if (completedSyncs === 1) {
    return "apply-mutation-sync";
  }
  if (completedSyncs === 2) {
    return "post-commit-select-sync";
  }
  return "apply-unexpected-sync";
}

function outsideSyncPhase(
  kind: ObservedRunKind,
  callbackStarted: boolean,
  completedSyncs: number
): OfficeDiagnosticPhase {
  if (!callbackStarted) {
    return `${kind}-run-entry`;
  }
  if (kind === "capture") {
    return completedSyncs === 0 ? "capture-load-queue" : "capture-after-sync";
  }
  if (kind === "cleanup") {
    return completedSyncs === 0 ? "cleanup-untrack-queue" : "cleanup-after-untrack-sync";
  }
  if (completedSyncs === 0) {
    return "apply-validation-queue";
  }
  if (completedSyncs === 1) {
    return "apply-validation-read-or-mutation-queue";
  }
  if (completedSyncs === 2) {
    return "post-commit-select-queue";
  }
  return "apply-after-post-commit-select-sync";
}

export class WordHarnessOfficeRuntime implements OfficeWordRuntime {
  private retainedOperation?: RetainedOperation;
  private retainedRunCount = 0;

  constructor(
    private readonly reportError: (metadata: SafeOfficeErrorMetadata) => void,
    private readonly observePhase: (phase: OfficeDiagnosticPhase) => void = () => undefined
  ) {}

  run<T>(batch: (context: Word.RequestContext) => Promise<T>): Promise<T> {
    return this.observeRun("capture", (observedBatch) => Word.run(observedBatch), batch);
  }

  runWithRange<T>(
    range: Word.Range,
    batch: (context: Word.RequestContext) => Promise<T>
  ): Promise<T> {
    const kind =
      this.retainedOperation === "apply" && this.retainedRunCount === 0 ? "apply" : "cleanup";
    this.retainedRunCount++;
    return this.observeRun(
      kind,
      (observedBatch) => Word.run(range, observedBatch),
      batch,
      kind === "apply" ? range : undefined
    );
  }

  async withRetainedOperation<T>(
    operation: RetainedOperation,
    callback: () => Promise<T>
  ): Promise<T> {
    const previousOperation = this.retainedOperation;
    const previousRunCount = this.retainedRunCount;
    this.retainedOperation = operation;
    this.retainedRunCount = 0;
    try {
      return await callback();
    } finally {
      this.retainedOperation = previousOperation;
      this.retainedRunCount = previousRunCount;
    }
  }

  private async observeRun<T>(
    kind: ObservedRunKind,
    invoke: (observedBatch: (context: Word.RequestContext) => Promise<T>) => Promise<T>,
    batch: (context: Word.RequestContext) => Promise<T>,
    retainedApplyRange?: Word.Range
  ): Promise<T> {
    let callbackStarted = false;
    let completedSyncs = 0;
    let reported = false;
    let statementInstrumentation: ApplyValidationStatementInstrumentation | undefined;

    try {
      return await invoke(async (context) => {
        callbackStarted = true;
        if (kind === "apply" && retainedApplyRange) {
          statementInstrumentation = new ApplyValidationStatementInstrumentation(this.observePhase);
          statementInstrumentation.install(context, retainedApplyRange);
        }
        const observedContext = new Proxy(context, {
          get: (target, property) => {
            if (property !== "sync") {
              return Reflect.get(target, property, target);
            }
            return async (): Promise<void> => {
              const phase = syncPhase(kind, completedSyncs);
              if (kind === "apply" && completedSyncs === 0) {
                statementInstrumentation?.assertComplete();
              }
              try {
                this.observePhase(phase);
              } catch {
                // Observation must not affect the isolated Word operation.
              }
              try {
                await target.sync();
                completedSyncs++;
              } catch (error) {
                reported = true;
                this.reportError(readSafeOfficeErrorMetadata(error, phase));
                throw error;
              }
            };
          },
        });
        try {
          return await batch(observedContext);
        } finally {
          statementInstrumentation?.restore();
        }
      });
    } catch (error) {
      if (!reported) {
        this.reportError(
          readSafeOfficeErrorMetadata(
            error,
            statementInstrumentation?.failurePhase(error) ??
              outsideSyncPhase(kind, callbackStarted, completedSyncs)
          )
        );
      }
      throw error;
    }
  }
}
