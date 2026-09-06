/* global DOMParser, OfficeExtension, Word */

import { WordAdapterError, type SelectionSnapshot, type WordAdapter } from "./WordAdapter";
import { validateSelection, type SelectionFacts } from "./selectionPolicy";

export interface OfficeWordRuntime {
  run<T>(batch: (context: Word.RequestContext) => Promise<T>): Promise<T>;
  runWithRange<T>(
    range: Word.Range,
    batch: (context: Word.RequestContext) => Promise<T>
  ): Promise<T>;
}

export interface QueuedSelectionFacts {
  readonly range: Word.Range;
  readonly body: Word.Body;
  readonly parentTable: Word.Table;
  readonly parentTableCell: Word.TableCell;
  readonly tables: Word.TableCollection;
  readonly inlinePictures: Word.InlinePictureCollection;
  readonly ooxml: OfficeExtension.ClientResult<string>;
}

export interface TrackedSelection {
  readonly snapshot: SelectionSnapshot;
  readonly range: Word.Range;
  lifecycle: "active" | "consumed";
  cleanupPromise?: Promise<void>;
}

const UNSUPPORTED_OOXML_LOCAL_NAMES = new Set([
  "altchunk",
  "control",
  "drawing",
  "object",
  "oleobject",
  "pict",
  "sdt",
]);

const productionRuntime: OfficeWordRuntime = {
  run: (batch) => Word.run(batch),
  runWithRange: (range, batch) => Word.run(range, batch),
};

function copySnapshot(snapshot: SelectionSnapshot): SelectionSnapshot {
  return {
    snapshotId: snapshot.snapshotId,
    text: snapshot.text,
    characterCount: snapshot.characterCount,
    context: snapshot.context,
    capturedAt: snapshot.capturedAt,
  };
}

export function queueSelectionFacts(range: Word.Range): QueuedSelectionFacts {
  const body = range.parentBody;
  const parentTable = range.parentTableOrNullObject;
  const parentTableCell = range.parentTableCellOrNullObject;
  const tables = range.tables;
  const inlinePictures = range.inlinePictures;
  const ooxml = range.getOoxml();

  range.load(["text", "isEmpty"]);
  body.load("type");
  parentTable.load("isNullObject");
  parentTableCell.load("isNullObject");
  tables.load("items");
  inlinePictures.load("items");

  return { range, body, parentTable, parentTableCell, tables, inlinePictures, ooxml };
}

function hasUnsupportedOoxmlStructure(ooxml: string): boolean {
  try {
    if (ooxml.trim().length === 0) {
      return true;
    }

    const document = new DOMParser().parseFromString(ooxml, "application/xml");
    const elements = document.getElementsByTagName("*");
    for (let index = 0; index < elements.length; index++) {
      const localName = elements[index].localName.toLowerCase();
      if (localName === "parsererror" || UNSUPPORTED_OOXML_LOCAL_NAMES.has(localName)) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

export function readSelectionFacts(queued: QueuedSelectionFacts): SelectionFacts {
  return {
    text: queued.range.text,
    isEmpty: queued.range.isEmpty,
    bodyType: queued.body.type,
    hasParentTable: !queued.parentTable.isNullObject,
    hasParentTableCell: !queued.parentTableCell.isNullObject,
    containedTableCount: queued.tables.items.length,
    inlinePictureCount: queued.inlinePictures.items.length,
    hasUnsupportedEmbeddedStructure: hasUnsupportedOoxmlStructure(queued.ooxml.value),
  };
}

function controlledReadError(error: unknown): WordAdapterError {
  return error instanceof WordAdapterError ? error : new WordAdapterError("WORD_READ_FAILED");
}

export class OfficeWordAdapter implements WordAdapter {
  protected readonly trackedSelections = new Map<string, TrackedSelection>();
  private snapshotSequence = 0;

  constructor(protected readonly runtime: OfficeWordRuntime = productionRuntime) {}

  async captureSelection(): Promise<SelectionSnapshot> {
    await this.drainPendingCleanup();

    let retainedLocator: Word.Range | undefined;
    let trackingQueued = false;

    try {
      return await this.runtime.run(async (context) => {
        const selectedRange = context.document.getSelection();
        retainedLocator = selectedRange.getRange("Whole");
        context.trackedObjects.add(retainedLocator);
        trackingQueued = true;
        const inspectionRange = retainedLocator.getRange("Whole");
        const queuedFacts = queueSelectionFacts(inspectionRange);
        await context.sync();

        const facts = readSelectionFacts(queuedFacts);
        const selectionContext = validateSelection(facts);
        const snapshot: SelectionSnapshot = {
          snapshotId: `selection-${Date.now()}-${++this.snapshotSequence}`,
          text: facts.text,
          characterCount: facts.text.length,
          context: selectionContext,
          capturedAt: new Date().toISOString(),
        };

        this.trackedSelections.set(snapshot.snapshotId, {
          snapshot: copySnapshot(snapshot),
          range: retainedLocator,
          lifecycle: "active",
        });
        return copySnapshot(snapshot);
      });
    } catch (error) {
      if (retainedLocator && trackingQueued) {
        await this.tryReleaseRange(retainedLocator);
      }
      throw controlledReadError(error);
    }
  }

  async releaseSelection(snapshot: SelectionSnapshot): Promise<void> {
    const tracked = this.trackedSelections.get(snapshot.snapshotId);
    if (!tracked) {
      return;
    }

    tracked.lifecycle = "consumed";
    try {
      await this.releaseTrackedSelection(snapshot.snapshotId, tracked);
    } catch (error) {
      throw controlledReadError(error);
    }
  }

  private releaseTrackedSelection(snapshotId: string, tracked: TrackedSelection): Promise<void> {
    if (tracked.cleanupPromise) {
      return tracked.cleanupPromise;
    }

    const cleanupPromise = this.releaseRange(tracked.range).then(() => {
      if (this.trackedSelections.get(snapshotId) === tracked) {
        this.trackedSelections.delete(snapshotId);
      }
    });
    tracked.cleanupPromise = cleanupPromise;

    const clearCleanupPromise = () => {
      if (tracked.cleanupPromise === cleanupPromise) {
        tracked.cleanupPromise = undefined;
      }
    };
    void cleanupPromise.then(clearCleanupPromise, clearCleanupPromise);
    return cleanupPromise;
  }

  private async releaseRange(range: Word.Range): Promise<void> {
    await this.runtime.runWithRange(range, async (context) => {
      range.untrack();
      await context.sync();
    });
  }

  private async tryReleaseRange(range: Word.Range): Promise<void> {
    try {
      await this.releaseRange(range);
    } catch {
      // The primary controlled error remains authoritative after best-effort cleanup.
    }
  }

  protected async tryReleaseTrackedSelection(
    snapshotId: string,
    tracked: TrackedSelection
  ): Promise<void> {
    try {
      await this.releaseTrackedSelection(snapshotId, tracked);
    } catch {
      // Keep the consumed entry so a later release can retry cleanup idempotently.
    }
  }

  private async drainPendingCleanup(): Promise<void> {
    const pendingSelections = [...this.trackedSelections.entries()].filter(
      ([, tracked]) => tracked.lifecycle === "consumed"
    );
    for (const [snapshotId, tracked] of pendingSelections) {
      await this.tryReleaseTrackedSelection(snapshotId, tracked);
    }
  }
}
