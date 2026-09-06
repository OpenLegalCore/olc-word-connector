/* global Document */

import { enUSMessages, type MessageCatalog } from "./messages.en-US";
import { slSIMessages } from "./messages.sl-SI";

export type UiLocale = "en-US" | "sl-SI";

export interface LocaleSources {
  readonly officeDisplayLanguage?: string | null;
  readonly navigatorLanguage?: string | null;
}

const catalogs: Readonly<Record<UiLocale, MessageCatalog>> = {
  "en-US": enUSMessages,
  "sl-SI": slSIMessages,
};

export function normalizeUiLocale(value: string | null | undefined): UiLocale | undefined {
  if (!value || value.trim() !== value) {
    return undefined;
  }
  let canonicalLocale: string;
  try {
    const canonicalLocales = Intl.getCanonicalLocales(value);
    if (canonicalLocales.length !== 1) {
      return undefined;
    }
    canonicalLocale = canonicalLocales[0];
  } catch {
    return undefined;
  }
  const language = canonicalLocale.split("-", 1)[0].toLowerCase();
  if (language === "sl") {
    return "sl-SI";
  }
  if (language === "en") {
    return "en-US";
  }
  return undefined;
}

export function resolveUiLocale(sources: LocaleSources): UiLocale {
  return (
    normalizeUiLocale(sources.officeDisplayLanguage) ??
    normalizeUiLocale(sources.navigatorLanguage) ??
    "en-US"
  );
}

export function messagesFor(locale: UiLocale): MessageCatalog {
  return catalogs[locale];
}

export function applyDocumentLocale(document: Document, locale: UiLocale): void {
  document.documentElement.lang = locale;
  document.title = messagesFor(locale).chrome.documentTitle;
}

export function messageKeyPaths(catalog: MessageCatalog): readonly string[] {
  const keys: string[] = [];
  const visit = (value: object, prefix: string): void => {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === "string" || typeof child === "function") {
        keys.push(path);
      } else {
        visit(child as object, path);
      }
    }
  };
  visit(catalog, "");
  return keys.sort();
}

export { enUSMessages, slSIMessages };
export type { MessageCatalog };
