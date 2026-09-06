import { describe, expect, it } from "vitest";

import { WordAdapterError } from "../../src/office/WordAdapter";
import { MutableOfficeWordAdapter } from "./MutableOfficeWordAdapter";
import { MAX_SELECTION_CHARACTERS } from "../../src/office/selectionPolicy";
import { FakeOfficeWordRuntime } from "./FakeOfficeWordRuntime";

function setup(text = "Izbrano besedilo", locationId = "target-1") {
  const runtime = new FakeOfficeWordRuntime({ text, locationId });
  const adapter = new MutableOfficeWordAdapter(runtime);
  return { runtime, adapter };
}

function ooxml(body: string): string {
  return (
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office">' +
    `<w:body>${body}</w:body></w:document>`
  );
}

async function expectWordError(
  operation: Promise<unknown>,
  code: WordAdapterError["code"]
): Promise<WordAdapterError> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(WordAdapterError);
    expect(error).toMatchObject({ name: "WordAdapterError", code, message: code });
    return error as WordAdapterError;
  }
  throw new Error(`Expected WordAdapterError ${code}`);
}

describe("OfficeWordAdapter acceptance contract", () => {
  it("retains the exact capture-time Whole clone in its initial sync before later Apply", async () => {
    const { runtime, adapter } = setup("Izvor", "approved-target");

    const snapshot = await adapter.captureSelection();
    const retainedRange = runtime.lastTrackedRange!;

    expect(runtime.syncBatches[0]).toContain("track");
    expect(runtime.trackedRanges.has(retainedRange)).toBe(true);
    expect(runtime.retainedRanges.has(retainedRange)).toBe(true);
    expect(runtime.untrackCalls).toBe(0);
    expect(runtime.getRangeCalls).toHaveLength(2);
    expect(runtime.getRangeCalls[0]).toMatchObject({
      source: runtime.selectionResults[0],
      clone: retainedRange,
      rangeLocation: "Whole",
    });
    expect(runtime.getRangeCalls[0].source).not.toBe(retainedRange);
    expect(runtime.trackedRanges.has(runtime.getRangeCalls[0].source)).toBe(false);
    expect(runtime.getRangeCalls[1]).toMatchObject({
      source: retainedRange,
      rangeLocation: "Whole",
    });
    expect(runtime.getRangeCalls[1].clone).not.toBe(retainedRange);
    expect(runtime.trackedRanges.has(runtime.getRangeCalls[1].clone)).toBe(false);

    await adapter.applyReplacement(snapshot, "Predlog");

    expect(runtime.insertCalls).toEqual([
      { locationId: "approved-target", text: "Predlog", insertLocation: "Replace" },
    ]);
    expect(runtime.resumedRanges).toEqual([retainedRange, retainedRange]);
    expect(runtime.trackedRanges.has(retainedRange)).toBe(false);
    expect(runtime.retainedRanges.has(retainedRange)).toBe(false);
    expect(runtime.syncBatches.at(-1)).toEqual(["untrack"]);
  });

  it("rejects later use with InvalidObjectPath when tracking was never synced", async () => {
    const runtime = new FakeOfficeWordRuntime({ text: "Izvor" });
    const unsyncedRange = await runtime.run(async (context) => {
      const range = context.document.getSelection();
      range.track();
      return range;
    });

    await expect(runtime.runWithRange(unsyncedRange, async () => undefined)).rejects.toMatchObject({
      name: "RichApi.Error",
      code: "InvalidObjectPath",
    });
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
  });

  it.each([
    {
      name: "ordinary body text",
      options: { text: "Izvor", locationId: "body-target" },
      expectedNullObject: true,
    },
    {
      name: "text inside one table cell",
      options: {
        text: "Izvor v celici",
        locationId: "cell-target",
        bodyType: "TableCell",
        hasParentTable: true,
        hasParentTableCell: true,
      },
      expectedNullObject: false,
    },
  ])(
    "models the stale cached derived child and fresh Whole-clone correction for $name",
    async ({ options, expectedNullObject }) => {
      const runtime = new FakeOfficeWordRuntime(options);
      let retainedRange: Word.Range | undefined;

      await runtime.run(async (context) => {
        retainedRange = context.document.getSelection();
        context.trackedObjects.add(retainedRange);
        retainedRange.parentTableOrNullObject.load("isNullObject");
        await context.sync();
      });

      if (!retainedRange) {
        throw new Error("Expected retained range");
      }

      await expect(
        runtime.runWithRange(retainedRange, async (context) => {
          retainedRange!.parentTableOrNullObject.load("isNullObject");
          await context.sync();
        })
      ).rejects.toMatchObject({ name: "RichApi.Error", code: "InvalidObjectPath" });

      let freshChildIsNullObject: boolean | undefined;
      let cloneLocationRelation: Word.LocationRelation | undefined;
      await expect(
        runtime.runWithRange(retainedRange, async (context) => {
          const workingRange = retainedRange!.getRange("Whole");
          const freshChild = workingRange.parentTableOrNullObject;
          const relation = workingRange.compareLocationWith(retainedRange!);
          freshChild.load("isNullObject");
          await context.sync();
          freshChildIsNullObject = freshChild.isNullObject;
          cloneLocationRelation = relation.value;
        })
      ).resolves.toBeUndefined();

      const cloneCall = runtime.getRangeCalls.at(-1)!;
      expect(cloneCall.source).toBe(retainedRange);
      expect(cloneCall.clone).not.toBe(retainedRange);
      expect(cloneCall.rangeLocation).toBe("Whole");
      expect(cloneCall.clone.locationId).toBe(
        (retainedRange as unknown as { locationId: string }).locationId
      );
      expect(cloneLocationRelation).toBe("Equal");
      expect(freshChildIsNullObject).toBe(expectedNullObject);
      expect(runtime.searchCalls).toBe(0);
    }
  );

  it("captures only the selected text as a serializable snapshot without mutation", async () => {
    const { runtime, adapter } = setup("Živjo, Word.");

    const snapshot = await adapter.captureSelection();

    expect(snapshot).toMatchObject({
      text: "Živjo, Word.",
      characterCount: 12,
      context: "body",
    });
    expect(snapshot.snapshotId).toMatch(/^selection-\d+-1$/);
    expect(new Date(snapshot.capturedAt).toISOString()).toBe(snapshot.capturedAt);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(runtime.mutationCount).toBe(0);
    expect(runtime.trackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(1);

    await adapter.releaseSelection(snapshot);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("rejects an empty or whitespace-only selection and releases its retained range", async () => {
    const { runtime, adapter } = setup(" \n\t ");

    await expectWordError(adapter.captureSelection(), "NO_SELECTION");

    expect(runtime.trackCalls).toBe(1);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it("maps an Office capture failure to a content-free read error", async () => {
    const { runtime, adapter } = setup("Zaupna vsebina");
    runtime.failNextSync(new Error("Zaupna vsebina ne sme v napako"));

    const error = await expectWordError(adapter.captureSelection(), "WORD_READ_FAILED");

    expect(error.message).not.toContain("Zaupna");
    expect(runtime.trackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it.each([
    { length: MAX_SELECTION_CHARACTERS - 1, accepted: true },
    { length: MAX_SELECTION_CHARACTERS, accepted: true },
    { length: MAX_SELECTION_CHARACTERS + 1, accepted: false },
  ])("applies the exact $length-character selection boundary", async ({ length, accepted }) => {
    const { runtime, adapter } = setup("x".repeat(length));

    if (accepted) {
      const snapshot = await adapter.captureSelection();
      expect(snapshot.characterCount).toBe(length);
      await adapter.releaseSelection(snapshot);
    } else {
      await expectWordError(adapter.captureSelection(), "SELECTION_TOO_LARGE");
      expect(runtime.trackCalls).toBe(1);
      expect(runtime.untrackCalls).toBe(1);
      expect(runtime.trackedRanges.size).toBe(0);
      expect(runtime.retainedRanges.size).toBe(0);
    }

    expect(runtime.mutationCount).toBe(0);
  });

  it.each([
    {
      name: "a multi-cell table selection",
      options: {
        text: "Cell one\r\u0007Cell two\r\u0007",
        bodyType: "TableCell",
        hasParentTable: true,
      },
    },
    {
      name: "a range containing a table",
      options: { text: "Table", containedTableCount: 1 },
    },
    {
      name: "an inline picture range",
      options: { text: "Picture", inlinePictureCount: 1 },
    },
    {
      name: "a header selection",
      options: { text: "Header", bodyType: "Header" },
    },
  ])("rejects $name as unsupported", async ({ options }) => {
    const runtime = new FakeOfficeWordRuntime(options);
    const adapter = new MutableOfficeWordAdapter(runtime);

    await expectWordError(adapter.captureSelection(), "UNSUPPORTED_SELECTION");

    expect(runtime.trackCalls).toBe(1);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it.each([
    {
      name: "a floating drawing with a namespace-independent anchor",
      value: ooxml("<w:p><w:r><w:drawing><wp:anchor /></w:drawing></w:r></w:p>"),
    },
    {
      name: "an embedded OLE object",
      value: ooxml("<w:p><w:r><w:object><o:OLEObject /></w:object></w:r></w:p>"),
    },
    {
      name: "a legacy pict object",
      value: ooxml("<w:p><w:r><w:pict /></w:r></w:p>"),
    },
    {
      name: "a content control",
      value: ooxml("<w:sdt><w:sdtContent><w:p /></w:sdtContent></w:sdt>"),
    },
  ])("rejects OOXML containing $name", async ({ value }) => {
    const runtime = new FakeOfficeWordRuntime({ text: "Structured", ooxml: value });
    const adapter = new MutableOfficeWordAdapter(runtime);

    await expectWordError(adapter.captureSelection(), "UNSUPPORTED_SELECTION");

    expect(runtime.trackCalls).toBe(1);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it.each([
    {
      name: "x:drawing with d:anchor",
      value:
        '<x:document xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:d="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
        "<x:body><x:p><x:r><x:drawing><d:anchor /></x:drawing></x:r></x:p></x:body>" +
        "</x:document>",
    },
    {
      name: "m:sdt",
      value:
        '<m:document xmlns:m="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<m:body><m:sdt><m:sdtContent><m:p /></m:sdtContent></m:sdt></m:body>" +
        "</m:document>",
    },
  ])("rejects legitimate alternate-prefix OOXML containing $name", async ({ value }) => {
    const runtime = new FakeOfficeWordRuntime({ text: "Structured", ooxml: value });
    const adapter = new MutableOfficeWordAdapter(runtime);

    await expectWordError(adapter.captureSelection(), "UNSUPPORTED_SELECTION");

    expect(runtime.trackCalls).toBe(1);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it("rejects malformed OOXML without exposing its content", async () => {
    const runtime = new FakeOfficeWordRuntime({
      text: "Zaupno",
      ooxml: "<w:document><zaupna-vsebina></w:document>",
    });
    const adapter = new MutableOfficeWordAdapter(runtime);

    const error = await expectWordError(adapter.captureSelection(), "UNSUPPORTED_SELECTION");

    expect(error.message).not.toContain("zaupna");
    expect(runtime.trackCalls).toBe(1);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.retainedRanges.size).toBe(0);
  });

  it("accepts text wholly inside one table cell", async () => {
    const runtime = new FakeOfficeWordRuntime({
      text: "Besedilo v celici",
      bodyType: "TableCell",
      hasParentTable: true,
      hasParentTableCell: true,
    });
    const adapter = new MutableOfficeWordAdapter(runtime);

    const snapshot = await adapter.captureSelection();

    expect(snapshot.context).toBe("single-table-cell");
    await adapter.releaseSelection(snapshot);
  });

  it("replaces single-cell text without replacing the cell marker in the model", async () => {
    const runtime = new FakeOfficeWordRuntime({
      text: "Besedilo v celici",
      bodyType: "TableCell",
      hasParentTable: true,
      hasParentTableCell: true,
    });
    const adapter = new MutableOfficeWordAdapter(runtime);
    const snapshot = await adapter.captureSelection();

    await adapter.applyReplacement(snapshot, "Novo besedilo");

    expect(runtime.lastTrackedRange!.documentText).toBe("Novo besedilo\u0007");
    expect(runtime.insertCalls[0].text).not.toContain("\u0007");
    expect(runtime.insertTargets).toEqual([runtime.getRangeCalls[2].clone]);
    expect(runtime.insertTargets[0]).not.toBe(runtime.lastTrackedRange);
  });

  it("uses isolated mutation, post-commit selection, and cleanup batches", async () => {
    const { runtime, adapter } = setup("Izvor", "approved-target");
    const snapshot = await adapter.captureSelection();
    const trackedRange = runtime.lastTrackedRange!;

    await adapter.applyReplacement(snapshot, "<b>Dobesedni plain text</b>");

    expect(runtime.insertCalls).toEqual([
      {
        locationId: "approved-target",
        text: "<b>Dobesedni plain text</b>",
        insertLocation: "Replace",
      },
    ]);
    expect(runtime.selectedLocation).toBe("approved-target:Select");
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.syncBatches.slice(-3)).toEqual([["insertText"], ["select"], ["untrack"]]);
    expect(runtime.runCalls).toBe(1);
    expect(runtime.resumedRanges).toEqual([trackedRange, trackedRange]);
    const captureLocator = runtime.getRangeCalls[0];
    const captureInspection = runtime.getRangeCalls[1];
    const applyWorkingRange = runtime.getRangeCalls[2];
    expect(captureLocator).toMatchObject({
      source: runtime.selectionResults[0],
      clone: trackedRange,
      rangeLocation: "Whole",
    });
    expect(captureLocator.source).not.toBe(trackedRange);
    expect(captureInspection).toMatchObject({
      source: trackedRange,
      rangeLocation: "Whole",
    });
    expect(captureInspection.clone).not.toBe(trackedRange);
    expect(applyWorkingRange).toMatchObject({
      source: trackedRange,
      rangeLocation: "Whole",
    });
    expect(applyWorkingRange.clone).not.toBe(trackedRange);
    expect(applyWorkingRange.clone.locationId).toBe(trackedRange.locationId);
    expect(runtime.insertTargets).toEqual([applyWorkingRange.clone]);
    expect(runtime.insertTargets).not.toContain(runtime.selectionResults[1]);
    expect(runtime.selectSourceRanges).toEqual([applyWorkingRange.clone]);
    expect(runtime.untrackTargets).toEqual([trackedRange]);
    expect(runtime.trackedRanges.has(captureInspection.clone)).toBe(false);
    expect(runtime.trackedRanges.has(applyWorkingRange.clone)).toBe(false);
    expect(runtime.selectionCalls).toBe(2);
    expect(runtime.searchCalls).toBe(0);
  });

  it("reports an isolated insert failure without a confirmed mutation", async () => {
    const { runtime, adapter } = setup("Izvor");
    const snapshot = await adapter.captureSelection();
    runtime.failCommandOnce("insertText", new Error("controlled insert failure"));

    await expectWordError(adapter.applyReplacement(snapshot, "Predlog"), "WORD_WRITE_FAILED");

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.syncBatches.find((batch) => batch.includes("insertText"))).toEqual([
      "insertText",
    ]);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("keeps Apply successful when post-commit selection fails", async () => {
    const { runtime, adapter } = setup("Izvor");
    const snapshot = await adapter.captureSelection();
    runtime.failCommandOnce("select", new Error("controlled select failure"));

    await expect(adapter.applyReplacement(snapshot, "Predlog")).resolves.toBeUndefined();

    expect(runtime.insertCalls).toHaveLength(1);
    expect(runtime.selectedLocation).toBeUndefined();
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("keeps a consumed tracked reference after cleanup failure and retries release safely", async () => {
    const { runtime, adapter } = setup("Izvor");
    const snapshot = await adapter.captureSelection();
    runtime.failCommandOnce("untrack", new Error("controlled cleanup failure"));

    await expect(adapter.applyReplacement(snapshot, "Predlog")).resolves.toBeUndefined();

    expect(runtime.mutationCount).toBe(1);
    expect(runtime.trackedRanges.size).toBe(1);
    await expectWordError(adapter.applyReplacement(snapshot, "Drug predlog"), "SELECTION_CHANGED");
    expect(runtime.mutationCount).toBe(1);

    await expect(adapter.releaseSelection(snapshot)).resolves.toBeUndefined();
    expect(runtime.untrackCalls).toBe(2);
    expect(runtime.trackedRanges.size).toBe(0);
    await expect(adapter.releaseSelection(snapshot)).resolves.toBeUndefined();
    expect(runtime.untrackCalls).toBe(2);
  });

  it("shares one in-flight cleanup across concurrent release callers", async () => {
    const { runtime, adapter } = setup("Izvor");
    const snapshot = await adapter.captureSelection();
    const pausedCleanup = runtime.pauseCommandOnce("untrack");

    const firstRelease = adapter.releaseSelection(snapshot);
    await pausedCleanup.started;
    const secondRelease = adapter.releaseSelection(snapshot);

    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.runWithRangeCalls).toBe(1);
    pausedCleanup.release();

    await expect(Promise.all([firstRelease, secondRelease])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(runtime.syncBatches.filter((batch) => batch.includes("untrack"))).toHaveLength(1);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("clears a failed shared cleanup so one later release can retry", async () => {
    const { runtime, adapter } = setup("Izvor");
    const snapshot = await adapter.captureSelection();
    const pausedCleanup = runtime.pauseCommandOnce("untrack");
    runtime.failCommandOnce("untrack", new Error("controlled shared cleanup failure"));

    const firstRelease = adapter.releaseSelection(snapshot);
    await pausedCleanup.started;
    const secondRelease = adapter.releaseSelection(snapshot);
    pausedCleanup.release();
    const results = await Promise.allSettled([firstRelease, secondRelease]);

    expect(results.map(({ status }) => status)).toEqual(["rejected", "rejected"]);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({
          name: "WordAdapterError",
          code: "WORD_READ_FAILED",
          message: "WORD_READ_FAILED",
        });
      }
    }
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.runWithRangeCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(1);

    await expect(adapter.releaseSelection(snapshot)).resolves.toBeUndefined();
    expect(runtime.untrackCalls).toBe(2);
    expect(runtime.runWithRangeCalls).toBe(2);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it.each([
    {
      name: "collapsed current selection",
      selection: { text: "", locationId: "collapsed-b", isEmpty: true },
    },
    {
      name: "structurally changed current selection",
      selection: {
        text: "Drift target text.",
        locationId: "range-a",
        bodyType: "TableCell",
        hasParentTable: true,
        hasParentTableCell: true,
      },
    },
  ])("rejects a $name before the mutation queue", async ({ selection }) => {
    const { runtime, adapter } = setup("Drift target text.", "range-a");
    const rangeA = runtime.currentSelection;
    const snapshot = await adapter.captureSelection();
    const currentWitnessState = runtime.setSelection(selection);

    await expectWordError(
      adapter.applyReplacement(snapshot, "Forbidden replacement."),
      "SELECTION_CHANGED"
    );

    expect(rangeA.text).toBe("Drift target text.");
    expect(currentWitnessState.text).toBe(selection.text);
    expect(runtime.insertCalls).toEqual([]);
    expect(runtime.syncBatches.some((batch) => batch.includes("insertText"))).toBe(false);
    expect(runtime.selectCalls).toBe(0);
    expect(runtime.insertTargets).toEqual([]);
    expect(runtime.selectSourceRanges).toEqual([]);
    expect(runtime.searchCalls).toBe(0);
  });

  it("does not mutate when the proposed text equals the captured text", async () => {
    const { runtime, adapter } = setup("Nespremenjeno");
    const snapshot = await adapter.captureSelection();

    await adapter.applyReplacement(snapshot, snapshot.text);

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("rejects identical text selected at another location without mutation", async () => {
    const { runtime, adapter } = setup("Ponovljeno besedilo", "approved-target");
    const snapshot = await adapter.captureSelection();
    runtime.setSelection({ text: snapshot.text, locationId: "other-target" });

    await expectWordError(
      adapter.applyReplacement(snapshot, "Napačna zamenjava"),
      "SELECTION_CHANGED"
    );

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.insertTargets).toEqual([]);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.untrackTargets).toEqual([runtime.lastTrackedRange]);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.selectionCalls).toBe(2);
    expect(runtime.searchCalls).toBe(0);
  });

  it("rejects document drift inside the tracked target without mutation", async () => {
    const { runtime, adapter } = setup("Prvotno", "approved-target");
    const snapshot = await adapter.captureSelection();
    runtime.lastTrackedRange!.text = "Spremenjeno v dokumentu";

    await expectWordError(adapter.applyReplacement(snapshot, "Predlog"), "SELECTION_CHANGED");

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.untrackCalls).toBe(1);
  });

  it("rejects structural drift between Capture and Apply without mutation", async () => {
    const { runtime, adapter } = setup("Prvotno", "approved-target");
    const snapshot = await adapter.captureSelection();
    runtime.lastTrackedRange!.ooxml = ooxml(
      "<w:p><w:r><w:drawing><wp:anchor /></w:drawing></w:r></w:p>"
    );

    await expectWordError(adapter.applyReplacement(snapshot, "Predlog"), "SELECTION_CHANGED");

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("maps an Office validation failure to a content-free error and releases the range", async () => {
    const { runtime, adapter } = setup("Zaupna vsebina");
    const snapshot = await adapter.captureSelection();
    runtime.failNextSync(new Error("Zaupna vsebina ne sme v napako"));

    const error = await expectWordError(
      adapter.applyReplacement(snapshot, "Predlog"),
      "WORD_WRITE_FAILED"
    );

    expect(error.message).not.toContain("Zaupna");
    expect(runtime.mutationCount).toBe(0);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("releases a discarded snapshot and makes later Apply fail closed", async () => {
    const { runtime, adapter } = setup();
    const snapshot = await adapter.captureSelection();

    await adapter.releaseSelection(snapshot);
    await expectWordError(adapter.applyReplacement(snapshot, "Predlog"), "SELECTION_CHANGED");

    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
    expect(runtime.mutationCount).toBe(0);
  });

  it("rejects an unknown token without mutation", async () => {
    const { runtime, adapter } = setup();
    const snapshot = await adapter.captureSelection();

    await expectWordError(
      adapter.applyReplacement({ ...snapshot, snapshotId: "unknown-token" }, "Predlog"),
      "SELECTION_CHANGED"
    );

    expect(runtime.mutationCount).toBe(0);
    await adapter.releaseSelection(snapshot);
  });

  it("rejects a NUL-bearing replacement without mutation and releases the range", async () => {
    const { runtime, adapter } = setup();
    const snapshot = await adapter.captureSelection();

    await expectWordError(
      adapter.applyReplacement(snapshot, "Neveljaven\u0000predlog"),
      "WORD_WRITE_FAILED"
    );

    expect(runtime.mutationCount).toBe(0);
    expect(runtime.untrackCalls).toBe(1);
    expect(runtime.trackedRanges.size).toBe(0);
  });

  it("models queued partial Office execution and stops after a failed command", async () => {
    const runtime = new FakeOfficeWordRuntime({ text: "Izvor" });
    const range = runtime.currentSelection;
    runtime.failCommandOnce("select", new Error("controlled middle-command failure"));

    const batch = runtime.run(async (context) => {
      const insertedRange = range.insertText("Predlog", "Replace");
      insertedRange.select("Select");
      range.untrack();
      expect(runtime.mutationCount).toBe(0);
      await context.sync();
    });

    await expect(batch).rejects.toThrow("controlled middle-command failure");
    expect(runtime.mutationCount).toBe(1);
    expect(runtime.selectedLocation).toBeUndefined();
    expect(runtime.commandLog).toContain("executed:insertText");
    expect(runtime.commandLog).toContain("failed:select");
    expect(runtime.commandLog).not.toContain("executed:untrack");
  });
});
