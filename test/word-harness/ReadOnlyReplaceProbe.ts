import {
  OfficeWordAdapter,
  queueSelectionFacts,
  readSelectionFacts,
  type OfficeWordRuntime,
} from "../../src/office/OfficeWordAdapter";
import { validateSelection, type SelectionFacts } from "../../src/office/selectionPolicy";
import { WordAdapterError, type SelectionSnapshot } from "../../src/office/WordAdapter";

type Validation = { context: SelectionSnapshot["context"] } | { error: string };
type Failure =
  | "no-diagnostic-capture"
  | "tracked-missing"
  | "tracked-consumed"
  | "snapshot-fields"
  | "location"
  | "current-validation"
  | "current-context"
  | "target-validation"
  | "target-context"
  | "current-text"
  | "target-text"
  | "current-ooxml"
  | "target-ooxml"
  | "exception";

export interface ReadOnlyReplaceObservation {
  readonly scope: "NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY";
  readonly exists: boolean;
  readonly lifecycle?: "active" | "consumed";
  readonly snapshotFields?: Readonly<Record<keyof SelectionSnapshot, boolean>>;
  readonly location?: string;
  readonly currentValidation?: Validation;
  readonly targetValidation?: Validation;
  readonly textMatches?: { readonly current: boolean; readonly target: boolean };
  readonly ooxmlMatches?: {
    readonly current: boolean;
    readonly target: boolean;
    readonly currentTarget: boolean;
  };
  readonly firstFailure?: Failure;
  readonly exception?: { readonly stage: string; readonly name: string; readonly code: string };
  readonly stoppedBeforeInsertText: true;
}

// Private local inspection only: these strings can contain document content.
// The first completed OOXML comparison is retained, never reread or logged here.
export interface ReadOnlyReplaceOoxmlEvidence {
  readonly observation: ReadOnlyReplaceObservation;
  readonly originalOoxml: string;
  readonly currentOoxml: string;
  readonly targetOoxml: string;
}

function validation(facts: SelectionFacts): Validation {
  try {
    return { context: validateSelection(facts) };
  } catch (error) {
    if (!(error instanceof WordAdapterError)) throw error;
    return { error: error.code };
  }
}

function safeIdentifier(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(value)
    ? value
    : "UNAVAILABLE";
}

// A separate adapter instance owns only this probe's ranges. Never call Apply.
class ReadOnlyReplaceProbe extends OfficeWordAdapter {
  private frozen?: SelectionSnapshot;
  private ooxmlEvidence?: ReadOnlyReplaceOoxmlEvidence;

  async captureDiagnostic(): Promise<{ readonly captured: true }> {
    await this.releaseDiagnostic();
    this.ooxmlEvidence = undefined;
    this.frozen = Object.freeze({ ...(await this.captureSelection()) });
    return { captured: true };
  }

  async releaseDiagnostic(): Promise<void> {
    if (this.frozen) await this.releaseSelection(this.frozen);
  }

  readOoxml(): ReadOnlyReplaceOoxmlEvidence | undefined {
    return this.ooxmlEvidence;
  }

  async inspectDiagnostic(): Promise<ReadOnlyReplaceObservation> {
    const snapshot = this.frozen;
    const tracked = snapshot && this.trackedSelections.get(snapshot.snapshotId);
    const observation = {
      scope: "NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY" as const,
      exists: Boolean(tracked),
      lifecycle: tracked?.lifecycle,
      stoppedBeforeInsertText: true as const,
    };
    if (!snapshot) return { ...observation, firstFailure: "no-diagnostic-capture" };
    if (!tracked) return { ...observation, firstFailure: "tracked-missing" };
    if (tracked.lifecycle !== "active") return { ...observation, firstFailure: "tracked-consumed" };
    const snapshotFields = {
      snapshotId: snapshot.snapshotId === tracked.snapshot.snapshotId,
      text: snapshot.text === tracked.snapshot.text,
      characterCount: snapshot.characterCount === tracked.snapshot.characterCount,
      context: snapshot.context === tracked.snapshot.context,
      capturedAt: snapshot.capturedAt === tracked.snapshot.capturedAt,
    };
    if (!Object.values(snapshotFields).every(Boolean)) {
      return { ...observation, snapshotFields, firstFailure: "snapshot-fields" };
    }

    let stage = "run-entry";
    let partial: ReadOnlyReplaceObservation = { ...observation, snapshotFields };
    const check = (passed: boolean, failure: Failure): void => {
      if (!passed && !partial.firstFailure) partial = { ...partial, firstFailure: failure };
    };
    try {
      return await this.runtime.runWithRange(tracked.range, async (context) => {
        stage = "current-get-and-retained-clone";
        const current = context.document.getSelection();
        const target = tracked.range.getRange("Whole");
        stage = "current-facts-queue";
        const currentFacts = queueSelectionFacts(current);
        stage = "target-facts-queue";
        const targetFacts = queueSelectionFacts(target);
        stage = "compare-location-queue";
        const location = current.compareLocationWith(target);
        stage = "validation-sync";
        await context.sync();
        stage = "current-facts-read";
        const currentRead = readSelectionFacts(currentFacts);
        stage = "target-facts-read";
        const targetRead = readSelectionFacts(targetFacts);
        stage = "location-read";
        const relation = location.value;
        partial = { ...partial, location: relation };
        check(relation === "Equal", "location");
        stage = "current-validation";
        const currentValidation = validation(currentRead);
        partial = { ...partial, currentValidation };
        check(!("error" in currentValidation), "current-validation");
        check(
          "context" in currentValidation && currentValidation.context === snapshot.context,
          "current-context"
        );
        stage = "target-validation";
        const targetValidation = validation(targetRead);
        partial = { ...partial, targetValidation };
        check(!("error" in targetValidation), "target-validation");
        check(
          "context" in targetValidation && targetValidation.context === snapshot.context,
          "target-context"
        );
        stage = "text-comparisons";
        const textMatches = {
          current: currentRead.text === snapshot.text,
          target: targetRead.text === snapshot.text,
        };
        partial = { ...partial, textMatches };
        check(textMatches.current, "current-text");
        check(textMatches.target, "target-text");
        stage = "ooxml-comparisons";
        const ooxmlMatches = {
          current: currentFacts.ooxml.value === tracked.originalOoxml,
          target: targetFacts.ooxml.value === tracked.originalOoxml,
          currentTarget: currentFacts.ooxml.value === targetFacts.ooxml.value,
        };
        partial = { ...partial, ooxmlMatches };
        check(ooxmlMatches.current, "current-ooxml");
        check(ooxmlMatches.target, "target-ooxml");
        this.ooxmlEvidence ??= Object.freeze({
          observation: Object.freeze({ ...partial }),
          originalOoxml: tracked.originalOoxml,
          currentOoxml: currentFacts.ooxml.value,
          targetOoxml: targetFacts.ooxml.value,
        });
        return partial;
      });
    } catch (error) {
      const officeError = error as { name?: unknown; code?: unknown } | null;
      return {
        ...partial,
        firstFailure: partial.firstFailure ?? "exception",
        exception: {
          stage,
          name: safeIdentifier(officeError?.name),
          code: safeIdentifier(officeError?.code),
        },
      };
    }
  }
}

export function createReadOnlyReplaceProbe(runtime?: OfficeWordRuntime): {
  capture(): Promise<{ readonly captured: true }>;
  inspect(): Promise<ReadOnlyReplaceObservation>;
  readOoxml(): ReadOnlyReplaceOoxmlEvidence | undefined;
  release(): Promise<void>;
} {
  const probe = new ReadOnlyReplaceProbe(runtime);
  return Object.freeze({
    capture: () => probe.captureDiagnostic(),
    inspect: () => probe.inspectDiagnostic(),
    readOoxml: () => probe.readOoxml(),
    release: () => probe.releaseDiagnostic(),
  });
}
