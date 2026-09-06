import { WordAdapterError, type SelectionSnapshot } from "./WordAdapter";

export const MAX_SELECTION_CHARACTERS = 20_000;

export interface SelectionFacts {
  readonly text: string;
  readonly isEmpty: boolean;
  readonly bodyType: string;
  readonly hasParentTable: boolean;
  readonly hasParentTableCell: boolean;
  readonly containedTableCount: number;
  readonly inlinePictureCount: number;
  readonly hasUnsupportedEmbeddedStructure: boolean;
}

export function validateSelection(facts: SelectionFacts): SelectionSnapshot["context"] {
  if (facts.isEmpty || facts.text.trim().length === 0) {
    throw new WordAdapterError("NO_SELECTION");
  }

  if (facts.text.length > MAX_SELECTION_CHARACTERS) {
    throw new WordAdapterError("SELECTION_TOO_LARGE");
  }

  if (
    facts.text.includes("\u0007") ||
    facts.containedTableCount > 0 ||
    facts.inlinePictureCount > 0 ||
    facts.hasUnsupportedEmbeddedStructure
  ) {
    throw new WordAdapterError("UNSUPPORTED_SELECTION");
  }

  if (facts.bodyType === "MainDoc" && !facts.hasParentTable && !facts.hasParentTableCell) {
    return "body";
  }

  if (facts.bodyType === "TableCell" && facts.hasParentTable && facts.hasParentTableCell) {
    return "single-table-cell";
  }

  throw new WordAdapterError("UNSUPPORTED_SELECTION");
}
