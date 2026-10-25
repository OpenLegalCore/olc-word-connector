import { describe, expect, it } from "vitest";
import { SyntheticProposalWord } from "./SyntheticProposalWord";

describe("synthetic document preview (not native Word acceptance)", () => {
  it("keeps surrounding text and models an undo/redo cycle for an exact replacement", async () => {
    const word = new SyntheticProposalWord();
    const original = word.documentText;
    await word.documentWriter.applyReplacement(await word.captureSelection(), "Predlog");
    expect(word.documentText).toBe("UVOD — Predlog — ZAKLJUČEK");
    word.undo();
    expect(word.documentText).toBe(original);
    word.redo();
    expect(word.documentText).toBe("UVOD — Predlog — ZAKLJUČEK");
  });
  it("does not overwrite another selection and inserts only after an explicit cursor placement", async () => {
    const word = new SyntheticProposalWord();
    const original = word.documentText;
    await expect(word.documentWriter.insertAtCursor("Dodatek")).rejects.toMatchObject({
      code: "CURSOR_REQUIRED",
    });
    expect(word.documentText).toBe(original);
    word.choose("cursor");
    await word.documentWriter.insertAtCursor("Dodatek");
    expect(word.documentText).toBe(original + "Dodatek");
    word.undo();
    expect(word.documentText).toBe(original);
    word.redo();
    expect(word.documentText).toBe(original + "Dodatek");
  });
});
