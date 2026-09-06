/* global Event, HTMLInputElement, HTMLOptionElement, HTMLSelectElement, document, globalThis, window */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindTaskPaneStateGallery, galleryWidths } from "./taskPaneGallery";
import { galleryFixtureOrder, galleryFixtures } from "./taskPaneGalleryFixtures";

function renderGalleryControls(): void {
  document.body.innerHTML = `
    <select id="gallery-state"></select>
    <select id="gallery-width"></select>
    <output id="gallery-current-state"></output>
    <div id="gallery-pane"></div>
  `;
}

beforeEach(() => {
  renderGalleryControls();
  window.history.replaceState({}, "", "/harness.html?state=result&width=280");
});

afterEach(() => vi.unstubAllGlobals());

describe("development-only beta state gallery", () => {
  it("marks every beta acceptance fixture as STAGING", () => {
    for (const fixtureId of [
      "backend-selection",
      "connected-no-context",
      "connected-selected-text",
      "searching",
      "result",
      "session-expired",
    ] as const) {
      expect(galleryFixtures[fixtureId].environment).toBe("STAGING");
    }
  });

  it("exposes only current beta fixtures at all locked widths", () => {
    bindTaskPaneStateGallery(document, window);
    expect(
      Array.from(
        document.querySelectorAll<HTMLOptionElement>("#gallery-state option"),
        (option) => option.value
      )
    ).toEqual(galleryFixtureOrder);
    expect(
      Array.from(document.querySelectorAll<HTMLOptionElement>("#gallery-width option"), (option) =>
        Number(option.value)
      )
    ).toEqual(galleryWidths);
    expect(document.getElementById("gallery-pane")?.dataset.fixtureState).toBe("result");
  });

  it("switches fixtures without Word, HTTP, storage, or mutation adapters", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    bindTaskPaneStateGallery(document, window);
    const state = document.getElementById("gallery-state") as HTMLSelectElement;
    const pane = document.getElementById("gallery-pane")!;

    for (const [fixtureId, contextValue, boundaryMessage] of [
      ["connected-no-context", "none", "No document content will be read or sent."],
      [
        "connected-selected-text",
        "selected-text",
        "Only the exact selection will be read and sent when you start the search.",
      ],
    ] as const) {
      state.value = fixtureId;
      state.dispatchEvent(new Event("change"));
      expect(pane.dataset.fixtureState).toBe(fixtureId);
      expect(pane.querySelector(".olc-workspace-title")?.textContent).toBe("Search legal sources");
      expect(pane.querySelector<HTMLInputElement>(`input[value="${contextValue}"]`)?.checked).toBe(
        true
      );
      expect(pane.querySelector(".olc-action-region-message")?.textContent).toBe(boundaryMessage);
      expect(pane.querySelector(".olc-environment")?.textContent).toBe("STAGING");
      expect(pane.querySelector("[data-action-id='search']")).not.toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect((globalThis as { Office?: unknown }).Office).toBeUndefined();
  });

  it("renders safe answer and recovery fixtures without old rewrite actions", () => {
    bindTaskPaneStateGallery(document, window);
    const pane = document.getElementById("gallery-pane")!;
    expect(pane.textContent).toContain("Answer ready");
    expect(pane.querySelector(".olc-legal-sources h2")?.textContent).toBe("Sources");
    expect(pane.querySelectorAll("a")).toHaveLength(2);
    expect(pane.textContent).not.toMatch(/Apply to document|Proposed|Regenerate|Discard/);

    const state = document.getElementById("gallery-state") as HTMLSelectElement;
    state.value = "session-expired";
    state.dispatchEvent(new Event("change"));
    expect(pane.textContent).toContain("Open secure sign-in");
    expect(galleryFixtures.error.notice?.role).toBe("alert");
  });
});
