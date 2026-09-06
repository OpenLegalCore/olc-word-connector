import { describe, expect, it } from "vitest";

import {
  applyDocumentLocale,
  enUSMessages,
  messageKeyPaths,
  messagesFor,
  normalizeUiLocale,
  resolveUiLocale,
  slSIMessages,
} from "../../src/taskpane/i18n";
import {
  createInitializingViewModel,
  createUnsupportedViewModel,
} from "../../src/taskpane/taskPaneCopy";

describe("task-pane i18n catalogs", () => {
  it("keeps exact semantic key parity without per-key fallback", () => {
    const englishKeys = messageKeyPaths(enUSMessages);
    const slovenianKeys = messageKeyPaths(slSIMessages);

    expect(englishKeys).toHaveLength(116);
    expect(slovenianKeys).toHaveLength(116);
    expect(slovenianKeys).toEqual(englishKeys);
    expect(messagesFor("sl-SI")).toBe(slSIMessages);
    expect(messagesFor("en-US")).toBe(enUSMessages);
    expect(englishKeys).toContain("ready.heading");
    expect(enUSMessages.ready.heading).toBe("Search legal sources");
    expect(englishKeys).toContain("ready.searchAction");
    expect(enUSMessages.ready.searchAction).toBe("Search legal sources");
    expect(slSIMessages.ready.heading).toBe("Iskanje pravnih virov");
    expect(slSIMessages.ready.searchAction).toBe("Išči pravne vire");
    expect(slSIMessages.chrome.brandName).toBe("OpenLegalCore za Word");
  });

  it.each([
    ["sl", "sl-SI"],
    ["sl-SI", "sl-SI"],
    ["sl-Latn-SI", "sl-SI"],
    ["SL-us", "sl-SI"],
    ["en", "en-US"],
    ["en-US", "en-US"],
    ["en-GB", "en-US"],
    ["EN-ca", "en-US"],
  ] as const)("normalizes supported Office/browser locale %s to %s", (input, expected) => {
    expect(normalizeUiLocale(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    "",
    "de-DE",
    "sl_",
    "sl_SI",
    "sl-",
    "sl--x",
    "en-💥",
    " sl-SI",
    "en-US ",
  ])("does not guess an unsupported or ambiguous locale: %s", (input) => {
    expect(normalizeUiLocale(input)).toBeUndefined();
  });

  it("resolves Office, navigator, then en-US deterministically", () => {
    expect(
      resolveUiLocale({
        officeDisplayLanguage: "sl-AT",
        navigatorLanguage: "en-GB",
      })
    ).toBe("sl-SI");
    expect(
      resolveUiLocale({
        officeDisplayLanguage: "en-GB",
        navigatorLanguage: "sl-SI",
      })
    ).toBe("en-US");
    expect(resolveUiLocale({ officeDisplayLanguage: "de-DE", navigatorLanguage: "en-GB" })).toBe(
      "en-US"
    );
    expect(resolveUiLocale({ officeDisplayLanguage: "de-DE", navigatorLanguage: "fr-FR" })).toBe(
      "en-US"
    );
    expect(resolveUiLocale({ officeDisplayLanguage: "sl-", navigatorLanguage: "en-GB" })).toBe(
      "en-US"
    );
    expect(
      resolveUiLocale({ officeDisplayLanguage: "en-💥", navigatorLanguage: "sl-Latn-SI" })
    ).toBe("sl-SI");
  });

  it("keeps all interpolated catalog messages locale-specific and typed", () => {
    expect(enUSMessages.settings.languageChanged("English")).toBe("Language changed to English.");
    expect(slSIMessages.settings.languageChanged("Slovenščina")).toBe(
      "Izbrani jezik: Slovenščina."
    );
    expect(enUSMessages.connecting.statusLabel("OLC Engine")).toBe("Checking OLC Engine");
    expect(slSIMessages.connecting.statusLabel("OLC Engine")).toBe(
      "Preverjanje storitve OLC Engine"
    );
    expect(enUSMessages.ready.connectedStatus("Open WebUI")).toBe("Open WebUI connected");
    expect(slSIMessages.ready.connectedStatus("Open WebUI")).toBe("Open WebUI je povezan");
    expect(enUSMessages.connectionError.statusLabel("Open WebUI")).toBe(
      "Open WebUI is unavailable"
    );
    expect(slSIMessages.connectionError.statusLabel("Open WebUI")).toBe(
      "Storitev Open WebUI ni na voljo"
    );
  });

  it("applies exact HTML language and localized document title", () => {
    applyDocumentLocale(document, "sl-SI");
    expect(document.documentElement.lang).toBe("sl-SI");
    expect(document.title).toBe("Dodatek OpenLegalCore za Microsoft Word");

    applyDocumentLocale(document, "en-US");
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("OpenLegalCore for Word");
  });

  it("localizes initializing and unsupported host models without changing technical tokens", () => {
    const initializing = createInitializingViewModel("STAGING", slSIMessages);
    const unsupported = createUnsupportedViewModel("DEVELOPMENT", slSIMessages);

    expect(initializing.heading).toBe("Odpiranje dodatka OpenLegalCore …");
    expect(initializing.description).toBe(
      "Preverjanje Wordovega okolja in priprava varnostne meje dokumenta."
    );
    expect(initializing.eyebrow).toBe("ZAGON DODATKA");
    expect(initializing.footer.eyebrow).toBe("OKOLJE WORD");
    expect(unsupported.eyebrow).toBe("MEJA OKOLJA");
    expect(unsupported.heading).toContain("dodatek");
    expect(unsupported.description).toContain("programa Microsoft Word");
    expect(initializing.environment).toBe("STAGING");
    expect(unsupported.environment).toBe("DEVELOPMENT");
  });
});
