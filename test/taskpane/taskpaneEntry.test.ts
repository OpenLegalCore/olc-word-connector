import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type OfficeReadyInfo = { host: string; platform: string };
type OfficeReadyCallback = (info: OfficeReadyInfo) => void;
type TaskPaneEntryModule = typeof import("../../src/taskpane/taskpane.js");

const originalOffice = Object.getOwnPropertyDescriptor(globalThis, "Office");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalWord = Object.getOwnPropertyDescriptor(globalThis, "Word");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installOffice(options: {
  readonly displayLanguage?: string;
  readonly onReady?: unknown;
}): void {
  Object.defineProperty(globalThis, "Office", {
    configurable: true,
    value: {
      context: { displayLanguage: options.displayLanguage },
      HostType: { Word: "Word" },
      onReady: options.onReady,
    },
  });
}

function installWordRunSpy() {
  const run = vi.fn();
  Object.defineProperty(globalThis, "Word", {
    configurable: true,
    value: { run },
  });
  return run;
}

function installNavigator(value: Navigator | (() => never) | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, "navigator");
    return;
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    ...(typeof value === "function" ? { get: value } : { value }),
  });
}

async function importEntry(): Promise<TaskPaneEntryModule> {
  const entry = await import("../../src/taskpane/taskpane.js");
  await Promise.resolve();
  await Promise.resolve();
  return entry;
}

beforeEach(() => {
  vi.resetModules();
  document.documentElement.lang = "";
  document.title = "OpenLegalCore";
  document.body.innerHTML =
    '<div id="taskpane-root" data-view-state="locale-pending"><p>OpenLegalCore</p></div>';
});

afterEach(() => {
  if (originalOffice) {
    Object.defineProperty(globalThis, "Office", originalOffice);
  } else {
    Reflect.deleteProperty(globalThis, "Office");
  }
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
  if (originalWord) {
    Object.defineProperty(globalThis, "Word", originalWord);
  } else {
    Reflect.deleteProperty(globalThis, "Word");
  }
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
  vi.restoreAllMocks();
});

describe("production task-pane entry initialization", () => {
  it("keeps the bootstrap language-neutral until Office readiness resolves", async () => {
    installNavigator({ language: "sl-SI" } as Navigator);
    installOffice({
      onReady: vi.fn(() => new Promise<OfficeReadyInfo>(() => undefined)),
    });

    await importEntry();

    expect(document.getElementById("taskpane-root")?.dataset.viewState).toBe("locale-pending");
    expect(document.body.textContent).toBe("OpenLegalCore");
    expect(document.body.textContent).not.toMatch(/Opening|Odpiranje|Unsupported|Nepodprto/);
  });

  it("renders a deterministic English unsupported state when Office and navigator are missing", async () => {
    installNavigator(undefined);
    Reflect.deleteProperty(globalThis, "Office");

    await importEntry();

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe("unsupported");
    expect(document.body.textContent).toContain("Open this add-in in Microsoft Word");
  });

  it("does not read browser storage while resolving the bootstrap locale", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("storage must not be read");
      },
    });
    installNavigator({ language: "en-US" } as Navigator);
    installOffice({
      displayLanguage: "sl-SI",
      onReady: vi.fn((callback?: OfficeReadyCallback) => {
        const info = { host: "Word", platform: "OfficeOnline" };
        callback?.(info);
        return Promise.resolve(info);
      }),
    });

    await expect(importEntry()).resolves.toBeDefined();

    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");
    expect(document.body.textContent).not.toContain("storage must not be read");
  });

  it("resolves the environment locale again after a fresh bootstrap", async () => {
    installNavigator({ language: "sl-SI" } as Navigator);
    installOffice({
      displayLanguage: "en-US",
      onReady: vi.fn((callback?: OfficeReadyCallback) => {
        const info = { host: "Word", platform: "OfficeOnline" };
        callback?.(info);
        return Promise.resolve(info);
      }),
    });

    await importEntry();
    document.querySelector<HTMLButtonElement>('button[data-action-id="toggle-settings"]')!.click();
    const slovenian = document.querySelector<HTMLInputElement>(
      'input[name="olc-ui-language"][value="sl-SI"]'
    )!;
    slovenian.checked = true;
    slovenian.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.documentElement.lang).toBe("sl-SI");

    vi.resetModules();
    document.body.innerHTML =
      '<div id="taskpane-root" data-view-state="locale-pending"><p>OpenLegalCore</p></div>';
    await importEntry();

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe(
      "backend-selection"
    );
  });

  it.each([
    ["missing", undefined],
    ["non-callable", { invalid: true }],
  ])("fails safely when Office.onReady is %s", async (_label, onReady) => {
    installNavigator({ language: "sl-SI" } as Navigator);
    installOffice({ displayLanguage: "sl-SI", ...(onReady === undefined ? {} : { onReady }) });
    const wordRun = installWordRunSpy();
    const fetch = vi.spyOn(globalThis, "fetch");

    const entry = await importEntry();

    expect(entry.getProductionWordAdapter()).toBeUndefined();
    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe("unsupported");
    expect(document.body.textContent).toContain("Odprite ta dodatek v programu Microsoft Word");
    expect(document.body.textContent).not.toBe("OpenLegalCore");
    expect(wordRun).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("initializes the Word runtime only once when readiness calls back more than once", async () => {
    let readyCallback: OfficeReadyCallback | undefined;
    installNavigator({ language: "en-US" } as Navigator);
    installOffice({
      displayLanguage: "en-US",
      onReady: vi.fn((callback?: OfficeReadyCallback) => {
        readyCallback = callback;
        return Promise.resolve({ host: "Word", platform: "OfficeOnline" });
      }),
    });
    const wordRun = installWordRunSpy();
    const fetch = vi.spyOn(globalThis, "fetch");

    const entry = await importEntry();
    const info = { host: "Word", platform: "OfficeOnline" };
    readyCallback?.(info);
    const firstAdapter = entry.getProductionWordAdapter();
    readyCallback?.(info);

    expect(firstAdapter).toBeDefined();
    expect(entry.getProductionWordAdapter()).toBe(firstAdapter);
    expect(document.querySelectorAll('.olc-app[data-view-state="backend-selection"]')).toHaveLength(
      1
    );
    expect(document.querySelectorAll('button[data-action-id^="select-"]')).toHaveLength(2);
    expect(wordRun).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "%%%%"],
    ["unsupported", "fr-FR"],
  ])(
    "uses English through the real entry bootstrap for a %s navigator locale",
    async (_label, language) => {
      installNavigator({ language } as Navigator);
      installOffice({
        onReady: vi.fn((callback?: OfficeReadyCallback) => {
          const info = { host: "Word", platform: "OfficeOnline" };
          callback?.(info);
          return Promise.resolve(info);
        }),
      });
      const wordRun = installWordRunSpy();
      const fetch = vi.spyOn(globalThis, "fetch");

      await importEntry();

      expect(document.documentElement.lang).toBe("en-US");
      expect(document.title).toBe("OpenLegalCore for Word");
      expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe(
        "backend-selection"
      );
      expect(document.body.textContent).toContain("Choose a legal source service");
      expect(wordRun).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("uses English when navigator.language throws during the real Word bootstrap", async () => {
    installNavigator(() => {
      throw new Error("sensitive navigator value");
    });
    installOffice({
      onReady: vi.fn((callback?: OfficeReadyCallback) => {
        const info = { host: "Word", platform: "OfficeOnline" };
        callback?.(info);
        return Promise.resolve(info);
      }),
    });
    const wordRun = installWordRunSpy();
    const fetch = vi.spyOn(globalThis, "fetch");

    await importEntry();

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe(
      "backend-selection"
    );
    expect(document.body.textContent).not.toContain("sensitive navigator value");
    expect(wordRun).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails safely when navigator.language and Office.onReady registration throw", async () => {
    installNavigator(() => {
      throw new Error("sensitive navigator failure");
    });
    installOffice({
      onReady: vi.fn(() => {
        throw new Error("sensitive registration failure");
      }),
    });

    await importEntry();

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe("unsupported");
    expect(document.body.textContent).not.toMatch(/sensitive|failure/i);
  });

  it("uses the safe localized unsupported state when the Office readiness promise rejects", async () => {
    installNavigator({ language: "en-US" } as Navigator);
    installOffice({
      displayLanguage: "sl-Latn-SI",
      onReady: vi.fn(() => Promise.reject(new Error("sensitive readiness failure"))),
    });

    await importEntry();

    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");
    expect(document.body.textContent).toContain("Odprite ta dodatek v programu Microsoft Word");
    expect(document.body.textContent).not.toContain("sensitive readiness failure");
  });

  it("contains an initialization callback failure without leaving a brand-only screen", async () => {
    let readyCallback: OfficeReadyCallback | undefined;
    installNavigator({ language: "en-US" } as Navigator);
    installOffice({
      displayLanguage: "sl-SI",
      onReady: vi.fn((callback) => {
        readyCallback = callback;
        return Promise.resolve({ host: "Word", platform: "PC" });
      }),
    });
    await importEntry();

    expect(() => readyCallback?.(undefined as unknown as OfficeReadyInfo)).not.toThrow();

    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe("unsupported");
    expect(document.body.textContent).toContain("Vsebina dokumenta ni bila prebrana");
  });

  it.each([
    ["unsupported host", "Excel", "unsupported"],
    ["supported Word host", "Word", "backend-selection"],
  ])("renders the localized safe state for an %s", async (_label, host, state) => {
    installNavigator({ language: "en-US" } as Navigator);
    installOffice({
      displayLanguage: "sl-SI",
      onReady: vi.fn((callback) => {
        const info = { host, platform: "OfficeOnline" };
        callback?.(info);
        return Promise.resolve(info);
      }),
    });

    await importEntry();

    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");
    expect(document.querySelector(".olc-app")?.getAttribute("data-view-state")).toBe(state);
    expect(document.body.textContent).not.toBe("OpenLegalCore");
  });
});
