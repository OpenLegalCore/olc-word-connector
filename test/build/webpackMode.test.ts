import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpack = require("webpack");

import webpackConfig = require("../../webpack.config.js");

const productionBundleVerifier = require("../../scripts/verify-production-bundle.js");

const resolveBuildTarget = webpackConfig.resolveBuildTarget;
const resolveWordModelId = webpackConfig.resolveWordModelId;
const manifestVersion = "1.0.0.3";
const officeAssetVersion = "1.0.0.2";
const iconOutputDirectory = `assets/office/${officeAssetVersion}`;
const developmentId = "7eb3a8cf-4fa9-47f2-a408-afe5f6c59515";
const stagingId = "d913b3fe-90e7-4bc9-86d2-d391ea0a7fd1";
const productionId = "d8008df4-dd56-4150-9ed5-69a59ccd4889";
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const canonicalTaskPaneMark = `${iconOutputDirectory}/openlegalcore-mark-80.png`;
const obsoleteTaskPaneLogo = "assets/logo-filled.png";

const targets = {
  development: { mode: "development", manifest: "manifests/manifest.dev.xml" },
  staging: { mode: "production", manifest: "manifests/manifest.stage.xml" },
  production: { mode: "production", manifest: "manifests/manifest.prod.xml" },
  harness: { mode: "development" },
  "word-harness": { mode: "development", manifest: "manifests/manifest.dev.xml" },
} as const;

let temporaryBuildRoot: string;
const outputPaths = new Map<string, string>();
let productionSnapshot: Map<string, string>;
let stagingSnapshot: Map<string, string>;

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

function snapshot(directory: string): Map<string, string> {
  return new Map(
    filesBelow(directory).map((file) => [relative(directory, file), sha256(readFileSync(file))])
  );
}

function relativeFilesBelow(directory: string): string[] {
  return filesBelow(directory).map((file) => relative(directory, file));
}

function withProductionCopy(label: string, test: (outputPath: string) => void): void {
  const temporaryRoot = mkdtempSync(join(tmpdir(), `olc-production-${label}-`));
  const outputPath = join(temporaryRoot, "prod");
  cpSync(outputPaths.get("production")!, outputPath, { recursive: true });
  try {
    test(outputPath);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function compile(targetName: keyof typeof targets): Promise<string> {
  const target = targets[targetName];
  const config = await webpackConfig(
    { target: targetName, WEBPACK_BUILD: true },
    { mode: target.mode }
  );
  const outputPath = join(temporaryBuildRoot, basename(config.output.path));
  const isolatedConfig = {
    ...config,
    output: { ...config.output, path: outputPath },
  } as unknown as webpack.Configuration;

  await new Promise<void>((resolve, reject) => {
    const compiler = webpack(isolatedConfig);
    compiler.run((error, stats) => {
      const compilationError =
        error ??
        (stats?.hasErrors()
          ? new Error(stats.toString({ all: false, errors: true, warnings: false }))
          : undefined);
      compiler.close((closeError) => {
        if (compilationError || closeError) {
          reject(compilationError ?? closeError);
          return;
        }
        resolve();
      });
    });
  });

  outputPaths.set(targetName, outputPath);
  return outputPath;
}

function manifest(path: string): string {
  return readFileSync(path, "utf8");
}

function manifestId(content: string): string {
  return content.match(/<Id>([^<]+)<\/Id>/)?.[1] ?? "";
}

function assertManifestContract(
  content: string,
  origin: string,
  permission: "ReadDocument" | "ReadWriteDocument"
): void {
  expect(content).toContain(`<Version>${manifestVersion}</Version>`);
  expect(content).toContain('<Host Name="Document"/>');
  expect(content).toContain('<Set Name="WordApi" MinVersion="1.3"/>');
  expect(content).toContain(`<Permissions>${permission}</Permissions>`);
  expect(content).toContain(`<SourceLocation DefaultValue="${origin}/taskpane.html"/>`);
  expect(content).toContain(`<FunctionFile resid="Commands.Url"/>`);
  expect(content).toContain(`<bt:Url id="Commands.Url" DefaultValue="${origin}/commands.html"/>`);
  expect(content).toContain(`<bt:Url id="Taskpane.Url" DefaultValue="${origin}/taskpane.html"/>`);
  expect(content).toContain(
    `<IconUrl DefaultValue="${origin}/${iconOutputDirectory}/openlegalcore-mark-32.png"/>`
  );
  expect(content).toContain(
    `<HighResolutionIconUrl DefaultValue="${origin}/${iconOutputDirectory}/openlegalcore-mark-64.png"/>`
  );
  for (const size of [16, 32, 80]) {
    expect(content).toContain(
      `<bt:Image id="Icon.${size}x${size}" DefaultValue="${origin}/${iconOutputDirectory}/openlegalcore-mark-${size}.png"/>`
    );
    expect(content).toContain(`<bt:Image size="${size}" resid="Icon.${size}x${size}"/>`);
  }
}

beforeAll(async () => {
  temporaryBuildRoot = mkdtempSync(join(tmpdir(), "olc-host-builds-"));
  const productionOutput = await compile("production");
  const stagingOutput = await compile("staging");
  productionSnapshot = snapshot(productionOutput);
  stagingSnapshot = snapshot(stagingOutput);
  await compile("harness");
  await compile("word-harness");
  await compile("development");
}, 120_000);

afterAll(() => {
  rmSync(temporaryBuildRoot, { recursive: true, force: true });
});

describe("explicit fail-closed webpack targets", () => {
  it("maps every supported target to an isolated output and required mode", () => {
    const paths = new Set<string>();
    for (const [targetName, expected] of Object.entries(targets)) {
      const target = resolveBuildTarget({ target: targetName }, { mode: expected.mode });
      paths.add(target.outputDirectory);
      expect(target.webpackMode).toBe(expected.mode);
    }
    expect(paths).toEqual(new Set(["dev", "stage", "prod", "harness", "word-harness"]));
  });

  it("rejects missing, unknown, non-string, and mode-conflicting targets", () => {
    for (const target of [undefined, "", "release", ["production", "staging"], true]) {
      expect(() => resolveBuildTarget({ target }, { mode: "production" })).toThrow(
        /Invalid or missing webpack build target/
      );
    }
    expect(() => resolveBuildTarget({ target: "production" }, { mode: "development" })).toThrow(
      /requires --mode production/
    );
    expect(() => resolveBuildTarget({ target: "development" }, { mode: "production" })).toThrow(
      /requires --mode development/
    );
  });

  it("keeps all development server targets on the approved port", async () => {
    for (const target of ["development", "harness", "word-harness"] as const) {
      const config = await webpackConfig({ target, WEBPACK_BUILD: true }, { mode: "development" });
      expect(Number(config.devServer.port)).toBe(3002);
      expect(config.devtool).toBe("source-map");
    }
  });

  it("disables source maps only for deployable targets", async () => {
    for (const target of ["staging", "production"] as const) {
      const config = await webpackConfig({ target, WEBPACK_BUILD: true }, { mode: "production" });
      expect(config.devtool).toBe(false);
    }
  });

  it("uses a public default model ID and validates build-time overrides", () => {
    expect(resolveWordModelId(undefined)).toBe("olc-engine");
    expect(resolveWordModelId("partner-model:latest")).toBe("partner-model:latest");
    for (const invalid of ["", " leading", "trailing ", "line\nbreak", "model?id=1"]) {
      expect(() => resolveWordModelId(invalid)).toThrow(/OLC_WORD_MODEL_ID/);
    }
  });

  it("embeds the selected non-secret model ID in deployable bundles", async () => {
    const previousModelId = process.env.OLC_WORD_MODEL_ID;
    try {
      process.env.OLC_WORD_MODEL_ID = "partner-model:latest";
      const config = await webpackConfig(
        { target: "staging", WEBPACK_BUILD: true },
        { mode: "production" }
      );
      const definePlugin = config.plugins.find(
        (plugin: { constructor: { name: string } }) => plugin.constructor.name === "DefinePlugin"
      ) as { definitions?: Record<string, string> } | undefined;

      expect(definePlugin?.definitions?.__OLC_WORD_MODEL_ID__).toBe(
        JSON.stringify("partner-model:latest")
      );
    } finally {
      if (previousModelId === undefined) {
        delete process.env.OLC_WORD_MODEL_ID;
      } else {
        process.env.OLC_WORD_MODEL_ID = previousModelId;
      }
    }
  });
});

describe("explicit Office manifests", () => {
  const cases = [
    ["manifests/manifest.dev.xml", "https://localhost:3002", developmentId, "ReadWriteDocument"],
    [
      "manifests/manifest.stage.xml",
      "https://word-staging.example.invalid",
      stagingId,
      "ReadDocument",
    ],
    ["manifests/manifest.prod.xml", "https://word.openlegalcore.org", productionId, "ReadDocument"],
  ] as const;

  it("keeps the root compatibility manifest byte-identical to development", () => {
    expect(readFileSync("manifest.xml")).toEqual(readFileSync("manifests/manifest.dev.xml"));
  });

  it.each(cases)(
    "keeps %s on its exact GUID, origin, permission, and base contract",
    (path, origin, id, permission) => {
      const content = manifest(path);
      expect(manifestId(content)).toBe(id);
      assertManifestContract(content, origin, permission);

      const runtimeUrls = [...content.matchAll(/DefaultValue="(https:\/\/[^\"]+)"/g)]
        .map((match) => match[1])
        .filter(
          (url) =>
            !url.startsWith("https://github.com") && !url.startsWith("https://go.microsoft.com")
        );
      expect(runtimeUrls.length).toBeGreaterThan(0);
      expect(runtimeUrls.every((url) => url.startsWith(`${origin}/`))).toBe(true);
    }
  );

  it("uses three distinct IDs and valid new UUIDv4 IDs for staging and production", () => {
    expect(new Set([developmentId, stagingId, productionId]).size).toBe(3);
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(stagingId).toMatch(uuidV4);
    expect(productionId).toMatch(uuidV4);
  });

  it("keeps staging and production free of development identities and URLs", () => {
    for (const path of ["manifests/manifest.stage.xml", "manifests/manifest.prod.xml"]) {
      const content = manifest(path);
      expect(content).not.toContain("localhost");
      expect(content).not.toContain(developmentId);
      expect(content).not.toMatch(/(?:test|harness)/i);
    }
  });

  it("keeps the Office icon cache version consistent across every static contract", () => {
    expect(webpackConfig.OFFICE_ASSET_VERSION).toBe(officeAssetVersion);

    for (const path of [
      "manifest.xml",
      "manifests/manifest.dev.xml",
      "manifests/manifest.stage.xml",
      "manifests/manifest.prod.xml",
    ]) {
      const content = manifest(path);
      expect(content.match(/<Version>([^<]+)<\/Version>/)?.[1]).toBe(manifestVersion);
      const iconVersions = [...content.matchAll(/assets\/office\/([^/]+)\//g)].map(
        (match) => match[1]
      );
      expect(iconVersions.length).toBeGreaterThan(0);
      expect(new Set(iconVersions)).toEqual(new Set([officeAssetVersion]));
    }

    const headers = readFileSync("hosting/cloudflare/_headers", "utf8");
    expect(headers).toContain(`/assets/office/${officeAssetVersion}/*`);
    const verifier = readFileSync("scripts/verify-production-bundle.js", "utf8");
    for (const size of [16, 32, 64, 80]) {
      expect(verifier).toContain(
        `assets/office/${officeAssetVersion}/openlegalcore-mark-${size}.png`
      );
    }
  });
});

describe("isolated hosted outputs", () => {
  it("emits only the canonical manifest selected for each applicable output", () => {
    for (const target of ["production", "staging", "word-harness", "development"] as const) {
      const outputPath = outputPaths.get(target)!;
      const xmlFiles = filesBelow(outputPath).filter((file) => file.endsWith(".xml"));
      expect(xmlFiles.map((file) => relative(outputPath, file))).toEqual(["manifest.xml"]);
      expect(readFileSync(join(outputPath, "manifest.xml"))).toEqual(
        readFileSync(targets[target].manifest)
      );
    }
  });

  it("builds development last without changing production or staging", () => {
    const developmentOutput = outputPaths.get("development")!;
    expect(statSync(developmentOutput).isDirectory()).toBe(true);
    const developmentManifest = manifest(join(developmentOutput, "manifest.xml"));
    expect(manifestId(developmentManifest)).toBe(developmentId);
    assertManifestContract(developmentManifest, "https://localhost:3002", "ReadWriteDocument");
    expect(developmentManifest).not.toContain("https://word-staging.example.invalid");
    expect(developmentManifest).not.toContain("https://word.openlegalcore.org");
    expect(developmentManifest).not.toContain(stagingId);
    expect(developmentManifest).not.toContain(productionId);
    expect(existsSync(join(developmentOutput, "_headers"))).toBe(false);
    expect(snapshot(outputPaths.get("production")!)).toEqual(productionSnapshot);
    expect(snapshot(outputPaths.get("staging")!)).toEqual(stagingSnapshot);
  });

  it("copies Cloudflare headers only into deployable outputs", () => {
    expect(statSync(join(outputPaths.get("production")!, "_headers")).isFile()).toBe(true);
    expect(statSync(join(outputPaths.get("staging")!, "_headers")).isFile()).toBe(true);
    expect(existsSync(join(outputPaths.get("development")!, "_headers"))).toBe(false);
    expect(existsSync(join(outputPaths.get("harness")!, "_headers"))).toBe(false);
    expect(existsSync(join(outputPaths.get("word-harness")!, "_headers"))).toBe(false);
  });

  it("emits byte-identical versioned PNGs with exact dimensions for every manifest role", () => {
    for (const target of ["production", "staging", "word-harness", "development"] as const) {
      const outputPath = outputPaths.get(target)!;
      for (const size of [16, 32, 64, 80]) {
        const filename = `openlegalcore-mark-${size}.png`;
        const emitted = readFileSync(join(outputPath, iconOutputDirectory, filename));
        const source = readFileSync(join("assets", filename));
        expect(emitted.subarray(0, pngSignature.length)).toEqual(pngSignature);
        expect(emitted.subarray(12, 16).toString("ascii")).toBe("IHDR");
        expect(emitted.readUInt32BE(16)).toBe(size);
        expect(emitted.readUInt32BE(20)).toBe(size);
        expect(sha256(emitted)).toBe(sha256(source));
      }
    }
  });

  it("renders the canonical versioned mark in every shipped task pane", () => {
    for (const target of ["production", "staging", "development"] as const) {
      const outputPath = outputPaths.get(target)!;
      const taskPane = readFileSync(join(outputPath, "taskpane.html"), "utf8");
      const emittedMark = readFileSync(join(outputPath, canonicalTaskPaneMark));
      const sourceMark = readFileSync(join("assets", "openlegalcore-mark-80.png"));

      expect(taskPane).toContain(`src="/${canonicalTaskPaneMark}"`);
      expect(taskPane).toContain('alt="OpenLegalCore"');
      expect(taskPane).not.toContain("logo-filled.png");
      expect(emittedMark.byteLength).toBeGreaterThan(0);
      expect(emittedMark).toEqual(sourceMark);
      expect(relativeFilesBelow(outputPath)).not.toContain(obsoleteTaskPaneLogo);
      for (const hostedTextFile of filesBelow(outputPath).filter((file) =>
        /\.(?:html|js|css)$/.test(file)
      )) {
        expect(readFileSync(hostedTextFile, "utf8")).not.toContain("logo-filled.png");
      }
    }
  });

  it("keeps development task-pane and Word harness icon references usable", () => {
    const developmentOutput = outputPaths.get("development")!;
    const wordHarnessOutput = outputPaths.get("word-harness")!;
    expect(readFileSync(join(developmentOutput, "taskpane.html"), "utf8")).toContain(
      `/${canonicalTaskPaneMark}`
    );
    expect(readFileSync(join(wordHarnessOutput, "manifest.xml"), "utf8")).toContain(
      `/${canonicalTaskPaneMark}`
    );
    expect(statSync(join(wordHarnessOutput, canonicalTaskPaneMark)).size).toBeGreaterThan(0);
  });

  it("emits only content-versioned JavaScript and CSS for hosted outputs", () => {
    for (const target of ["production", "staging"] as const) {
      const outputPath = outputPaths.get(target)!;
      const files = readdirSync(outputPath);
      expect(files.filter((file) => file.endsWith(".js"))).toHaveLength(3);
      expect(files.filter((file) => file.endsWith(".js"))).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^commands\.[a-f0-9]{20}\.js$/),
          expect.stringMatching(/^polyfill\.[a-f0-9]{20}\.js$/),
          expect.stringMatching(/^taskpane\.[a-f0-9]{20}\.js$/),
        ])
      );
      expect(files.filter((file) => file.endsWith(".css"))).toEqual([
        expect.stringMatching(/^[a-f0-9]{20}\.css$/),
      ]);
      for (const file of filesBelow(outputPath).filter((path) => /\.(?:js|css)$/.test(path))) {
        expect(statSync(file).size, relative(outputPath, file)).toBeGreaterThan(0);
      }
    }
  });

  it("references an existing non-empty content-hashed commands bundle", () => {
    for (const target of ["production", "staging"] as const) {
      const outputPath = outputPaths.get(target)!;
      const commandsHtml = readFileSync(join(outputPath, "commands.html"), "utf8");
      const commandsScript = commandsHtml.match(
        /<script[^>]+src="(commands\.[a-f0-9]{20}\.js)"/
      )?.[1];

      expect(commandsScript).toBeDefined();
      const commandsPath = join(outputPath, commandsScript!);
      expect(statSync(commandsPath).isFile()).toBe(true);
      expect(statSync(commandsPath).size).toBeGreaterThan(0);
    }
  });

  it("publishes no source maps or sourceMappingURL references in hosted outputs", () => {
    for (const target of ["production", "staging"] as const) {
      const outputPath = outputPaths.get(target)!;
      expect(relativeFilesBelow(outputPath).filter((file) => file.endsWith(".map"))).toEqual([]);

      for (const file of filesBelow(outputPath).filter((path) => /\.(?:js|css)$/.test(path))) {
        expect(readFileSync(file, "utf8")).not.toContain("sourceMappingURL");
      }
    }
  });

  it("preserves source-map diagnostics for development and both harnesses", () => {
    const expectedMaps = {
      development: ["commands.js.map", "polyfill.js.map", "taskpane.js.map"],
      harness: ["harness.js.map"],
      "word-harness": ["commands.js.map", "polyfill.js.map", "taskpane.js.map"],
    } as const;

    for (const [target, maps] of Object.entries(expectedMaps)) {
      const outputPath = outputPaths.get(target)!;
      expect(
        relativeFilesBelow(outputPath)
          .filter((file) => file.endsWith(".map"))
          .sort(),
        `source maps for ${target}`
      ).toEqual([...maps]);

      for (const map of maps) {
        const script = map.slice(0, -".map".length);
        expect(readFileSync(join(outputPath, script), "utf8")).toContain(`sourceMappingURL=${map}`);
      }
    }
  });

  it("passes the fail-closed production bundle verifier", () => {
    expect(() =>
      productionBundleVerifier.verifyProductionBundle(outputPaths.get("production")!)
    ).not.toThrow();
  });

  it("emits no locale persistence key or localStorage access in the production bundle", () => {
    const outputPath = outputPaths.get("production")!;
    const taskPaneScript = filesBelow(outputPath).find((file) =>
      /taskpane\.[a-f0-9]{20}\.js$/.test(file)
    );
    expect(taskPaneScript).toBeDefined();
    const taskPaneBundle = readFileSync(taskPaneScript!, "utf8");
    const removedLocalePersistenceKey = ["openlegalcore.word.uiLocale", "v1"].join(".");

    expect(taskPaneBundle).not.toContain(removedLocalePersistenceKey);
    expect(taskPaneBundle).not.toMatch(/\blocalStorage\b/);
  });

  it.each([
    ["server origin", "private-upstream.example.invalid"],
    ["gateway module", "word-gateway-example"],
    ["server secret", "CF_ACCESS_CLIENT_SECRET"],
    ["mutation method", "applyReplacement"],
    ["Word mutation API", "insertText"],
  ])("rejects a server-only or mutation %s from the Word bundle", (label, marker) => {
    withProductionCopy(`bundle-boundary-${label.replace(/ /g, "-")}`, (outputPath) => {
      const script = filesBelow(outputPath).find((file) =>
        /taskpane\.[a-f0-9]{20}\.js$/.test(file)
      )!;
      writeFileSync(script, `${readFileSync(script, "utf8")}\n${marker}`);
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        /Forbidden development marker/
      );
    });
  });

  it("rejects an obsolete task-pane logo output with a content-free relative path", () => {
    withProductionCopy("obsolete-logo-output", (outputPath) => {
      writeFileSync(join(outputPath, obsoleteTaskPaneLogo), "obsolete placeholder fixture");
      const expectedError = `Forbidden obsolete task-pane logo output: ${obsoleteTaskPaneLogo}`;
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        expectedError
      );

      const cliResult = spawnSync(
        process.execPath,
        ["scripts/verify-production-bundle.js", outputPath],
        { encoding: "utf8" }
      );
      const cliOutput = `${cliResult.stdout}${cliResult.stderr}`;
      expect(cliResult.status).not.toBe(0);
      expect(cliOutput).toContain(expectedError);
      expect(cliOutput).not.toContain(outputPath);
    });
  });

  it("rejects an obsolete task-pane logo reference without banning ordinary logo text", () => {
    withProductionCopy("obsolete-logo-reference", (outputPath) => {
      const taskPanePath = join(outputPath, "taskpane.html");
      const taskPane = readFileSync(taskPanePath, "utf8").replace(
        `/${canonicalTaskPaneMark}`,
        obsoleteTaskPaneLogo
      );
      writeFileSync(taskPanePath, taskPane);
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        "Forbidden obsolete task-pane logo reference: taskpane.html"
      );
    });
    withProductionCopy("ordinary-logo-text", (outputPath) => {
      const taskPanePath = join(outputPath, "taskpane.html");
      writeFileSync(taskPanePath, `${readFileSync(taskPanePath, "utf8")}<p>logo</p>`);
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).not.toThrow();
    });
  });

  it.each(["missing", "empty"])("rejects a %s canonical task-pane mark", (state) => {
    withProductionCopy(`${state}-canonical-logo`, (outputPath) => {
      const markPath = join(outputPath, canonicalTaskPaneMark);
      if (state === "missing") {
        rmSync(markPath);
      } else {
        writeFileSync(markPath, Buffer.alloc(0));
      }
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        `${state === "missing" ? "Missing" : "Empty"} canonical task-pane mark: ${canonicalTaskPaneMark}`
      );
    });
  });

  it("rejects a task pane that does not reference the canonical mark", () => {
    withProductionCopy("missing-canonical-logo-reference", (outputPath) => {
      const taskPanePath = join(outputPath, "taskpane.html");
      writeFileSync(
        taskPanePath,
        readFileSync(taskPanePath, "utf8").replace(`/${canonicalTaskPaneMark}`, "about:blank")
      );
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        "Task pane does not reference canonical mark: taskpane.html"
      );
    });
  });

  it.each(["js", "css"])("rejects a zero-byte hosted %s bundle", (extension) => {
    withProductionCopy(`empty-${extension}`, (outputPath) => {
      const asset = filesBelow(outputPath).find((file) => file.endsWith(`.${extension}`))!;
      writeFileSync(asset, Buffer.alloc(0));
      const expectedError = `Empty hosted bundle: ${relative(outputPath, asset)}`;
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        expectedError
      );

      const cliResult = spawnSync(
        process.execPath,
        ["scripts/verify-production-bundle.js", outputPath],
        { encoding: "utf8" }
      );
      expect(cliResult.status).not.toBe(0);
      expect(`${cliResult.stdout}${cliResult.stderr}`).toContain(expectedError);
    });
  });

  it("rejects an added production source map", () => {
    withProductionCopy("source-map", (outputPath) => {
      const script = filesBelow(outputPath).find((file) =>
        /taskpane\.[a-f0-9]{20}\.js$/.test(file)
      )!;
      writeFileSync(`${script}.map`, "{}\n");
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        /Forbidden production source map/
      );
    });
  });

  it.each(["js", "css"])("rejects a sourceMappingURL marker in hosted %s", (extension) => {
    withProductionCopy(`source-reference-${extension}`, (outputPath) => {
      const asset = filesBelow(outputPath).find((file) => file.endsWith(`.${extension}`))!;
      writeFileSync(
        asset,
        `${readFileSync(asset, "utf8")}\n/*# sourceMappingURL=forbidden.map */\n`
      );
      expect(() => productionBundleVerifier.verifyProductionBundle(outputPath)).toThrow(
        /Forbidden sourceMappingURL/
      );
    });
  });
});

describe("Cloudflare Pages static policy", () => {
  const headers = readFileSync("hosting/cloudflare/_headers", "utf8");

  it("sets Office-compatible security headers without frame denial or guessed OWUI origins", () => {
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("https://appsforoffice.microsoft.com");
    const contentSecurityPolicy = headers.match(/  Content-Security-Policy: ([^\n]+)/)?.[1];
    expect(contentSecurityPolicy?.match(/frame-ancestors/g)).toHaveLength(1);
    const frameAncestors = contentSecurityPolicy?.match(/(?:^|; )frame-ancestors ([^;]+);/)?.[1];
    expect(frameAncestors?.split(/\s+/)).toEqual([
      "'self'",
      "https://word.cloud.microsoft",
      "https://*.officeapps.live.com",
    ]);
    for (const forbiddenAncestor of [
      "https://*.microsoft.com",
      "https://*.cloud.microsoft",
      "https://*.sharepoint.com",
    ]) {
      expect(headers).not.toContain(forbiddenAncestor);
    }
    expect(headers).toContain("connect-src 'self'");
    expect(headers).not.toMatch(/X-Frame-Options/i);
    expect(headers.match(/connect-src ([^;]+);/)?.[1]).toBe("'self'");
    expect(headers).not.toMatch(/openwebui|\/api\//i);
  });

  it("uses no-cache and correct MIME rules for manifests and HTML", () => {
    expect(headers).toMatch(
      /\/manifest\.xml\n  Cache-Control: no-cache\n  Content-Type: application\/xml; charset=UTF-8/
    );
    expect(headers).toMatch(
      /\/\*\.html\n  Cache-Control: no-cache\n  Content-Type: text\/html; charset=UTF-8/
    );
  });

  it("uses immutable caching and correct MIME rules for versioned PNG, JS, and CSS", () => {
    for (const selector of ["/assets/office/1.0.0.2/*", "/*.js", "/*.css"]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(headers).toMatch(
        new RegExp(`${escaped}\\n  Cache-Control: public, max-age=31536000, immutable`)
      );
    }
    expect(headers).toContain("Content-Type: image/png");
    expect(headers).toContain("Content-Type: text/javascript; charset=UTF-8");
    expect(headers).toContain("Content-Type: text/css; charset=UTF-8");
  });
});

it("keeps dependency declarations synchronized without adding a dependency", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  expect(packageLock.packages[""].dependencies).toEqual(packageJson.dependencies);
  expect(packageLock.packages[""].devDependencies).toEqual(packageJson.devDependencies);
  expect(packageLock.lockfileVersion).toBe(3);
  expect(packageLock.packages[""].license).toBe(packageJson.license);
  expect(packageLock.packages[""].engines).toEqual(packageJson.engines);
});
