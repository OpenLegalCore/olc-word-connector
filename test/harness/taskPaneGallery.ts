import canonicalMarkUrl from "../../assets/openlegalcore-mark-80.png";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import {
  galleryFixtureOrder,
  galleryFixtures,
  isGalleryFixtureId,
  type GalleryFixtureId,
} from "./taskPaneGalleryFixtures";

export const galleryWidths = [280, 329, 400, 520] as const;
type GalleryWidth = (typeof galleryWidths)[number];

function isGalleryWidth(value: number): value is GalleryWidth {
  return galleryWidths.includes(value as GalleryWidth);
}

function stateFromUrl(window: Window): GalleryFixtureId {
  const value = new URLSearchParams(window.location.search).get("state") ?? "runtime-ready";
  return isGalleryFixtureId(value) ? value : "runtime-ready";
}

function widthFromUrl(window: Window): GalleryWidth {
  const value = Number(new URLSearchParams(window.location.search).get("width") ?? 329);
  return isGalleryWidth(value) ? value : 329;
}

export function bindTaskPaneStateGallery(document: Document, window: Window): void {
  const stateSelect = document.getElementById("gallery-state") as HTMLSelectElement | null;
  const widthSelect = document.getElementById("gallery-width") as HTMLSelectElement | null;
  const pane = document.getElementById("gallery-pane");
  const stateOutput = document.getElementById("gallery-current-state");
  if (!stateSelect || !widthSelect || !pane || !stateOutput) {
    throw new Error("Development state gallery controls are unavailable.");
  }

  for (const fixtureId of galleryFixtureOrder) {
    const option = document.createElement("option");
    option.value = fixtureId;
    option.textContent = fixtureId;
    stateSelect.append(option);
  }

  for (const width of galleryWidths) {
    const option = document.createElement("option");
    option.value = String(width);
    option.textContent = `${width}px`;
    widthSelect.append(option);
  }

  const view = new TaskPaneView(pane, canonicalMarkUrl);
  const render = (state: GalleryFixtureId, width: GalleryWidth, updateUrl: boolean): void => {
    stateSelect.value = state;
    widthSelect.value = String(width);
    pane.style.width = `${width}px`;
    pane.dataset.fixtureState = state;
    pane.dataset.fixtureWidth = String(width);
    stateOutput.textContent = `${state} · ${width}px`;
    view.render(galleryFixtures[state]);

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("state", state);
      url.searchParams.set("width", String(width));
      window.history.replaceState({}, "", url);
    }
  };

  stateSelect.addEventListener("change", () => {
    const state = isGalleryFixtureId(stateSelect.value) ? stateSelect.value : "runtime-ready";
    render(state, Number(widthSelect.value) as GalleryWidth, true);
  });
  widthSelect.addEventListener("change", () => {
    const width = Number(widthSelect.value);
    render(
      isGalleryFixtureId(stateSelect.value) ? stateSelect.value : "runtime-ready",
      isGalleryWidth(width) ? width : 329,
      true
    );
  });

  render(stateFromUrl(window), widthFromUrl(window), false);
}
