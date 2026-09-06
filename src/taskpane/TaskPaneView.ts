/* global Document, HTMLButtonElement, HTMLElement, HTMLElementTagNameMap, HTMLInputElement, HTMLTextAreaElement, KeyboardEvent */

import { messagesFor, type UiLocale } from "./i18n";
import { createSafeLegalAnswer } from "./safeLegalAnswer";
import type {
  TaskPaneAction,
  TaskPaneFieldFixture,
  TaskPaneTone,
  TaskPaneViewModel,
} from "./taskPaneViewModel";

const canonicalMark = "/assets/office/1.0.0.2/openlegalcore-mark-80.png";

type SettingsFocusTarget =
  { readonly kind: "language"; readonly locale: UiLocale } | { readonly kind: "close" };

function focusWithoutScroll(control: HTMLElement | null | undefined): void {
  try {
    control?.focus({ preventScroll: true });
  } catch {
    control?.focus();
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tagName: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function appendToneClass(node: HTMLElement, tone: TaskPaneTone): void {
  node.classList.add(`olc-tone-${tone}`);
}

function createAction(document: Document, action: TaskPaneAction): HTMLButtonElement {
  const button = element(
    document,
    "button",
    `olc-action olc-action-${action.variant}`,
    action.label
  );
  button.type = "button";
  button.dataset.actionId = action.id;
  button.disabled = action.disabled ?? false;
  return button;
}

function createActions(
  document: Document,
  actions: readonly TaskPaneAction[],
  availableActionsLabel: string
): HTMLElement {
  const group = element(document, "div", "olc-actions");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", availableActionsLabel);
  for (const action of actions) {
    group.append(createAction(document, action));
  }
  return group;
}

function createSectionHeading(
  document: Document,
  heading: string,
  requestInputLabel: string
): HTMLElement {
  const header = element(document, "header", "olc-section-heading");
  header.append(element(document, "p", "olc-metadata", requestInputLabel));
  header.append(element(document, "h2", "olc-section-title", heading));
  return header;
}

function createField(document: Document, field: TaskPaneFieldFixture): HTMLElement {
  const wrapper = element(document, "div", "olc-field");
  const label = element(document, "label", "olc-field-label", field.label);
  label.htmlFor = field.id;
  wrapper.append(label);

  const helpId = field.help ? `${field.id}-help` : undefined;
  if (field.kind === "textarea") {
    const textarea = element(document, "textarea", "olc-input") as HTMLTextAreaElement;
    textarea.id = field.id;
    textarea.value = field.value;
    textarea.readOnly = field.readOnly ?? true;
    textarea.rows = 5;
    textarea.placeholder = field.placeholder ?? "";
    if (helpId) {
      textarea.setAttribute("aria-describedby", helpId);
    }
    wrapper.append(textarea);
  } else {
    const input = element(document, "input", "olc-input") as HTMLInputElement;
    input.id = field.id;
    input.type = field.kind === "password" ? "password" : "text";
    input.value = field.value;
    input.readOnly = field.readOnly ?? true;
    input.autocomplete = "off";
    input.placeholder = field.placeholder ?? "";
    if (helpId) {
      input.setAttribute("aria-describedby", helpId);
    }
    wrapper.append(input);
  }
  if (field.help && helpId) {
    const help = element(document, "p", "olc-field-help", field.help);
    help.id = helpId;
    wrapper.append(help);
  }
  return wrapper;
}

function createChoiceGroup(document: Document, model: TaskPaneViewModel): HTMLElement | undefined {
  if (!model.choiceGroup) {
    return undefined;
  }
  const fieldset = element(document, "fieldset", "olc-choice-group");
  fieldset.append(element(document, "legend", "olc-field-label", model.choiceGroup.label));
  for (const choice of model.choiceGroup.choices) {
    const label = element(document, "label", "olc-choice");
    const input = element(document, "input") as HTMLInputElement;
    input.type = "radio";
    input.name = model.choiceGroup.name;
    input.value = choice.value;
    input.checked = choice.checked ?? false;
    label.append(input, document.createTextNode(choice.label));
    fieldset.append(label);
  }
  return fieldset;
}

function createNotice(document: Document, model: TaskPaneViewModel): HTMLElement | undefined {
  if (!model.notice) {
    return undefined;
  }
  const notice = element(document, "section", "olc-notice");
  appendToneClass(notice, model.notice.tone);
  if (model.notice.role) {
    notice.setAttribute("role", model.notice.role);
  }
  notice.append(element(document, "p", "olc-notice-title", model.notice.title));
  notice.append(element(document, "p", "olc-notice-copy", model.notice.message));
  return notice;
}

export class TaskPaneView {
  private actionHandler?: (actionId: string) => void;
  private locale: UiLocale = "en-US";
  private localeChangeHandler?: (locale: UiLocale) => void;
  private settingsOpen = false;
  private focusLanguageControl = false;
  private languageAnnouncement = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly markUrl = canonicalMark,
    actionHandler?: (actionId: string) => void
  ) {
    this.actionHandler = actionHandler;
    this.root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof this.root.ownerDocument.defaultView!.Element)) {
        return;
      }
      const action = target.closest<HTMLButtonElement>("button[data-action-id]");
      if (!action || action.disabled || !this.root.contains(action)) {
        if (this.settingsOpen && !target.closest(".olc-settings-popover")) {
          this.setSettingsOpen(false, false);
        }
        return;
      }
      const actionId = action.dataset.actionId;
      if (actionId === "toggle-settings") {
        this.setSettingsOpen(!this.settingsOpen, false);
        return;
      }
      if (actionId === "close-settings") {
        this.setSettingsOpen(false, true);
        return;
      }
      if (this.settingsOpen && !action.closest(".olc-settings-popover")) {
        this.setSettingsOpen(false, false);
      }
      if (actionId) {
        this.actionHandler?.(actionId);
      }
    });
    this.root.addEventListener("keydown", (event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape" && this.settingsOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.setSettingsOpen(false, true);
      }
    });
    this.root.addEventListener("change", (event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) ||
        target.name !== "olc-ui-language" ||
        !target.checked ||
        (target.value !== "en-US" && target.value !== "sl-SI") ||
        target.value === this.locale
      ) {
        return;
      }
      this.locale = target.value;
      const messages = messagesFor(this.locale);
      const language =
        this.locale === "sl-SI" ? messages.settings.slovenian : messages.settings.english;
      this.languageAnnouncement = messages.settings.languageChanged(language);
      this.focusLanguageControl = true;
      this.localeChangeHandler?.(this.locale);
    });
  }

  setActionHandler(actionHandler: ((actionId: string) => void) | undefined): void {
    this.actionHandler = actionHandler;
  }

  configureLocale(locale: UiLocale, handler?: (locale: UiLocale) => void): void {
    this.locale = locale;
    this.localeChangeHandler = handler;
  }

  hasFocusedSettingsControl(): boolean {
    const panel = this.root.querySelector<HTMLElement>("#olc-settings-popover");
    return Boolean(this.settingsOpen && panel?.contains(this.root.ownerDocument.activeElement));
  }

  private captureSettingsFocusTarget(): SettingsFocusTarget | undefined {
    if (!this.hasFocusedSettingsControl()) {
      return undefined;
    }
    const activeElement = this.root.ownerDocument.activeElement;
    if (
      activeElement instanceof HTMLInputElement &&
      activeElement.name === "olc-ui-language" &&
      (activeElement.value === "en-US" || activeElement.value === "sl-SI")
    ) {
      return { kind: "language", locale: activeElement.value };
    }
    if (
      activeElement instanceof HTMLButtonElement &&
      activeElement.dataset.actionId === "close-settings"
    ) {
      return { kind: "close" };
    }
    return undefined;
  }

  private restoreSettingsFocus(target: SettingsFocusTarget): void {
    const control =
      target.kind === "language"
        ? this.root.querySelector<HTMLInputElement>(
            `input[name="olc-ui-language"][value="${target.locale}"]`
          )
        : this.root.querySelector<HTMLButtonElement>('button[data-action-id="close-settings"]');
    focusWithoutScroll(control);
  }

  private setSettingsOpen(open: boolean, returnFocus: boolean): void {
    this.settingsOpen = open;
    const gear = this.root.querySelector<HTMLButtonElement>(
      'button[data-action-id="toggle-settings"]'
    );
    const panel = this.root.querySelector<HTMLElement>("#olc-settings-popover");
    gear?.setAttribute("aria-expanded", String(open));
    if (panel) {
      panel.hidden = !open;
    }
    if (open) {
      const current = panel?.querySelector<HTMLInputElement>(
        `input[name="olc-ui-language"][value="${this.locale}"]`
      );
      focusWithoutScroll(current);
    } else if (returnFocus) {
      focusWithoutScroll(gear);
    }
  }

  private createSettings(document: Document): readonly [HTMLElement, HTMLElement] {
    const messages = messagesFor(this.locale);
    const controls = element(document, "div", "olc-header-actions");
    const gear = element(document, "button", "olc-settings-trigger") as HTMLButtonElement;
    gear.type = "button";
    gear.dataset.actionId = "toggle-settings";
    gear.title = messages.settings.open;
    gear.setAttribute("aria-label", messages.settings.open);
    gear.setAttribute("aria-expanded", String(this.settingsOpen));
    gear.setAttribute("aria-controls", "olc-settings-popover");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("olc-settings-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M19.14 12.94a7.8 7.8 0 0 0 .05-.94 7.8 7.8 0 0 0-.05-.94l2.03-1.58-1.92-3.32-2.39.96a7.2 7.2 0 0 0-1.63-.94L14.87 3h-3.74l-.36 3.18a7.2 7.2 0 0 0-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.8 7.8 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.05.7 1.63.94l.36 3.18h3.74l.36-3.18a7.2 7.2 0 0 0 1.63-.94l2.39.96 1.92-3.32-2.03-1.58ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
    );
    icon.append(path);
    gear.append(icon);
    controls.append(gear);

    const panel = element(document, "section", "olc-settings-popover");
    panel.id = "olc-settings-popover";
    panel.hidden = !this.settingsOpen;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "olc-settings-heading");
    const heading = element(document, "h2", "olc-settings-heading", messages.settings.title);
    heading.id = "olc-settings-heading";
    const fieldset = element(document, "fieldset", "olc-settings-languages");
    fieldset.append(element(document, "legend", "olc-field-label", messages.settings.language));
    const languageOptions: ReadonlyArray<readonly [UiLocale, string]> = [
      ["sl-SI", messages.settings.slovenian],
      ["en-US", messages.settings.english],
    ];
    for (const [locale, labelText] of languageOptions) {
      const label = element(document, "label", "olc-choice olc-settings-language");
      const input = element(document, "input") as HTMLInputElement;
      input.type = "radio";
      input.name = "olc-ui-language";
      input.value = locale;
      input.checked = this.locale === locale;
      label.append(input, document.createTextNode(labelText));
      fieldset.append(label);
    }
    const close = element(
      document,
      "button",
      "olc-action olc-action-quiet olc-settings-close",
      messages.settings.close
    ) as HTMLButtonElement;
    close.type = "button";
    close.dataset.actionId = "close-settings";
    panel.append(heading, fieldset, close);
    return [controls, panel];
  }

  render(model: TaskPaneViewModel): void {
    const document = this.root.ownerDocument;
    const settingsFocusTarget = this.captureSettingsFocusTarget();
    const messages = messagesFor(this.locale);
    const app = element(document, "div", "olc-app");
    app.dataset.viewState = model.id;
    app.setAttribute("aria-busy", String(model.busy ?? false));

    const header = element(document, "header", "olc-app-header");
    const brand = element(document, "div", "olc-brand");
    const mark = element(document, "img", "olc-brand-mark");
    mark.src = this.markUrl;
    mark.alt = messages.chrome.brandImageAlt;
    mark.width = 26;
    mark.height = 26;
    brand.append(mark, element(document, "p", "olc-product-title", messages.chrome.brandName));
    header.append(brand);
    if (this.localeChangeHandler) {
      const [headerControls, settings] = this.createSettings(document);
      if (model.environment) {
        headerControls.prepend(element(document, "span", "olc-environment", model.environment));
      }
      header.append(headerControls, settings);
      const announcement = element(document, "p", "olc-sr-only", this.languageAnnouncement);
      announcement.setAttribute("role", "status");
      announcement.setAttribute("aria-live", "polite");
      announcement.setAttribute("aria-atomic", "true");
      header.append(announcement);
      this.languageAnnouncement = "";
    } else if (model.environment) {
      header.append(element(document, "span", "olc-environment", model.environment));
    }

    const status = element(document, "section", "olc-status-row");
    appendToneClass(status, model.status.tone);
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const statusSymbol = element(document, "span", "olc-status-symbol", model.busy ? "↻" : "•");
    statusSymbol.setAttribute("aria-hidden", "true");
    const statusText = element(document, "div", "olc-status-copy");
    statusText.append(element(document, "strong", "olc-status-label", model.status.label));
    statusText.append(element(document, "span", "olc-metadata", model.status.detail));
    status.append(statusSymbol, statusText);
    if (model.status.action) {
      const action = createAction(document, model.status.action);
      action.classList.add("olc-status-action");
      status.append(action);
    }
    if (model.busy) {
      const busyRule = element(document, "span", "olc-busy-rule");
      busyRule.setAttribute("aria-hidden", "true");
      status.append(busyRule);
    }

    const main = element(document, "main", "olc-workspace");
    main.id = "olc-workspace";
    main.setAttribute("aria-labelledby", "olc-workspace-heading");
    main.setAttribute("aria-busy", String(model.busy ?? false));
    const introduction = element(document, "section", "olc-introduction");
    if (model.eyebrow) {
      introduction.append(element(document, "p", "olc-metadata", model.eyebrow));
    }
    const heading = element(document, "h1", "olc-workspace-title", model.heading);
    heading.id = "olc-workspace-heading";
    introduction.append(heading);
    if (model.description) {
      introduction.append(element(document, "p", "olc-workspace-copy", model.description));
    }
    main.append(introduction);

    if (model.legalAnswer !== undefined) {
      main.append(
        createSafeLegalAnswer(document, model.legalAnswer, {
          answerAriaLabel: messages.chrome.answerAriaLabel,
          sourcesHeading: messages.chrome.sourcesHeading,
        })
      );
    }
    const choices = createChoiceGroup(document, model);
    if (choices) {
      main.append(choices);
    }
    if (model.fields?.length) {
      const fields = element(document, "section", "olc-section olc-fields");
      fields.append(
        createSectionHeading(
          document,
          messages.chrome.questionSection,
          messages.chrome.requestInput
        )
      );
      for (const field of model.fields) {
        fields.append(createField(document, field));
      }
      main.append(fields);
    }
    const notice = createNotice(document, model);
    if (notice) {
      main.append(notice);
    }
    if (model.actions?.length) {
      main.append(createActions(document, model.actions, messages.chrome.availableActions));
    }

    const footer = element(document, "footer", "olc-action-region");
    const footerCopy = element(document, "div", "olc-action-region-copy");
    footerCopy.append(element(document, "p", "olc-metadata", model.footer.eyebrow));
    footerCopy.append(element(document, "p", "olc-action-region-message", model.footer.message));
    footer.append(footerCopy);
    if (model.footer.actions?.length) {
      footer.append(
        createActions(document, model.footer.actions, messages.chrome.availableActions)
      );
    }

    app.append(header, status, main, footer);
    this.root.replaceChildren(app);
    if (this.focusLanguageControl) {
      this.focusLanguageControl = false;
      const current = this.root.querySelector<HTMLInputElement>(
        `input[name="olc-ui-language"][value="${this.locale}"]`
      );
      focusWithoutScroll(current);
    } else if (settingsFocusTarget) {
      this.restoreSettingsFocus(settingsFocusTarget);
    }
  }
}
