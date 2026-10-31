# OLC-74 — web sideload and read-only DOM export: owner review

Status: PREPARED, NOT APPROVED FOR EXECUTION. No real CA was imported and no
sideload was performed in this turn. Do not start any real trust lease, open the
sideload URL, or register the development add-in before a new owner approval.

## Reviewed candidate

- Read-only candidate: `/tmp/olc74-sideload-dom-candidate/CANDIDATE.json`;
  all 28 listed file hashes were checked. `DOM-CHANGE.diff` is the incremental
  change to the previously prepared harness, not a product change.
- Existing dev manifest: `manifest.xml`, SHA-256
  `c2ec4f5123d3b531142e9b87dbfe15a1a7d5637d9a3f180a131ccc75aea4ece3`,
  ID `7eb3a8cf-4fa9-47f2-a408-afe5f6c59515`, version `1.0.0.3`, source
  `https://localhost:3002/taskpane.html`. Server manifest endpoint is exactly
  `https://localhost:3002/manifest.xml`. Staging ID differs.
- Installed `office-addin-dev-settings` version 3.1.2, gitHead
  `881491636e34a1f2490586c3cf74a7d20861b926`, exports
  `generateSideloadUrl`. `generate-url.cjs` invoked it with the real manifest
  parser and the existing Document19 URL, omitting the fourth argument, whose
  default is false. Result: `document19-sideload.url` (0600); it has the expected
  `wdaddindevserverport=3002`, `wdaddinmanifestfile=manifest.xml` and exact dev
  GUID. It does not contain `wdaddintest`. The URL contains a document ID and
  should not be published. It has not been opened.
- `serve.cjs` verifies every candidate hash and serves only allowlisted static
  files via HTTPS on `127.0.0.1:3002`, with existing certificate and key,
  no upload/API, no query logging, `Access-Control-Allow-Origin: *`, and
  `Cache-Control: no-store`. It does not create or install certificates.
  Prior isolated test returned HTTP 200 with expected manifest SHA and CORS;
  curl explicitly used the CA for that process only. Server exited 0.
- The export-only pane requires real Office Word host. It does one new capture,
  one inspect and no insertText/Apply/release/Engine request. It shows the exact
  first retained JSON by `textContent` in `#readonly-export-evidence-json`.
  This deliberately makes synthetic-document text/XML readable to page DOM
  tooling and must be used only in the separate synthetic Document19. The old
  Blob link is retained; `collect-dom.js` reads DOM and writes mode-0600 JSON,
  no clipboard/download. Test/runtime evidence is fake-only so far.
- `SHA256.json` pins all operator artifacts; candidate JSON pins the complete
  static package. Existing prior real trust journal remains preserved. New
  scripts use `trust-lease-sideload-real.json` and refuse an existing journal,
  nickname, certificate or target trust object; watchdog is independent. On an
  isolated test NSS DB, import and timed rollback passed; real CA stays absent.

## Scope for separate owner approval

Approve a single temporary import of the exact CA below, shared per-user NSS
store and TLS CA trust `C,,` for at most five minutes, protected by watchdog and
fingerprint-guarded removal; and the normal, interactive-dialog web sideload
of the reviewed dev manifest in Document19 to run one read-only synthetic
capture. CA fingerprint:

`62:0F:86:06:85:C2:63:A1:6C:2B:56:08:80:4F:B2:4C:53:FB:27:43:05:13:7E:48:1C:FC:B2:51:FB:E2:00:0F`

NSS store: `sql:/home/rajko/.pki/nssdb`. It is shared with other applications
that use that NSS database; CA trust is not scoped to localhost. The real Chrome
PID, CA and leaf chain, baseline and all candidate/operator hashes must match
immediately before execution. No automatic repeat or extension is authorized.

## Future execution, conditional on approval

1. Verify Chrome still has Document17 open, leave it and its pane/objects alone.
   Reopen the separate Document19 in an agent-owned Chrome tab; its material is
   synthetic. Check that no development add-in of this ID is visibly registered.
   An empty My Add-ins list alone does not prove absence: record this uncertainty.
   Verify `/tmp/olc74-sideload-review/document19-sideload.url` hash and exact
   Document19 ID/parameters, and all hashes from `SHA256.json` and `CANDIDATE.json`.
2. Start `node /tmp/olc74-sideload-review/serve.cjs` as a managed process and
   verify manifest endpoint/certificate. Start the independent watchdog before
   any trust mutation:

   `python3 /tmp/olc74-sideload-review/olc74-ca-watchdog.py --db /home/rajko/.pki/nssdb --seconds 300`

   Verify watchdog stays active and `trust-lease-sideload-real.json` does not
   exist. The existing prior `trust-lease-real.json` stays untouched.
3. Perform the one authorized lease:

   `python3 /tmp/olc74-sideload-review/olc74-ca-lease.py begin --db /home/rajko/.pki/nssdb --authorized`

   Verify identity and status `added`. Open the generated URL in a separate tab
   of the existing Chrome profile using supported browser control. Do not use
   `npm start`, `launchWebApp`, a default browser, `wdaddintest`, a warning bypass,
   hidden debugger, clipboard, or a refresh of Document17. Respect the ordinary
   Microsoft sideload confirmation dialogs; stop if their text or permissions
   differ from the approved dev manifest or a per-action handoff is required.
   The Document19 URL is an existing open-link URL, not a separately verified
   copied Share URL; acceptance by Word is explicitly unverified.
4. If sideload succeeds, inspect the actual add-in/iframe identity and select
   only synthetic Document19 material through Word UI. Run the reviewed
   `collect-dom.js` in the supported CUA environment with `olc74TestTab` bound
   to the isolated tab. It refuses Document17, activates only a ready local
   export pane, takes one capture and saves the same capture's triple as private
   JSON. Verify scope and compare raw original/current/target and XML structure,
   including current vs target. Do not send or log raw document XML.
5. On success, error, timeout or cancellation, immediately run guarded removal:

   `python3 /tmp/olc74-sideload-review/olc74-ca-lease.py end --db /home/rajko/.pki/nssdb --authorized`

   Verify its state, target certificate/nickname/trust object absent and other
   NSS records unchanged; while the server is still up, confirm a fresh Chrome
   tab rejects localhost TLS again. If guarded cleanup refuses or fails, report
   it and retain the journal, do not blindly delete. Watchdog covers the time
   limit but cannot guarantee cleanup after machine/process failure. Stop the
   specific server process and close only temporary tabs. No automatic reimport.

Web sideload may leave a development registration in browser local storage.
The current supported UI has not established a way to prove the baseline or
remove only this development registration while preserving staging. Do not clear
cache, delete registrations blindly, remove staging, sign out or use `npm stop`.
If a separate dev registration remains, report it and the unverified cleanup;
any later removal requires an identified, separately reviewed method. CA
rollback, server shutdown and the temporary-tab cleanup are independently
verifiable and must not be described as full registration rollback.

## Evidence and checks

- Targeted fake-runtime tests: 2 files / 16 tests pass. `npm run lint`,
  `npm run typecheck` using existing complete fixture dependencies, `npm run
  build:word-harness`, `npm run build`, `npm run verify:bundle` all exit 0.
  Initial typecheck with the main checkout's incomplete node_modules failed on
  missing `miniflare` and `esbuild`; no dependencies were installed.
- `npm run validate:dev` exited 1: Microsoft validation service DNS unavailable
  (`EAI_AGAIN`). This is not a manifest validation pass.
- `npm test -- --run` was interrupted (exit 130) after sandboxed loopback socket
  failures and stalled worker tests. A focused existing ownerSignin suite exits
  1 with `listen EPERM` at 127.0.0.1; full-suite and worker status unverified.
  This does not invalidate the 16 targeted fake tests but is not a broad pass.
- No actual Word native run, XML difference, product bug fix, Apply/Undo/Redo,
  Engine or SSO change, staging manifest change, product delivery or merge.
  Original Document17 and its staging objects were not touched. OLC-74 is open.
