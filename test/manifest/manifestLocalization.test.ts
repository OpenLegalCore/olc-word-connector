import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const manifestPaths = [
  "manifest.xml",
  "manifests/manifest.dev.xml",
  "manifests/manifest.stage.xml",
  "manifests/manifest.prod.xml",
] as const;

const officeAppNamespace = "http://schemas.microsoft.com/office/appforoffice/1.1";
const officeBasicTypesNamespace = "http://schemas.microsoft.com/office/officeappbasictypes/1.0";

const contracts = {
  "manifest.xml": {
    id: "7eb3a8cf-4fa9-47f2-a408-afe5f6c59515",
    origin: "https://localhost:3002",
    permission: "ReadWriteDocument",
    englishDisplayName: "OpenLegalCore for Word",
    englishDescription: "Microsoft Word connector for OpenLegalCore.",
    displayName: "OpenLegalCore za Word",
    description: "Dodatek OpenLegalCore za Microsoft Word.",
    getStartedTitle: "OpenLegalCore za Word je pripravljen",
  },
  "manifests/manifest.dev.xml": {
    id: "7eb3a8cf-4fa9-47f2-a408-afe5f6c59515",
    origin: "https://localhost:3002",
    permission: "ReadWriteDocument",
    englishDisplayName: "OpenLegalCore for Word",
    englishDescription: "Microsoft Word connector for OpenLegalCore.",
    displayName: "OpenLegalCore za Word",
    description: "Dodatek OpenLegalCore za Microsoft Word.",
    getStartedTitle: "OpenLegalCore za Word je pripravljen",
  },
  "manifests/manifest.stage.xml": {
    id: "d913b3fe-90e7-4bc9-86d2-d391ea0a7fd1",
    origin: "https://word-staging.example.invalid",
    permission: "ReadDocument",
    englishDisplayName: "OpenLegalCore for Word (Staging)",
    englishDescription: "Staging Microsoft Word connector for OpenLegalCore.",
    displayName: "OpenLegalCore za Word (Staging)",
    description: "Dodatek OpenLegalCore za Microsoft Word (Staging).",
    getStartedTitle: "OpenLegalCore za Word (Staging) je pripravljen",
  },
  "manifests/manifest.prod.xml": {
    id: "d8008df4-dd56-4150-9ed5-69a59ccd4889",
    origin: "https://word.openlegalcore.org",
    permission: "ReadDocument",
    englishDisplayName: "OpenLegalCore for Word",
    englishDescription: "Microsoft Word connector for OpenLegalCore.",
    displayName: "OpenLegalCore za Word",
    description: "Dodatek OpenLegalCore za Microsoft Word.",
    getStartedTitle: "OpenLegalCore za Word je pripravljen",
  },
} as const;

const sharedTranslations = {
  "GetStarted.Description": "Dodatek je pripravljen. Odprite podokno na zavihku Osnovno.",
  "TaskpaneButton.Label": "Odpri OpenLegalCore",
  "TaskpaneButton.Tooltip": "Odpri podokno OpenLegalCore",
} as const;

function parseManifest(path: (typeof manifestPaths)[number]): {
  document: Document;
  source: string;
} {
  const source = readFileSync(path, "utf8");
  const document = new DOMParser().parseFromString(source, "application/xml");
  expect(document.getElementsByTagName("parsererror")).toHaveLength(0);
  return { document, source };
}

function elementByTag(document: Document, name: string): Element {
  const elements = document.getElementsByTagName(name);
  expect(elements).toHaveLength(1);
  return elements[0];
}

function rootElementByName(document: Document, name: string): Element {
  const element = Array.from(document.documentElement.children).find(
    (child) => child.localName === name
  );
  expect(element, name).toBeDefined();
  return element!;
}

function resourceString(document: Document, id: string): Element {
  const resource = Array.from(document.getElementsByTagName("bt:String")).find(
    (element) => element.getAttribute("id") === id
  );
  expect(resource, id).toBeDefined();
  return resource!;
}

function directOverrides(element: Element): Element[] {
  return Array.from(element.children).filter((child) => child.localName === "Override");
}

function expectSlOverride(element: Element, value: string, namespace: string): void {
  const overrides = directOverrides(element);
  expect(overrides).toHaveLength(1);
  expect(overrides[0].namespaceURI).toBe(namespace);
  expect(overrides[0].getAttribute("Locale")).toBe("sl-SI");
  expect(overrides[0].getAttribute("Value")).toBe(value);
}

function elementById(document: Document, id: string): Element {
  const elements = Array.from(document.querySelectorAll(`[id="${id}"]`));
  expect(elements, id).toHaveLength(1);
  return elements[0];
}

function directChild(element: Element, name: string): Element {
  const elements = Array.from(element.children).filter((child) => child.localName === name);
  expect(elements, `${element.localName} > ${name}`).toHaveLength(1);
  return elements[0];
}

function expectResid(element: Element, value: string): void {
  expect(element.getAttribute("resid")).toBe(value);
}

describe("authoritative manifest localization", () => {
  it.each(manifestPaths)("parses %s with the exact version and six sl-SI overrides", (path) => {
    const { document, source } = parseManifest(path);
    const contract = contracts[path];

    expect(elementByTag(document, "Version").textContent).toBe("1.0.0.3");
    expect(elementByTag(document, "DefaultLocale").textContent).toBe("en-US");
    expect(document.getElementsByTagNameNS("*", "Override")).toHaveLength(6);
    expect(rootElementByName(document, "DisplayName").getAttribute("DefaultValue")).toBe(
      contract.englishDisplayName
    );
    expect(rootElementByName(document, "Description").getAttribute("DefaultValue")).toBe(
      contract.englishDescription
    );
    expectSlOverride(
      rootElementByName(document, "DisplayName"),
      contract.displayName,
      officeAppNamespace
    );
    expectSlOverride(
      rootElementByName(document, "Description"),
      contract.description,
      officeAppNamespace
    );
    expectSlOverride(
      resourceString(document, "GetStarted.Title"),
      contract.getStartedTitle,
      officeBasicTypesNamespace
    );
    expectSlOverride(
      resourceString(document, "GetStarted.Description"),
      sharedTranslations["GetStarted.Description"],
      officeBasicTypesNamespace
    );
    expectSlOverride(
      resourceString(document, "TaskpaneButton.Label"),
      sharedTranslations["TaskpaneButton.Label"],
      officeBasicTypesNamespace
    );
    expectSlOverride(
      resourceString(document, "TaskpaneButton.Tooltip"),
      sharedTranslations["TaskpaneButton.Tooltip"],
      officeBasicTypesNamespace
    );
    expect(resourceString(document, "CommandsGroup.Label").getAttribute("DefaultValue")).toBe(
      "OpenLegalCore"
    );
    expect(resourceString(document, "GetStarted.Title").getAttribute("DefaultValue")).toBe(
      "OpenLegalCore for Word is ready"
    );
    expect(resourceString(document, "TaskpaneButton.Label").getAttribute("DefaultValue")).toBe(
      "Open OpenLegalCore"
    );
    expect(resourceString(document, "TaskpaneButton.Tooltip").getAttribute("DefaultValue")).toBe(
      "Open the OpenLegalCore task pane"
    );
    expect(directOverrides(resourceString(document, "CommandsGroup.Label"))).toHaveLength(0);
    expect(source).not.toMatch(/scaffold/i);
    expect(source).toContain(
      'DefaultValue="The connector is ready. Open the task pane from the Home tab."'
    );
  });

  it.each(manifestPaths)("preserves the technical contract in %s", (path) => {
    const { document, source } = parseManifest(path);
    const { id, origin, permission } = contracts[path];
    const resourceIds = Array.from(document.querySelectorAll("Resources [id]"))
      .map((element) => element.getAttribute("id"))
      .sort();

    expect(elementByTag(document, "Id").textContent).toBe(id);
    expect(elementByTag(document, "ProviderName").textContent).toBe("OpenLegalCore");
    expect(elementByTag(document, "Permissions").textContent).toBe(permission);
    expect(elementByTag(document, "Set").getAttribute("Name")).toBe("WordApi");
    expect(elementByTag(document, "Set").getAttribute("MinVersion")).toBe("1.3");
    expect(
      Array.from(document.getElementsByTagName("AppDomain")).map((item) => item.textContent)
    ).toEqual(["https://github.com"]);
    expect(resourceIds).toEqual([
      "Commands.Url",
      "CommandsGroup.Label",
      "GetStarted.Description",
      "GetStarted.LearnMoreUrl",
      "GetStarted.Title",
      "Icon.16x16",
      "Icon.32x32",
      "Icon.80x80",
      "Taskpane.Url",
      "TaskpaneButton.Label",
      "TaskpaneButton.Tooltip",
    ]);
    expect(source).toContain(`<SourceLocation DefaultValue="${origin}/taskpane.html"/>`);
    expect(source).toContain(
      '<SupportUrl DefaultValue="https://github.com/OpenLegalCore/olc-word-connector"/>'
    );
    expect(source).toContain(`<FunctionFile resid="Commands.Url"/>`);
    expect(source).toContain(`<bt:Url id="Commands.Url" DefaultValue="${origin}/commands.html"/>`);
    expect(source).toContain(`<bt:Url id="Taskpane.Url" DefaultValue="${origin}/taskpane.html"/>`);
    expect(source).toContain(
      '<bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="https://go.microsoft.com/fwlink/?LinkId=276812"/>'
    );
    expect(source).toContain('<Group id="CommandsGroup">');
    expect(source).toContain('<Control xsi:type="Button" id="TaskpaneButton">');
    expect(source).toContain('<Action xsi:type="ShowTaskpane">');
    expect(source).toContain("<TaskpaneId>ButtonId1</TaskpaneId>");
    expect(source).toContain('<SourceLocation resid="Taskpane.Url"/>');

    const getStarted = elementByTag(document, "GetStarted");
    expectResid(directChild(getStarted, "Title"), "GetStarted.Title");
    expectResid(directChild(getStarted, "Description"), "GetStarted.Description");
    expectResid(directChild(getStarted, "LearnMoreUrl"), "GetStarted.LearnMoreUrl");

    const commandsGroup = elementById(document, "CommandsGroup");
    expectResid(directChild(commandsGroup, "Label"), "CommandsGroup.Label");

    const taskpaneButton = elementById(document, "TaskpaneButton");
    expectResid(directChild(taskpaneButton, "Label"), "TaskpaneButton.Label");
    const supertip = directChild(taskpaneButton, "Supertip");
    expectResid(directChild(supertip, "Title"), "TaskpaneButton.Label");
    expectResid(directChild(supertip, "Description"), "TaskpaneButton.Tooltip");
    const action = directChild(taskpaneButton, "Action");
    expectResid(directChild(action, "SourceLocation"), "Taskpane.Url");

    for (const size of [16, 32, 80]) {
      expect(source).toContain(
        `<bt:Image id="Icon.${size}x${size}" DefaultValue="${origin}/assets/office/1.0.0.2/openlegalcore-mark-${size}.png"/>`
      );
    }
    expect(source).toContain(
      `<IconUrl DefaultValue="${origin}/assets/office/1.0.0.2/openlegalcore-mark-32.png"/>`
    );
    expect(source).toContain(
      `<HighResolutionIconUrl DefaultValue="${origin}/assets/office/1.0.0.2/openlegalcore-mark-64.png"/>`
    );

    const overrideParents = Array.from(document.getElementsByTagNameNS("*", "Override")).map(
      (override) => override.parentElement?.getAttribute("id") ?? override.parentElement?.localName
    );
    expect(overrideParents.sort()).toEqual(
      [
        "Description",
        "DisplayName",
        "GetStarted.Description",
        "GetStarted.Title",
        "TaskpaneButton.Label",
        "TaskpaneButton.Tooltip",
      ].sort()
    );
  });

  it("keeps the root and development manifests byte-identical", () => {
    expect(readFileSync("manifest.xml")).toEqual(readFileSync("manifests/manifest.dev.xml"));
  });

  it("keeps resource IDs in parity across all manifest environments", () => {
    const resourceSets = manifestPaths.map((path) => {
      const { document } = parseManifest(path);
      return Array.from(document.querySelectorAll("Resources [id]"))
        .map((element) => element.getAttribute("id"))
        .sort();
    });

    expect(resourceSets.slice(1)).toEqual(resourceSets.slice(1).map(() => resourceSets[0]));
  });
});
