import { describe, expect, it } from "vitest";
import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import { FakeOfficeWordRuntime } from "./FakeOfficeWordRuntime";

describe("production document writer boundaries", () => {
  it("replaces only the retained original range and consumes it", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Original", locationId: "original" });
    const adapter = new OfficeWordAdapter(host);
    const snapshot = await adapter.captureSelection();
    await adapter.applyReplacement(snapshot, "Proposal");
    expect(host.insertCalls).toEqual([
      { locationId: "original", text: "Proposal", insertLocation: "Replace" },
    ]);
    expect(host.searchCalls).toBe(0);
    await expect(adapter.applyReplacement(snapshot, "Duplicate")).rejects.toMatchObject({
      code: "SELECTION_CHANGED",
    });
    expect(host.mutationCount).toBe(1);
  });
  it("rejects format-only drift even when the visible text is unchanged", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Original" });
    const adapter = new OfficeWordAdapter(host);
    const snapshot = await adapter.captureSelection();
    host.currentSelection.ooxml = host.currentSelection.ooxml.replace(
      "<w:r>",
      "<w:r><w:rPr><w:b/></w:rPr>"
    );
    await expect(adapter.applyReplacement(snapshot, "Proposal")).rejects.toMatchObject({
      code: "SELECTION_CHANGED",
    });
    expect(host.mutationCount).toBe(0);
  });
  it("rejects another occurrence of identical text instead of retargeting", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Same", locationId: "original" });
    const adapter = new OfficeWordAdapter(host);
    const snapshot = await adapter.captureSelection();
    host.setSelection({ text: "Same", locationId: "other" });
    await expect(adapter.applyReplacement(snapshot, "Proposal")).rejects.toMatchObject({
      code: "SELECTION_CHANGED",
    });
    expect(host.mutationCount).toBe(0);
  });
  it("fails closed when the original retained target is lost", async () => {
    const host = new FakeOfficeWordRuntime({ text: "Original" });
    const adapter = new OfficeWordAdapter(host);
    const snapshot = await adapter.captureSelection();
    host.retainedRanges.clear();
    await expect(adapter.applyReplacement(snapshot, "Proposal")).rejects.toBeDefined();
    expect(host.mutationCount).toBe(0);
  });
  it("inserts only at an empty click-time cursor, using Start and never Replace", async () => {
    const host = new FakeOfficeWordRuntime({ text: "", isEmpty: true, locationId: "cursor" });
    const adapter = new OfficeWordAdapter(host);
    await adapter.insertAtCursor("Literal <tag> [Z1]");
    expect(host.insertCalls).toEqual([
      { locationId: "cursor", text: "Literal <tag> [Z1]", insertLocation: "Start" },
    ]);
    expect(host.trackCalls).toBe(0);
    expect(host.searchCalls).toBe(0);
  });
  it.each([{ text: "other selection" }, { text: "", isEmpty: true, bodyType: "Header" }])(
    "does not overwrite another selection or unsupported story",
    async (options) => {
      const host = new FakeOfficeWordRuntime(options);
      const adapter = new OfficeWordAdapter(host);
      await expect(adapter.insertAtCursor("Proposal")).rejects.toBeDefined();
      expect(host.mutationCount).toBe(0);
    }
  );
});
