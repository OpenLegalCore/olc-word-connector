/* global document, location, navigator, Office */

import { OfficeWordAdapter } from "../office/OfficeWordAdapter";
import type { WordAdapter } from "../office/WordAdapter";
import {
  createInitializingViewModel,
  createUnsupportedViewModel,
  environmentForHostname,
} from "./taskPaneCopy";
import {
  createProductionTaskPaneRuntime,
  type ProductionTaskPaneRuntime,
} from "./ProductionTaskPaneRuntime";
import { applyDocumentLocale, messagesFor, resolveUiLocale, type UiLocale } from "./i18n";
import { TaskPaneView } from "./TaskPaneView";

declare const __OLC_WORD_MODEL_ID__: string;

let productionWordAdapter: WordAdapter | undefined;
let productionTaskPaneRuntime: ProductionTaskPaneRuntime | undefined;

export function getProductionWordAdapter(): WordAdapter | undefined {
  return productionWordAdapter;
}

const root = document.getElementById("taskpane-root");
if (!root) {
  throw new Error("Task-pane root is unavailable.");
}
const taskPaneRoot = root;

const view = new TaskPaneView(taskPaneRoot);
const environment = environmentForHostname(safeHostname());

function safeHostname(): string {
  try {
    return typeof location === "undefined" ? "" : location.hostname;
  } catch {
    return "";
  }
}

function navigatorLanguage(): string | undefined {
  try {
    const language = typeof navigator === "undefined" ? undefined : navigator.language;
    return typeof language === "string" ? language : undefined;
  } catch {
    return undefined;
  }
}

function configuredModelId(): string | undefined {
  return typeof __OLC_WORD_MODEL_ID__ === "string" ? __OLC_WORD_MODEL_ID__ : undefined;
}

function officeDisplayLanguage(): string | undefined {
  try {
    const language = Office.context?.displayLanguage;
    return typeof language === "string" ? language : undefined;
  } catch {
    return undefined;
  }
}

let locale: UiLocale = "en-US";
let renderBeforeRuntime = (): void =>
  view.render(createInitializingViewModel(environment, messagesFor(locale)));

function applyLocale(nextLocale: UiLocale): void {
  locale = nextLocale;
  applyDocumentLocale(document, locale);
  view.configureLocale(locale, applyLocale);
  renderBeforeRuntime();
}

let officeRegistrationFailed = false;
let officeReadyHandled = false;

function resolvedLocale(): UiLocale {
  return resolveUiLocale({
    officeDisplayLanguage: officeDisplayLanguage(),
    navigatorLanguage: navigatorLanguage(),
  });
}

function renderUnsupportedState(): void {
  productionTaskPaneRuntime?.dispose();
  productionTaskPaneRuntime = undefined;
  productionWordAdapter = undefined;
  renderBeforeRuntime = () =>
    view.render(createUnsupportedViewModel(environment, messagesFor(locale)));
  applyLocale(resolvedLocale());
  officeReadyHandled = true;
}

function handleOfficeReady(info: { host: Office.HostType; platform: Office.PlatformType }): void {
  if (officeRegistrationFailed || officeReadyHandled) {
    return;
  }
  try {
    applyLocale(resolvedLocale());
    if (info.host !== Office.HostType.Word) {
      renderUnsupportedState();
      return;
    }

    productionWordAdapter = new OfficeWordAdapter();
    productionTaskPaneRuntime = createProductionTaskPaneRuntime(
      taskPaneRoot,
      productionWordAdapter,
      environment,
      view,
      { initialLocale: locale, modelId: configuredModelId() }
    );
    productionTaskPaneRuntime.start();
    officeReadyHandled = true;
  } catch {
    renderUnsupportedState();
  }
}

function registerOfficeReady(): void {
  let readyPromise: Promise<{ host: Office.HostType; platform: Office.PlatformType }>;
  try {
    if (typeof Office === "undefined") {
      officeRegistrationFailed = true;
      renderUnsupportedState();
      return;
    }
    const onReady = Office.onReady;
    if (typeof onReady !== "function") {
      officeRegistrationFailed = true;
      renderUnsupportedState();
      return;
    }
    readyPromise = onReady.call(Office, handleOfficeReady);
  } catch {
    officeRegistrationFailed = true;
    renderUnsupportedState();
    return;
  }
  try {
    void Promise.resolve(readyPromise).catch(() => {
      if (!officeReadyHandled) {
        officeRegistrationFailed = true;
        renderUnsupportedState();
      }
    });
  } catch {
    officeRegistrationFailed = true;
    renderUnsupportedState();
  }
}

registerOfficeReady();
