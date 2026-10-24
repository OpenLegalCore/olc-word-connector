/* global require, console, process */
const { build } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  const root = path.resolve(__dirname, ".."),
    output = path.join(root, "dist/word-session");
  fs.mkdirSync(output, { recursive: true });
  for (const name of ["auth", "api"]) {
    await build({
      absWorkingDir: root,
      entryPoints: [`infrastructure/cloudflare/word-session/${name}-worker.js`],
      outfile: path.join(output, `${name}-worker.mjs`),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      sourcemap: false,
    });
    const configuration = fs.readFileSync(
      path.join(root, `infrastructure/cloudflare/word-session/${name}.wrangler.toml`),
      "utf8"
    );
    fs.writeFileSync(
      path.join(output, `${name}.wrangler.toml`),
      configuration.replace(`main = "${name}-worker.js"`, `main = "${name}-worker.mjs"`)
    );
  }
  fs.copyFileSync(
    path.join(root, "node_modules/jose/LICENSE.md"),
    path.join(output, "JOSE-LICENSE.txt")
  );
  console.log("Built local Word auth/API Workers; no Cloudflare request or deployment.");
}
main().catch(() => {
  console.error("Word session build failed");
  process.exitCode = 1;
});
