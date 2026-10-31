# OLC-74 — web sideload and read-only DOM export: owner review

Status: PREPARED, NOT APPROVED FOR EXECUTION. No real CA was imported and no
sideload was performed in this turn. Do not start any real trust lease, open the
sideload URL, or register the development add-in before a new owner approval.

## Reviewed candidate

- Read-only candidate: `/tmp/olc74-sideload-dom-candidate/CANDIDATE.json`;
  all 28 listed file hashes were checked. The locally preserved
  `DOM-CHANGE.diff` is the incremental change, not a product change.
- The exact prepared [taskpane.html](taskpane.html) is also published here.
  Its SHA-256 is
  `5c9bf7cbc65a330ed057aa05b6989cdf751d9587a7573c2e62f63f90f3f26595`.
  Starting from the `npm run build:word-harness` output, insert exactly the
  following bytes once immediately before `</head>`:

  ```html
  <meta name="olc74-readonly-export" content="1">
  ```

  Verify the resulting bytes and SHA-256 match this published file and
  `CANDIDATE.json`; stop if they do not. This operation is for a new temporary
  candidate, not for rewriting the preserved candidate. The deferred
  `taskpane.js` invokes the marker check first and returns after binding the
  read-only exporter, before proposal or normal harness composition. The test
  uses the exact published HTML even when `?proposal=explicit` is present.

  From the repository root, after the Word harness build, this read-only
  comparison validates the minimal transformation without altering either
  existing file:

  ```sh
  python3 - <<'PY'
  from pathlib import Path
  import hashlib
  built = Path('dist/word-harness/taskpane.html').read_bytes()
  saved = Path('docs/evidence/olc74-readonly-sideload-review/taskpane.html').read_bytes()
  marker = b'<meta name="olc74-readonly-export" content="1">'
  assert built.count(b'</head>') == 1 and marker not in built
  result = built.replace(b'</head>', marker + b'</head>', 1)
  assert result == saved
  assert hashlib.sha256(result).hexdigest() == '5c9bf7cbc65a330ed057aa05b6989cdf751d9587a7573c2e62f63f90f3f26595'
  print('candidate HTML matches')
  PY
  ```
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
- `LOCAL-ARTIFACT-SHA256.json` preserves the original candidate/script hashes;
  `REVIEW-FILES-SHA256.json` pins the revised local lease and watchdog and the
  exact HTML. The prior real trust journal and candidate remain preserved. The
  revised scripts use `trust-lease-sideload-v2-real.json` and refuse an existing
  journal, nickname, certificate or target trust object. The independent watchdog
  starts guarded cleanup at 240 seconds, leaving 60 seconds before the deadline.
  It never kills an in-flight cleanup at the deadline: it reports the overrun,
  waits for the process and returns failure even if deletion later succeeds.
  Guarded deletion itself has no killing timeout. Concurrent begin/end calls use
  a lock. A 300-second absolute maximum still cannot be guaranteed if cleanup or
  the machine stalls; any overrun or unconfirmed removal is a failure, not PASS.

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
   Document19 ID/parameters, and all hashes from `LOCAL-ARTIFACT-SHA256.json`,
   `REVIEW-FILES-SHA256.json` and `CANDIDATE.json`. The revised lease/watchdog
   are copied byte-for-byte into `/tmp/olc74-sideload-review-v2/`; the previous
   `/tmp/olc74-sideload-review/` files are not overwritten.
2. Start `node /tmp/olc74-sideload-review/serve.cjs` as a managed process and
   verify manifest endpoint/certificate. Start the independent watchdog before
   any trust mutation:

   `python3 /tmp/olc74-sideload-review-v2/olc74-ca-watchdog.py --db /home/rajko/.pki/nssdb --seconds 300`

   Verify watchdog stays active and `trust-lease-sideload-v2-real.json` does not
   exist. The watchdog waits for the journal without an automatic timeout; if
   begin fails with no journal or trust added, stop the unused watchdog. The
   existing prior `trust-lease-real.json` stays untouched.
3. Perform the one authorized lease:

   `python3 /tmp/olc74-sideload-review-v2/olc74-ca-lease.py begin --db /home/rajko/.pki/nssdb --authorized`

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

   `python3 /tmp/olc74-sideload-review-v2/olc74-ca-lease.py end --db /home/rajko/.pki/nssdb --authorized`

   Verify its state, target certificate/nickname/trust object absent and other
   NSS records unchanged; while the server is still up, confirm a fresh Chrome
   tab rejects localhost TLS again. If guarded cleanup refuses or fails, report
   it and retain the journal, do not blindly delete. Watchdog covers the time
   limit but cannot guarantee cleanup after machine/process failure. Stop the
   specific server process and close only temporary tabs. Do not terminate an
   in-flight cleanup when the deadline expires; report deadline breach and wait
   for removal confirmation. No automatic reimport.

Web sideload may leave a development registration in browser local storage.
The current supported UI has not established a way to prove the baseline or
remove only this development registration while preserving staging. Do not clear
cache, delete registrations blindly, remove staging, sign out or use `npm stop`.
If a separate dev registration remains, report it and the unverified cleanup;
any later removal requires an identified, separately reviewed method. CA
rollback, server shutdown and the temporary-tab cleanup are independently
verifiable and must not be described as full registration rollback.

## Evidence and checks

- Review follow-up: isolated fake-file regressions exercise delayed deletion
  both before and after a scaled deadline, plus failed and invalid-journal cases.
  `python3 test/word-harness/test_olc74_watchdog.py -v` passed 4/4. Actual
  fake-marker removal occurred at 1.114 s of a 1.600 s deadline in the on-time
  case and 1.914 s in the deliberately late case; the latter returned failure
  after the child finished. These are fake markers, not CA trust measurements;
  no CA was imported. The exact published HTML hash, marker and read-only
  priority were tested with fake Word runtime (7/7 exporter tests). Neither test
  establishes native Word behavior.
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


## Follow-up: observe manifest retrieval (review only)

The revised [serve.cjs](serve.cjs) is pinned in `REVIEW-FILES-SHA256.json`;
`LOCAL-ARTIFACT-SHA256.json` still pins the preserved original local server.
The revised server does not change the candidate, response headers, permissions,
or CORS. Start the reviewed file directly, capture stdout to a new private
mode-0600 file, and record its PID. For example, from the reviewed checkout:

```sh
umask 077
set -C
node docs/evidence/olc74-readonly-sideload-review/serve.cjs > /tmp/olc74-server-observation-NEW.jsonl 2>&1 &
server_pid=$!
# Verify the process is alive, the file is new and the expected READY line is present.
# Complete and close all control requests, then mark the boundary:
kill -USR2 "$server_pid"
# Verify the observation phase event before opening the separately approved flow.
```

Use a unique unused log filename; `set -C` prevents overwrite. Preserve prior
logs. Control requests run in `control` phase.
Close their connections before sending `kill -USR2 <server-pid>`; subsequent
records are tagged `observation`. This marks time, not client identity: any
concurrent process can send requests, and an old connection could be reused.
Stop if the boundary or exclusivity cannot be established. No headers, bodies,
client addresses, query strings, unknown paths, or arbitrary method/error
strings are logged. `other` conceals paths outside the candidate allowlist.

A `tls` record with `connected` means the server saw a completed handshake;
`error` contains a limited code or `OTHER`. A request record identifies an
allowlisted path and method; the corresponding response reports status and
`finished` or `closed-before-finish`. `finished` means Node handed the response
to its operating system, not that Word parsed or accepted it. For a finished
HTTP 200 manifest GET, the SHA-256 is calculated over streamed bytes.

After the next independently authorized registration confirmation, inspect
the retained JSON lines and the actual Word UI promptly, without clicking the
staging ribbon button as a substitute. Classify evidence conservatively:

- no observation-phase TLS or request events: no arrival observed; this does
  not establish why or exclude traffic outside the captured interval;
- TLS error: handshake failed at the server, with the limited recorded code;
- manifest request with non-200 or incomplete response: HTTP/response failure;
- completed manifest 200 and expected SHA: manifest sent, not accepted;
- a request for `/taskpane.html` (or subsequent allowlisted task-pane assets):
  local pane resource requested, not proof of a working pane.

Use the supported CUA Word tab's `playwright.domSnapshot()` for any visible
Word error and its `dev.logs({levels:['error','warn'], limit:100})` for
available captured console errors. The latter is best effort: it may not expose
network failures or all frame logs. Inspect locally and publish only a fixed
error category/code and sanitized visible message; never publish raw console
entries, document URLs, tokens, XML or session data. Save a private screenshot
of a visible Word error if present. If neither UI nor logs provide an error,
report it as unobserved. Preserve the test tab and the CA cleanup rules of this
plan; a new trust import or sideload needs separate explicit owner approval.

Targeted local validation, no trust import or sideload: `node --check
docs/evidence/olc74-readonly-sideload-review/serve.cjs` and an isolated Python
HTTPS client exercise passed. The client used the CA only in its own SSL
context (Python 3.13 strict flag disabled for this existing certificate),
checked manifest bytes/hash and CORS, taskpane 200, GET unknown path, POST
manifest and root 404, a rejected untrusted TLS handshake, phase tagging,
response completion and log redaction of query, cookie, origin and unknown
path. This does not test Microsoft Word, a browser's TLS state or registration.

Repository gates in this worktree: `npm run lint` exited 0. `npm run
typecheck` exited 2 (Office type definitions could not be resolved); `npm test
-- --run` exited 1 (Vitest config package resolution); `npm run build` exited
1 (unresolved loaders/dependencies); `npm run validate:dev` exited 1 (validation
service DNS `EAI_AGAIN`). `npm run verify:bundle` exited 0 against the existing
`dist/prod`, but the failed build means this is not a fresh-build gate. No
dependencies were installed. The isolated server checks above are the relevant
new passing checks, not a claim of a complete repository test pass.
