import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const galleryMarker = "DEVELOPMENT STATE GALLERY — NON-RUNTIME FIXTURES";
const galleryOnlyMarkers = [
  galleryMarker,
  "bindTaskPaneStateGallery",
  "galleryFixtures",
  "gallery-context",
  "gallery-question",
] as const;

function textFilesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return textFilesBelow(path);
    }
    return /\.(?:ts|html|css)$/.test(path) ? [path] : [];
  });
}

describe("development gallery isolation", () => {
  it("keeps selectors and future-state fixtures under the browser harness", () => {
    const harnessHtml = readFileSync("test/harness/harness.html", "utf8");
    const harnessEntry = readFileSync("test/harness/harness.ts", "utf8");
    const webpackConfig = readFileSync("webpack.config.js", "utf8");

    expect(harnessHtml).toContain(galleryMarker);
    expect(harnessEntry).toContain('from "./taskPaneGallery"');
    expect(webpackConfig).toContain('harness: "./test/harness/harness.ts"');
    expect(webpackConfig).toContain('"./src/taskpane/taskpane.ts"');
  });

  it("keeps gallery-only markers outside every production source path", () => {
    for (const path of textFilesBelow("src")) {
      const content = readFileSync(path, "utf8");
      for (const marker of galleryOnlyMarkers) {
        expect(content, `${path} contains ${marker}`).not.toContain(marker);
      }
      expect(content, `${path} imports a test path`).not.toMatch(/from\s+["'][^"']*test\//);
    }
  });

  it("keeps the production composition boundary free of fakes and future workflow modules", () => {
    const taskPaneEntry = readFileSync("src/taskpane/taskpane.ts", "utf8");
    expect(taskPaneEntry).not.toMatch(/FakeWordAdapter|FakeChatGateway|fetch|localStorage/);
    expect(taskPaneEntry).not.toMatch(/taskPaneGallery|test\/harness|Generate proposal/);
  });

  it("keeps the pre-locale bootstrap visibly language-neutral", () => {
    const taskPaneHtml = readFileSync("src/taskpane/taskpane.html", "utf8");

    expect(taskPaneHtml).toContain('data-view-state="locale-pending"');
    expect(taskPaneHtml).toContain("OpenLegalCore");
    expect(taskPaneHtml).not.toMatch(
      /Opening Word connection|INITIALIZING|APPLICATION STARTUP|Opening OpenLegalCore|WORD HOST|WAITING FOR READINESS/
    );
    expect(taskPaneHtml).not.toContain("OpenLegalCore for Word");
  });
});
