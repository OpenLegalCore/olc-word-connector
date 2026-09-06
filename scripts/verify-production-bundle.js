const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultDist = path.resolve(process.argv[2] || path.join(root, "dist", "prod"));
const staticRequiredFiles = new Set([
  "_headers",
  "commands.html",
  "manifest.xml",
  "taskpane.html",
  "assets/icon-128.png",
  "assets/office/1.0.0.2/openlegalcore-mark-16.png",
  "assets/office/1.0.0.2/openlegalcore-mark-32.png",
  "assets/office/1.0.0.2/openlegalcore-mark-64.png",
  "assets/office/1.0.0.2/openlegalcore-mark-80.png",
]);
const productionScript = /^(commands|polyfill|taskpane)\.[a-f0-9]{20}\.js$/;
const productionLicense = /^taskpane\.[a-f0-9]{20}\.js\.LICENSE\.txt$/;
const productionStyle = /^[a-f0-9]{20}\.css$/;
const sourceMapReference = /sourceMappingURL\s*=/;
const canonicalTaskPaneMark = "assets/office/1.0.0.2/openlegalcore-mark-80.png";
const obsoleteTaskPaneLogo = "logo-filled.png";
const forbiddenContent = [
  { label: "localhost URL", pattern: /https?:\/\/localhost(?::\d+)?/i },
  { label: "DEVELOPMENT HARNESS", pattern: /DEVELOPMENT HARNESS/ },
  {
    label: "WORD ACCEPTANCE HARNESS",
    pattern: /DEVELOPMENT ONLY[^\r\n]*WORD ACCEPTANCE HARNESS/,
  },
  { label: "retained-range canary control", pattern: /Probe retained range/ },
  {
    label: "two-gesture retained-range canary control",
    pattern: /(?:Capture|Reuse) probe range/,
  },
  {
    label: "retained-range canary phase",
    pattern:
      /probe-(?:capture-sync|reuse-run-entry|reuse-queue|reuse-sync|cleanup-untrack-queue|cleanup-untrack-sync|pass)/,
  },
  {
    label: "two-gesture retained-range canary phase",
    pattern:
      /two-gesture-(?:captured|reuse-run-entry|reuse-queue|reuse-sync|cleanup-untrack-queue|cleanup-untrack-sync|pass)/,
  },
  {
    label: "production-shape Capture canary control",
    pattern: /(?:Capture|Reuse) production-shape range/,
  },
  {
    label: "production-shape Capture canary phase",
    pattern:
      /production-shape-(?:capture-entry|capture-queue|capture-sync|captured|reuse-entry|reuse-queue|reuse-sync|cleanup-queue|cleanup-sync|pass)/,
  },
  {
    label: "Apply validation statement diagnostic phase",
    pattern:
      /apply-validation-(?:current|retained)-(?:selection-get|working-range-get|parent-body-(?:access|load)|parent-table-or-null-(?:access|load)|parent-table-cell-or-null-(?:access|load)|tables-(?:access|load)|inline-pictures-(?:access|load)|ooxml-queue|range-load)|apply-validation-compare-location-queue/,
  },
  { label: "FakeWordAdapter", pattern: /FakeWordAdapter/ },
  { label: "FakeChatGateway", pattern: /FakeChatGateway/ },
  { label: "bindHarness", pattern: /bindHarness/ },
  { label: "test/fakes", pattern: /test[\\/]fakes[\\/]/ },
  { label: "test/harness", pattern: /test[\\/]harness[\\/]/ },
  { label: "test/fixtures", pattern: /test[\\/]fixtures[\\/]/ },
  {
    label: "gateway server runtime marker",
    pattern:
      /(?:private-upstream\.example\.invalid|word-gateway-example|OWUI_API_KEY|CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET)/i,
  },
  {
    label: "document mutation primitive",
    pattern: /\b(?:applyReplacement|insertText)\b/,
  },
  {
    label: "Cloudflare Access service-token browser header",
    pattern: /CF-Access-Client-(?:ID|Secret)/i,
  },
  {
    label: "persistent browser credential storage",
    pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/,
  },
];
const requiredProductionImports = [
  {
    label: "OfficeWordAdapter",
    entry: "src/taskpane/taskpane.ts",
    pattern: /from ["']\.\.\/office\/OfficeWordAdapter["']/,
  },
  {
    label: "selectionPolicy",
    entry: "src/office/OfficeWordAdapter.ts",
    pattern: /from ["']\.\/selectionPolicy["']/,
  },
  {
    label: "ProductionTaskPaneRuntime",
    entry: "src/taskpane/taskpane.ts",
    pattern: /from ["']\.\/ProductionTaskPaneRuntime["']/,
  },
  {
    label: "TaskPaneController",
    entry: "src/taskpane/ProductionTaskPaneRuntime.ts",
    pattern: /from ["']\.\.\/app\/TaskPaneController["']/,
  },
  {
    label: "OpenWebUIAdapter",
    entry: "src/taskpane/ProductionTaskPaneRuntime.ts",
    pattern: /from ["']\.\.\/chat\/OpenWebUIAdapter["']/,
  },
  {
    label: "OpenAICompatibleAdapter",
    entry: "src/taskpane/ProductionTaskPaneRuntime.ts",
    pattern: /from ["']\.\.\/chat\/OpenAICompatibleAdapter["']/,
  },
];

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

function assertExpectedOutputs(files, outputDirectory) {
  const relativeFiles = files.map((file) =>
    path.relative(outputDirectory, file).split(path.sep).join("/")
  );
  for (const required of staticRequiredFiles) {
    if (!relativeFiles.includes(required)) {
      throw new Error(
        `Missing required production output file: ${required} in ${outputDirectory}; found ${relativeFiles.join(", ")}`
      );
    }
  }

  const sourceMaps = relativeFiles.filter((file) => file.endsWith(".map"));
  if (sourceMaps.length > 0) {
    throw new Error(`Forbidden production source map: ${sourceMaps.join(", ")}`);
  }

  for (const name of ["commands", "polyfill", "taskpane"]) {
    const scripts = relativeFiles.filter(
      (file) => productionScript.test(file) && file.startsWith(`${name}.`)
    );
    if (scripts.length !== 1) {
      throw new Error(`Expected exactly one versioned ${name} script`);
    }
  }
  if (relativeFiles.filter((file) => productionLicense.test(file)).length !== 1) {
    throw new Error("Expected exactly one versioned taskpane license file");
  }
  if (relativeFiles.filter((file) => productionStyle.test(file)).length !== 1) {
    throw new Error("Expected exactly one versioned production stylesheet");
  }

  for (const relativeFile of relativeFiles) {
    const allowed =
      staticRequiredFiles.has(relativeFile) ||
      productionScript.test(relativeFile) ||
      productionLicense.test(relativeFile) ||
      productionStyle.test(relativeFile);
    if (!allowed) {
      throw new Error(`Unexpected production output file: ${relativeFile}`);
    }
  }
}

function inspectTaskPaneLogoContract(files, outputDirectory) {
  const relativeFiles = files.map((file) =>
    path.relative(outputDirectory, file).split(path.sep).join("/")
  );
  const obsoleteOutput = relativeFiles.find(
    (relativeFile) => path.posix.basename(relativeFile) === obsoleteTaskPaneLogo
  );
  if (obsoleteOutput) {
    throw new Error(`Forbidden obsolete task-pane logo output: ${obsoleteOutput}`);
  }

  const canonicalOutput = path.join(outputDirectory, canonicalTaskPaneMark);
  if (!relativeFiles.includes(canonicalTaskPaneMark)) {
    throw new Error(`Missing canonical task-pane mark: ${canonicalTaskPaneMark}`);
  }
  const canonicalContent = fs.readFileSync(canonicalOutput);
  if (canonicalContent.byteLength === 0) {
    throw new Error(`Empty canonical task-pane mark: ${canonicalTaskPaneMark}`);
  }
  const canonicalSource = fs.readFileSync(
    path.join(root, "assets", path.basename(canonicalTaskPaneMark))
  );
  if (!canonicalContent.equals(canonicalSource)) {
    throw new Error(`Non-canonical task-pane mark: ${canonicalTaskPaneMark}`);
  }

  for (const file of files.filter((candidate) => /\.(?:html|js|css)$/.test(candidate))) {
    const relativeFile = path.relative(outputDirectory, file).split(path.sep).join("/");
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(obsoleteTaskPaneLogo)) {
      throw new Error(`Forbidden obsolete task-pane logo reference: ${relativeFile}`);
    }
  }

  const taskPaneHtml = fs.readFileSync(path.join(outputDirectory, "taskpane.html"), "utf8");
  if (!taskPaneHtml.includes(canonicalTaskPaneMark)) {
    throw new Error(`Task pane does not reference canonical mark: taskpane.html`);
  }
}

function inspectBundleContent(files, outputDirectory) {
  for (const file of files) {
    if (path.extname(file) === ".png") {
      continue;
    }

    const relativeFile = path.relative(outputDirectory, file);
    const extension = path.extname(file);
    const contentBuffer = fs.readFileSync(file);
    if ([".js", ".css"].includes(extension) && contentBuffer.byteLength === 0) {
      throw new Error(`Empty hosted bundle: ${relativeFile}`);
    }

    const content = contentBuffer.toString("utf8");
    if ([".js", ".css"].includes(extension) && sourceMapReference.test(content)) {
      throw new Error(`Forbidden sourceMappingURL in ${relativeFile}`);
    }
    const forbidden = forbiddenContent.find(({ pattern }) => pattern.test(content));
    if (forbidden) {
      throw new Error(`Forbidden development marker in ${relativeFile}: ${forbidden.label}`);
    }
  }
}

function inspectProductionEntrypoints() {
  for (const required of requiredProductionImports) {
    const content = fs.readFileSync(path.join(root, required.entry), "utf8");
    if (!required.pattern.test(content)) {
      throw new Error(`Missing required production import: ${required.label}`);
    }
  }

  for (const entry of ["src/taskpane/taskpane.ts", "src/commands/commands.ts"]) {
    const content = fs.readFileSync(path.join(root, entry), "utf8");
    if (/\b(?:import|export)\b[^;]*["'][^"']*test\//m.test(content)) {
      throw new Error(`Production entrypoint imports test code: ${entry}`);
    }
  }

  const productionWordAdapter = fs.readFileSync(
    path.join(root, "src/office/OfficeWordAdapter.ts"),
    "utf8"
  );
  if (/\b(?:applyReplacement|insertText)\b/.test(productionWordAdapter)) {
    throw new Error("Production Word adapter contains a document mutation primitive");
  }
}

function verifyProductionBundle(outputDirectory = defaultDist) {
  const resolvedOutput = path.resolve(outputDirectory);
  if (!fs.existsSync(resolvedOutput)) {
    throw new Error(`Production output directory does not exist: ${resolvedOutput}`);
  }

  const files = filesBelow(resolvedOutput);
  inspectTaskPaneLogoContract(files, resolvedOutput);
  assertExpectedOutputs(files, resolvedOutput);
  inspectBundleContent(files, resolvedOutput);

  const emittedManifest = fs.readFileSync(path.join(resolvedOutput, "manifest.xml"));
  const productionManifest = fs.readFileSync(path.join(root, "manifests", "manifest.prod.xml"));
  if (!emittedManifest.equals(productionManifest)) {
    throw new Error("Production output manifest is not the canonical production manifest");
  }

  inspectProductionEntrypoints();
}

if (require.main === module) {
  verifyProductionBundle();
  console.log(`Production bundle isolation verified: ${defaultDist}`);
}

module.exports = { verifyProductionBundle };
