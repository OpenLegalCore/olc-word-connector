/* global process */
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
async function main() {
  const [baseline, output] = process.argv.slice(2);
  if (!baseline || !output || fs.existsSync(output))
    throw new Error("Baseline and new output directory required");
  fs.cpSync(baseline, output, { recursive: true, errorOnExist: true, force: false });
  await esbuild.build({
    entryPoints: ["scripts/owner-signin/client.ts"],
    bundle: true,
    minify: true,
    outfile: path.join(output, "owner-enrollment.js"),
    legalComments: "none",
  });
  await esbuild.build({
    entryPoints: ["src/taskpane/microsoft-redirect.ts"],
    bundle: true,
    minify: true,
    outfile: path.join(output, "owner-redirect.js"),
    legalComments: "none",
  });
  fs.copyFileSync(
    "node_modules/@azure/msal-browser/LICENSE",
    path.join(output, "MSAL-LICENSE.txt")
  );
  fs.writeFileSync(
    path.join(output, "owner-enrollment.html"),
    `<!doctype html>
<html lang="sl"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; connect-src https://login.microsoftonline.com http://127.0.0.1:8766; frame-src 'self' https://login.microsoftonline.com https://login.live.com; base-uri 'none'; form-action 'none'">
<title>OLC — enkratno preverjanje ownerja</title><script defer src="/owner-enrollment.js"></script></head>
<body><h1>Preverjanje Microsoftovega računa za OLC staging</h1><p>Ta stran ne dostopa do Wordovega dokumenta ali Engine. Žeton ostane v pomnilniku in se pošlje samo lokalnemu preverjevalniku na tem računalniku.</p><p id="status">Odpri to stran prek lokalnega sprejemnika. Če Chrome zahteva dovoljenje za lokalno povezavo, ga potrebuje samo preverjanje na 127.0.0.1.</p><button disabled>Prijava z Microsoftom</button></body></html>`
  );
  fs.writeFileSync(
    path.join(output, "microsoft-redirect.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><script defer src="/owner-redirect.js"></script><title>Microsoft sign-in</title></head><body>Zaključevanje prijave.</body></html>'
  );
  fs.appendFileSync(
    path.join(output, "_headers"),
    `
/owner-enrollment*
  ! Content-Security-Policy
  Cache-Control: no-store
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow
/owner-enrollment.js
  Cache-Control: no-store
/owner-redirect.js
  Cache-Control: no-store
/microsoft-redirect*
  Cache-Control: no-store
`
  );
}
main().catch(() => {
  process.exitCode = 1;
});
