import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function permission(path: string): string | undefined {
  return /<Permissions>([^<]+)<\/Permissions>/u.exec(readFileSync(path, "utf8"))?.[1];
}

describe("Office manifest least privilege", () => {
  it.each(["manifests/manifest.stage.xml", "manifests/manifest.prod.xml"])(
    "uses read-only document permission in %s",
    (path) => {
      expect(permission(path)).toBe("ReadDocument");
    }
  );

  it.each(["manifest.xml", "manifests/manifest.dev.xml"])(
    "retains the development-only write-capable permission in %s",
    (path) => {
      expect(permission(path)).toBe("ReadWriteDocument");
    }
  );
});
