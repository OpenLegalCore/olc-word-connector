import { beforeEach, describe, expect, it } from "vitest";

import { createReadyViewModel, environmentForHostname } from "../../src/taskpane/taskPaneCopy";
import { TaskPaneView } from "../../src/taskpane/TaskPaneView";
import type { TaskPaneViewModel } from "../../src/taskpane/taskPaneViewModel";

function root(): HTMLElement {
  return document.getElementById("taskpane-root")!;
}

function render(model: TaskPaneViewModel): HTMLElement {
  new TaskPaneView(root()).render(model);
  return root();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="taskpane-root"></div>';
});

describe("production-real task-pane foundation", () => {
  it("renders the truthful legal-source shell without rewrite actions", () => {
    const rendered = render(createReadyViewModel());

    expect(rendered.querySelector(".olc-product-title")?.textContent).toBe("OpenLegalCore");
    expect(rendered.querySelector("h1")?.textContent).toBe("Search legal sources");
    expect(rendered.textContent).toContain("Slovenian legislation and case law");
    expect(rendered.textContent).not.toMatch(/Apply to document|Proposed|Regenerate|Discard/);
    expect(rendered.querySelectorAll("button")).toHaveLength(0);
  });

  it("shows only development and staging environment badges", () => {
    expect(environmentForHostname("localhost")).toBe("DEVELOPMENT");
    expect(environmentForHostname("127.0.0.1")).toBe("DEVELOPMENT");
    expect(environmentForHostname("word-staging.example.invalid")).toBe("STAGING");
    expect(environmentForHostname("word.openlegalcore.org")).toBeUndefined();
    expect(
      render(createReadyViewModel("STAGING")).querySelector(".olc-environment")?.textContent
    ).toBe("STAGING");
  });
});

describe("safe shared rendering", () => {
  it("renders untrusted strings as text and exposes radio choices accessibly", () => {
    const unsafe = '<img src=x onerror="window.fixtureExecuted=true">';
    const rendered = render({
      ...createReadyViewModel("DEVELOPMENT"),
      id: "safe-text-test",
      choiceGroup: {
        name: "context",
        label: "Context",
        choices: [
          { value: "none", label: "No document context", checked: true },
          { value: "selected", label: "Selected text" },
        ],
      },
      notice: { title: unsafe, message: unsafe, tone: "danger", role: "alert" },
    });

    expect(rendered.querySelector("img[src='x']")).toBeNull();
    expect(rendered.textContent).toContain(unsafe);
    expect(rendered.querySelector("fieldset legend")?.textContent).toBe("Context");
    expect(rendered.querySelector<HTMLInputElement>('input[value="none"]')?.checked).toBe(true);
    expect(rendered.querySelector("[role='alert']")).not.toBeNull();
  });
});

describe("production language settings", () => {
  it("uses an accessible native disclosure and preserves focus across a locale change", () => {
    const view = new TaskPaneView(root());
    const model = createReadyViewModel("STAGING");
    let currentLocale: "en-US" | "sl-SI" = "en-US";
    const handleLocale = (locale: "en-US" | "sl-SI"): void => {
      currentLocale = locale;
      view.configureLocale(locale, handleLocale);
      view.render(model);
    };
    view.configureLocale(currentLocale, handleLocale);
    view.render(model);

    const gear = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="toggle-settings"]'
    )!;
    expect(gear.type).toBe("button");
    expect(gear.title).toBe("Settings");
    expect(gear.getAttribute("aria-expanded")).toBe("false");
    expect(gear.getAttribute("aria-controls")).toBe("olc-settings-popover");
    expect(gear.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    gear.click();
    const dialog = root().querySelector<HTMLElement>("#olc-settings-popover")!;
    const english = dialog.querySelector<HTMLInputElement>('input[value="en-US"]')!;
    expect(dialog.hidden).toBe(false);
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(english.checked).toBe(true);
    expect(document.activeElement).toBe(english);

    const slovenian = dialog.querySelector<HTMLInputElement>('input[value="sl-SI"]')!;
    slovenian.checked = true;
    slovenian.dispatchEvent(new Event("change", { bubbles: true }));

    expect(currentLocale).toBe("sl-SI");
    expect(root().querySelector("#olc-settings-heading")?.textContent).toBe("Nastavitve");
    expect(root().querySelector("[aria-live='polite'].olc-sr-only")?.textContent).toBe(
      "Izbrani jezik: Slovenščina."
    );
    expect(document.activeElement).toBe(
      root().querySelector<HTMLInputElement>('input[value="sl-SI"]')
    );

    root().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const currentGear = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="toggle-settings"]'
    )!;
    expect(root().querySelector<HTMLElement>("#olc-settings-popover")?.hidden).toBe(true);
    expect(currentGear.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(currentGear);
  });

  it("closes by explicit action or outside click without moving outside focus", () => {
    const view = new TaskPaneView(root());
    const renderLocalized = (locale: "en-US" | "sl-SI"): void => {
      view.configureLocale(locale, renderLocalized);
      view.render(createReadyViewModel("STAGING"));
    };
    renderLocalized("en-US");

    root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();
    root().querySelector<HTMLButtonElement>('button[data-action-id="close-settings"]')!.click();
    expect(root().querySelector<HTMLElement>("#olc-settings-popover")?.hidden).toBe(true);
    expect(document.activeElement).toBe(
      root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')
    );

    root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();
    const currentLanguage = root().querySelector<HTMLInputElement>(
      'input[name="olc-ui-language"]:checked'
    )!;
    currentLanguage.focus();
    root().querySelector<HTMLElement>(".olc-brand")!.click();
    expect(root().querySelector<HTMLElement>("#olc-settings-popover")?.hidden).toBe(true);
    expect(document.activeElement).toBe(currentLanguage);
  });

  it("restores the equivalent focused settings control after an asynchronous render", () => {
    const view = new TaskPaneView(root());
    view.configureLocale("en-US", () => undefined);
    view.render(createReadyViewModel("STAGING"));
    root().querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();

    const close = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="close-settings"]'
    )!;
    close.focus();
    view.render({ ...createReadyViewModel("STAGING"), id: "async-update" });

    const currentClose = root().querySelector<HTMLButtonElement>(
      'button[data-action-id="close-settings"]'
    )!;
    expect(close.isConnected).toBe(false);
    expect(document.activeElement).toBe(currentClose);
    expect(document.activeElement).not.toBe(document.body);

    const english = root().querySelector<HTMLInputElement>('input[value="en-US"]')!;
    english.focus();
    view.render({ ...createReadyViewModel("STAGING"), id: "second-async-update" });
    expect(document.activeElement).toBe(
      root().querySelector<HTMLInputElement>('input[value="en-US"]')
    );
  });
});
