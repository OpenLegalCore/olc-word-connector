# OLC-74: temporary staging read-only entry — PREPARED, NOT ACTIVATED

The shared staging entry can expose the already reviewed one-shot OOXML exporter
without another localhost registration. This packet is for owner approval only.
No Pages deployment, rollback, CA import, Word action or Engine request was made
while preparing it. Engine remains `54552da`.

## Current delivery and exact rollback

Cloudflare API was read on 2026-10-31. The canonical deployment is
`9b0ae7ed-e4f2-4cd4-a07a-b2db42595d05`, source
`fddc65d7ebf8a2f5e16332a322adca5783deacfd`, status success, on project
`olc-word-staging` (its Pages production channel is the staging frontend).
[CURRENT.json](CURRENT.json) records the read times, complete 23-file API
inventory and downloaded SHA-256 values. All 23 response bodies matched across
its immutable URL, the Pages project hostname and the staging custom domain:
69 static GETs. No `/api`, sign-in, session or model endpoint was requested.
The initial Python HTTP client was rejected with 403; the complete successful
snapshot used curl. Historical deliveries are not substituted for this state.

Current manifest SHA-256 is
`45f81beb454902c8206d350bcf06a24fede74fa3586e24476595b96e7d1ad665`.
It still contains `word-staging.example.invalid`; this packet retains those
exact bytes. The existing Word registration is not replaced or inferred from
this served manifest. Current entry SHA-256 is
`8e44739d3e34f1e724b0456da6813d4bf98d9bc6c0c39b14c96e8c6d5c640107`.

All live response bodies are preserved locally, including the existing
`taskpane.54de0fde9d0059ac8b60.js` and every SSO asset. `_headers` is not a served
Pages asset: its exact bytes come from the active source commit, and all 69
GETs independently confirmed its security-header effects. This is a provenance
limit, not a claim that the private deployed `_headers` bytes were downloaded.
No source build was used to recreate the 23 served bodies.

The primary rollback is the retained successful deployment above, checked via
GET. Cloudflare's documented rollback endpoint (Pages Write) is:

```text
POST /accounts/82209a4cf04d77c6ca8cf2f9e6a81a40/pages/projects/olc-word-staging/deployments/9b0ae7ed-e4f2-4cd4-a07a-b2db42595d05/rollback
```

This endpoint was discovered, not executed. The exact offline restore archive is
also prepared (served bodies are exact; `_headers` is source-pinned as noted). [PACKAGE.json](PACKAGE.json) pins both archives and every file.
The protected local packet is `/tmp/olc74-staging-readonly-review/package-final/`:

- `rollback.tar`: `86b4b8decc13c99c598719bdb1b2d3a27e750d25775282a0f9fa7fb865655e77`
- `candidate.tar`: `a15f76140c1afcf3b359d03fb90cc5b9c7142a05bd2b6bfd98aab1727cb134d9`

## Minimal candidate

Only `taskpane.html` changes among the 24 retained local files. Three new names
contain the already reviewed exact polyfill, task-pane JS and harness CSS. The
existing production CSS is reused. No old filename is removed or overwritten
apart from the intended entry replacement. No manifest, SSO file, `_headers`,
Worker, routes, DNS, environment setting or Pages project configuration changes.
The local sideload candidate and prior packets stay preserved.

The [actual entry diff](ENTRY.diff) shows the complete replacement. The exact
[entry HTML](taskpane.html) includes the existing read-only marker and
an additional visible identity `olc74-staging-readonly-v1`. Office.onReady
selects the reviewed exporter before normal/proposal composition, even with
`?proposal=explicit`. The packaged JS is byte-identical to the earlier reviewed
harness. Normal and mutating code remains dormant in that existing bundle;
this is not a new production bundle or a claim that mutating code is absent.
Source maps are not added; any development source-map requests are not part of
the runtime assets. The entry contains no inline script or style and uses only
self-hosted assets plus the already allowed Microsoft Office.js URL. Existing
CSP and every response-header rule remain unchanged.

There is no automatic selection read or capture. The single button performs one
new capture and one inspect, retaining and exporting the first XML triple through
`textContent`. There is no exporter call to Apply, insertText, release or Engine.
One-shot is per page instance; the operator must not reopen/reload to recapture.
The pane does not enforce the document's identity: the operator must verify
synthetic Document19 in the actual Word UI before the one permitted click.

**During this shared staging delivery, every other newly opened or reloaded
staging pane also receives the diagnostic interface.** Such a pane could expose
its selected document text/XML if someone clicks capture. Keep the interval
short, coordinate exclusive diagnostic use, and do not refresh Document17 or its
existing pane. Preserving old assets supports its already loaded frontend; it
is not a claim of broader Word session acceptance. If this shared exposure is
not acceptable, this candidate must not be activated.

## Reproduce and validate offline

No build or dependency installation is required. In the reviewed checkout:

```sh
python3 docs/evidence/olc74-staging-readonly-review/prepare.py \
  --baseline /tmp/olc74-staging-readonly-review/rollback/frontend \
  --harness /tmp/olc74-sideload-dom-candidate \
  --output /tmp/olc74-staging-readonly-review/NEW-UNUSED-DIRECTORY
node docs/evidence/olc74-staging-readonly-review/verify-package.cjs \
  /tmp/olc74-staging-readonly-review/NEW-UNUSED-DIRECTORY \
  /tmp/olc74-pr58-engine-only-20261031/word-fixture/package.json
```

The output must be new; the builder refuses to overwrite it. It verifies the
full preserved baseline and original harness, copies files without rebuilding,
and produces deterministic uncompressed tar files. The verifier uses already
installed jsdom/esbuild and the existing fake Word runtime; it does not contact
Microsoft or execute an actual Word capture. Its source compile is only for the
fake test, never for packet construction.

## Execution sequence, only after separate owner activation approval

1. Re-read the canonical Pages deployment and compare it to the pinned ID;
   verify all packet hashes, current manifest/entry responses and rollback
   availability. Abort on drift and prepare a new review rather than restoring
   an outdated release. Establish an exclusive short interval for this shared
   staging origin. Confirm the supported browser still has Document17; never
   claim, reload or alter its tab. Identify the separate synthetic Document19
   and retained staging registration. A blank add-in list does not prove absence.
2. Preflight the rollback connector's Pages Write capability before activation.
   Keep the retained deployment and exact fallback archive available. The fallback cannot certify hidden deployed `_headers`
   byte identity; primary retained-deployment rollback preserves the original. Activate
   only `package-final/candidate/frontend` by the existing direct Pages upload
   method below; do not run npm start/build, create Functions, update project
   settings, change Worker routes, import CA or sideload a manifest. Use an
   agent-controlled execution session with immediate rollback available. Roll
   back on the first error and cap the diagnostic interval at five minutes;
   if cleanup is delayed, continue until verified and report the delay as a
   failure. This plan does not install an independent deployment watchdog, so
   process/machine failure remains a limitation requiring approval.
3. Immediately verify canonical deployment identity, candidate entry SHA, every
   added asset, unchanged 22 original served files, served manifest bytes and
   security-header effects. Open the existing staging add-in only in Document19.
   Inspect the pane title, iframe origin/path, visible identity and `ready` DOM
   status; check that script names match PACKAGE.json. A ribbon button name alone
   is insufficient. If identity or readiness fails, roll back without capture.
4. Confirm Document19 and its synthetic material through Word UI, select only
   that material with supported Word controls, and save a private screenshot
   of the identified ready pane before any raw XML appears. Use the adapted
   [DOM collector](collect-dom.REDACTED.js), binding the actual test-tab handle
   and protected original-tab ID in CUA. It reads the existing exporter and
   clicks once, writes a new mode-0600 JSON and reports only its path/hash and
   content-free observations. No owner typing, console, clipboard or download
   step is required. The collector cannot infer document identity; the prior
   operator check is mandatory. On any exception, never recapture.
5. On success or any obstacle, close only the diagnostic test pane/tab and
   immediately POST the retained-deployment rollback through the Cloudflare
   connector. If that fails, restore the pinned rollback frontend via the same
   existing direct upload method, without rebuilding. Keep trying the identified
   rollback operation until its outcome is known; never delete registrations or
   clear sessions. Report any overrun or unconfirmed rollback explicitly.
6. Verify canonical pointer restoration plus all 23 original body hashes on the
   staging origin and original header effects, including `/taskpane` and SSO
   entry aliases. The hidden `_headers` rule file cannot be re-downloaded; the
   retained deployment and observed effects are its verification. Do not claim
   complete restoration from an entry-only comparison. Confirm all original
   resource names remain available. Only after verified rollback, compare the
   private same-capture original/current/target XML, including current–target,
   and publish a sanitized finding. A new capture never proves the historical
   Apply's first failing branch.

Prepared direct upload command (NOT RUN; REPLACE_REVIEWED_HEAD must be replaced
by the exact owner-approved PR head, not inferred from a working checkout):

```sh
cd /tmp/olc74-staging-readonly-review/package-final/candidate
CLOUDFLARE_ACCOUNT_ID=82209a4cf04d77c6ca8cf2f9e6a81a40 WRANGLER_SEND_METRICS=false CI=true \
node /home/rajko/.npm/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js \
  pages deploy ./frontend --project-name olc-word-staging --branch main \
  --commit-hash REPLACE_REVIEWED_HEAD --commit-dirty=false \
  --commit-message 'OLC-74 temporary read-only diagnostic; no Engine change'
```

Fallback command uses `package-final/rollback` as cwd and the original source
`fddc65d7ebf8a2f5e16332a322adca5783deacfd` for `--commit-hash`, otherwise the
same fixed project/branch and an explicit rollback message. The existing CLI
is Wrangler 4.151.3; launcher SHA-256 is
`780661a508810f3b65786895b1ca9aacbc4f55d329ae6b8c1e49ec8433569f77`,
its `wrangler-dist/cli.js` SHA-256 is
`85a0fd68160392c7b9233a2a3406a94d61ab2a84d6dc192ebcb758774a76ee61`.
Do not invoke npx or install dependencies during activation. The current tool's
ability to read Cloudflare is verified; future write authorization is not
exercised by this preparation and must pass the execution preflight.

## Preparation checks and limits

Exact-packet fake runtime tests passed: no automatic capture; one click plus a
repeated event produces one capture/inspect; first triple exported as plain DOM
text; zero writes, searches, reselects, releases, fetch or XHR; fail-closed
one-shot capture error; non-Word host rejection; marker precedence over explicit
proposal query. Packet inventory, old-file equality and both archive hashes
passed. Altering the baseline was rejected before output creation, and an
existing output packet could not be overwritten. Two independent offline
assemblies produced identical archive hashes.
These are fake-runtime checks, not a real Word or CSP-browser acceptance test.
Actual temporary delivery, document identity, Word capture/Apply/Undo/Redo and
rollback execution are NOT RUN. Product source, harness source, manifests,
package and dependency lock are unchanged in this review unit. Existing broad
suite/build/environment limitations recorded in PR #5 still apply; this packet
was assembled from preserved bytes without rebuilding or repeating those gates.
The candidate is for review; OLC-74 remains open.
