import { afterEach, describe, expect, it, vi } from "vitest";

import { OfficeWordAdapter } from "../../src/office/OfficeWordAdapter";
import { WordAdapterError } from "../../src/office/WordAdapter";

const originalOffice = Object.getOwnPropertyDescriptor(globalThis, "Office");

afterEach(() => {
  if (originalOffice) {
    Object.defineProperty(globalThis, "Office", originalOffice);
  } else {
    Reflect.deleteProperty(globalThis, "Office");
  }
  vi.restoreAllMocks();
});

function installOfficeEvents(status: "succeeded" | "failed") {
  let selectionHandler: (() => void) | undefined;
  const addHandlerAsync = vi.fn(
    (_event: string, handler: () => void, callback: (result: { status: string }) => void) => {
      selectionHandler = handler;
      callback({ status });
    }
  );
  const removeHandlerAsync = vi.fn();
  Object.defineProperty(globalThis, "Office", {
    configurable: true,
    value: {
      context: { document: { addHandlerAsync, removeHandlerAsync } },
      EventType: { DocumentSelectionChanged: "DocumentSelectionChanged" },
      AsyncResultStatus: { Succeeded: "succeeded" },
    },
  });
  return { addHandlerAsync, removeHandlerAsync, emit: () => selectionHandler?.() };
}

describe("OfficeWordAdapter selection events", () => {
  it("subscribes to the Word document event and removes only its own handler", async () => {
    const office = installOfficeEvents("succeeded");
    const listener = vi.fn();
    const adapter = new OfficeWordAdapter();

    const unsubscribe = await adapter.subscribeToSelectionChanges(listener);
    office.emit();
    unsubscribe();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(office.addHandlerAsync).toHaveBeenCalledTimes(1);
    expect(office.removeHandlerAsync).toHaveBeenCalledTimes(1);
    expect(office.removeHandlerAsync.mock.calls[0][1]).toEqual({
      handler: office.addHandlerAsync.mock.calls[0][1],
    });
  });

  it("fails closed when Word rejects event registration", async () => {
    installOfficeEvents("failed");
    const adapter = new OfficeWordAdapter();

    await expect(adapter.subscribeToSelectionChanges(() => undefined)).rejects.toEqual(
      new WordAdapterError("WORD_READ_FAILED")
    );
  });
});
