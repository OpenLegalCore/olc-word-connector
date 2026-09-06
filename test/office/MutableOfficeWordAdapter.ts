/* global Word */

import {
  OfficeWordAdapter,
  queueSelectionFacts,
  readSelectionFacts,
} from "../../src/office/OfficeWordAdapter";
import { WordAdapterError, type SelectionSnapshot } from "../../src/office/WordAdapter";
import { validateSelection } from "../../src/office/selectionPolicy";

function snapshotsMatch(left: SelectionSnapshot, right: SelectionSnapshot): boolean {
  return (
    left.snapshotId === right.snapshotId &&
    left.text === right.text &&
    left.characterCount === right.characterCount &&
    left.context === right.context &&
    left.capturedAt === right.capturedAt
  );
}

function controlledWriteError(error: unknown): WordAdapterError {
  return error instanceof WordAdapterError ? error : new WordAdapterError("WORD_WRITE_FAILED");
}

/**
 * Development-only mutation canary. Production composition imports OfficeWordAdapter directly;
 * the production bundle verifier rejects this class and the Word insertion primitive.
 */
export class MutableOfficeWordAdapter extends OfficeWordAdapter {
  async applyReplacement(snapshot: SelectionSnapshot, proposedText: string): Promise<void> {
    const tracked = this.trackedSelections.get(snapshot.snapshotId);
    if (!tracked || tracked.lifecycle !== "active") {
      throw new WordAdapterError("SELECTION_CHANGED");
    }
    tracked.lifecycle = "consumed";

    if (!snapshotsMatch(snapshot, tracked.snapshot)) {
      await this.tryReleaseTrackedSelection(snapshot.snapshotId, tracked);
      throw new WordAdapterError("SELECTION_CHANGED");
    }
    if (typeof proposedText !== "string" || proposedText.includes("\u0000")) {
      await this.tryReleaseTrackedSelection(snapshot.snapshotId, tracked);
      throw new WordAdapterError("WORD_WRITE_FAILED");
    }

    let mutationCommitted = false;
    try {
      await this.runtime.runWithRange(tracked.range, async (context) => {
        const currentSelection = context.document.getSelection();
        const workingRange = tracked.range.getRange("Whole");
        const queuedCurrentFacts = queueSelectionFacts(currentSelection);
        const queuedTrackedFacts = queueSelectionFacts(workingRange);
        const location = currentSelection.compareLocationWith(workingRange);
        await context.sync();

        const currentFacts = readSelectionFacts(queuedCurrentFacts);
        const trackedFacts = readSelectionFacts(queuedTrackedFacts);
        let currentContext: SelectionSnapshot["context"];
        let trackedContext: SelectionSnapshot["context"];
        try {
          currentContext = validateSelection(currentFacts);
          trackedContext = validateSelection(trackedFacts);
        } catch {
          throw new WordAdapterError("SELECTION_CHANGED");
        }

        if (
          location.value !== "Equal" ||
          currentFacts.text !== tracked.snapshot.text ||
          trackedFacts.text !== tracked.snapshot.text ||
          currentContext !== tracked.snapshot.context ||
          trackedContext !== tracked.snapshot.context
        ) {
          throw new WordAdapterError("SELECTION_CHANGED");
        }

        if (proposedText === tracked.snapshot.text) {
          return;
        }

        const insertedRange = workingRange.insertText(proposedText, "Replace");
        await context.sync();
        mutationCommitted = true;

        try {
          insertedRange.select("Select");
          await context.sync();
        } catch {
          // Selection is a best-effort post-commit affordance and cannot undo the mutation.
        }
      });
    } catch (error) {
      await this.tryReleaseTrackedSelection(snapshot.snapshotId, tracked);
      if (mutationCommitted) {
        return;
      }
      throw controlledWriteError(error);
    }

    await this.tryReleaseTrackedSelection(snapshot.snapshotId, tracked);
  }
}
