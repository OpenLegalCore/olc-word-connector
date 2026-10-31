import { describe, expect, it } from "vitest";
import { FakeOfficeWordRuntime } from "../office/FakeOfficeWordRuntime";
import { createReadOnlyReplaceProbe } from "./ReadOnlyReplaceProbe";

describe("read-only Replace probe — fake-runtime unit checks, not owner reproduction", () => {
  it("retains the exact first OOXML triple and its observation without further host reads", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same", locationId: "original" });
    const probe = createReadOnlyReplaceProbe(host);
    expect(probe.readOoxml()).toBeUndefined();
    const originalOoxml = host.currentSelection.ooxml;
    await probe.capture();
    const observedOoxml = originalOoxml.replace("<w:r>", "<w:r><w:rPr><w:b/></w:rPr>");
    host.currentSelection.ooxml = observedOoxml;
    const observation = await probe.inspect();
    const commandsBeforeRead = [...host.commandLog];
    const evidence = probe.readOoxml();
    expect(evidence).toEqual({
      observation,
      originalOoxml,
      currentOoxml: observedOoxml,
      targetOoxml: observedOoxml,
    });
    expect(observation.ooxmlMatches).toEqual({
      current: false,
      target: false,
      currentTarget: true,
    });
    expect(observation.firstFailure).toBe("current-ooxml");
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(host.commandLog).toEqual(commandsBeforeRead);
    host.currentSelection.ooxml = originalOoxml;
    expect((await probe.inspect()).firstFailure).toBeUndefined();
    expect(probe.readOoxml()).toBe(evidence);
    expect(evidence?.observation.firstFailure).toBe("current-ooxml");
    expect(JSON.stringify(observation)).not.toContain(originalOoxml);
    expect(host.mutationCount).toBe(0);
    expect(host.untrackCalls).toBe(0);
    await probe.release();
    expect(probe.readOoxml()).toBe(evidence);
    await probe.capture();
    expect(probe.readOoxml()).toBeUndefined();
    await probe.release();
  });

  it("distinguishes current from retained target in the same validation sync", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same", locationId: "original" });
    const probe = createReadOnlyReplaceProbe(host);
    await probe.capture();
    const originalOoxml = host.currentSelection.ooxml;
    const currentOoxml = originalOoxml.replace("<w:r>", "<w:r><w:rPr><w:i/></w:rPr>");
    host.setSelection({ text: "Same", locationId: "original", ooxml: currentOoxml });
    const result = await probe.inspect();
    expect(result).toMatchObject({
      location: "Equal",
      textMatches: { current: true, target: true },
      ooxmlMatches: { current: false, target: true, currentTarget: false },
      firstFailure: "current-ooxml",
    });
    expect(probe.readOoxml()).toMatchObject({
      originalOoxml,
      currentOoxml,
      targetOoxml: originalOoxml,
    });
    expect(host.mutationCount).toBe(0);
    expect(host.untrackCalls).toBe(0);
    await probe.release();
  });

  it("collects every equality without writing, consuming or releasing before observation", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Synthetic original", locationId: "original" });
    const probe = createReadOnlyReplaceProbe(host);
    await probe.capture();
    const result = await probe.inspect();
    expect(result).toMatchObject({
      scope: "NEW_DIAGNOSTIC_CAPTURE_NOT_HISTORICAL_APPLY",
      exists: true,
      lifecycle: "active",
      snapshotFields: {
        snapshotId: true,
        text: true,
        characterCount: true,
        context: true,
        capturedAt: true,
      },
      location: "Equal",
      currentValidation: { context: "body" },
      targetValidation: { context: "body" },
      textMatches: { current: true, target: true },
      ooxmlMatches: { current: true, target: true },
      stoppedBeforeInsertText: true,
    });
    expect(result.firstFailure).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("Synthetic original");
    expect(host.mutationCount).toBe(0);
    expect(host.insertCalls).toEqual([]);
    expect(host.selectCalls).toBe(0);
    expect(host.searchCalls).toBe(0);
    expect(host.untrackCalls).toBe(0);
    expect(await probe.inspect()).toEqual(result);
    await probe.release();
    expect(host.untrackCalls).toBe(1);
    expect(await probe.inspect()).toMatchObject({ exists: false, firstFailure: "tracked-missing" });
    expect(host.mutationCount).toBe(0);
  });

  it.each([
    {
      name: "another occurrence",
      selection: { text: "Same", locationId: "other" },
      failure: "location",
    },
    {
      name: "collapsed range",
      selection: { text: "", isEmpty: true, locationId: "other" },
      failure: "location",
    },
    {
      name: "changed current text",
      selection: { text: "Changed", locationId: "original" },
      failure: "current-text",
    },
    {
      name: "unsupported current structure",
      selection: { text: "Same", locationId: "original", inlinePictureCount: 1 },
      failure: "current-validation",
    },
  ])("reports $name in production order without writing", async ({ selection, failure }) => {
    const host = new FakeOfficeWordRuntime({ text: "Same", locationId: "original" });
    const probe = createReadOnlyReplaceProbe(host);
    await probe.capture();
    host.setSelection(selection);
    expect(await probe.inspect()).toMatchObject({ firstFailure: failure, lifecycle: "active" });
    expect(host.untrackCalls).toBe(0);
    expect(host.mutationCount).toBe(0);
    await probe.release();
  });

  it("reports exact OOXML mismatch while both texts and location match, without normalizing", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same", locationId: "original" });
    const probe = createReadOnlyReplaceProbe(host);
    await probe.capture();
    host.currentSelection.ooxml = host.currentSelection.ooxml.replace(
      "<w:r>",
      "<w:r><w:rPr><w:b/></w:rPr>"
    );
    expect(await probe.inspect()).toMatchObject({
      location: "Equal",
      textMatches: { current: true, target: true },
      ooxmlMatches: { current: false, target: false },
      firstFailure: "current-ooxml",
      lifecycle: "active",
    });
    expect(host.untrackCalls).toBe(0);
    expect(host.mutationCount).toBe(0);
    await probe.release();
  });

  it("reports the actual failing sync stage before cleanup, omitting exception messages", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same" });
    const probe = createReadOnlyReplaceProbe(host);
    await probe.capture();
    host.failNextSync(Object.assign(new Error("private message"), { code: "InvalidObjectPath" }));
    const result = await probe.inspect();
    expect(result).toMatchObject({
      lifecycle: "active",
      firstFailure: "exception",
      exception: { stage: "validation-sync", name: "Error", code: "InvalidObjectPath" },
    });
    expect(JSON.stringify(result)).not.toContain("private message");
    expect(probe.readOoxml()).toBeUndefined();
    expect(host.untrackCalls).toBe(0);
    expect(host.mutationCount).toBe(0);
    await probe.release();
  });

  it("distinguishes no capture, missing entry and a consumed entry left by failed cleanup", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same" });
    const probe = createReadOnlyReplaceProbe(host);
    expect(await probe.inspect()).toMatchObject({ firstFailure: "no-diagnostic-capture" });
    await probe.capture();
    host.failCommandOnce("untrack", new Error("controlled cleanup failure"));
    await expect(probe.release()).rejects.toBeDefined();
    expect(await probe.inspect()).toMatchObject({
      exists: true,
      lifecycle: "consumed",
      firstFailure: "tracked-consumed",
    });
    await probe.release();
    expect(await probe.inspect()).toMatchObject({ exists: false, firstFailure: "tracked-missing" });
    expect(host.mutationCount).toBe(0);
  });
});
