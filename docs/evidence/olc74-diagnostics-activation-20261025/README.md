# OLC-74 diagnostics — actual authorized staging activation, 2026-10-25

**STAGING_DELIVERED / POSTFLIGHT PASS.** This records the owner's explicitly
authorized activation of reviewed Word source
`dc3bef4a8b7adac234bb92720f97a9106179be25`. It is delivery evidence, not resolution
of the historical Word incident or acceptance of a new Word/model result.

| Component | Actual deployment/version | Result |
| --- | --- | --- |
| Pages `olc-word-staging` | `4bcc267c-62f0-461b-98af-6583436a6bc4` | canonical success |
| Delivered Pages source | `dc3bef4a8b7adac234bb92720f97a9106179be25` | exact approved source |
| Auth/store version | `8ec17425-5690-46ed-801a-fe214ebaff3b` | 100% |
| Auth deployment | `9d1a87ef-8a7a-40bc-9511-b2d94bcf7c6d` | read back |
| API version | `cfb80b7b-78ed-4da3-8a4a-4b9462c9deb0` | 100% |
| API deployment | `ea2e322e-1b05-4e5c-821e-18bff638481e` | read back |
| Taskpane | `taskpane.707c14a555d660b1559b.js` | SHA-256 `863781c58cba0e5d787f32948469f0d3f6548f306d4c973b03eb7ab71d5c7c92` |
| Loaded-bundle identifier embedded in delivered JS | `word-e37f072f824c4a8121ed20b628b457249a52fbc0cde0a015b36b8c2fa883eedc` | delivered bytes verified; owner's open pane not inspected/reloaded |

## Authorization, package and preflight

Archive `olc74-word-diagnostics-dc3bef4a8b7adac2.tar.gz` has SHA-256
`38b7d994747175bb4e6a80e0d143fc642fc4c196bcc367eadfb161b6cb9e7631`.
Fresh extraction and all **68 internal payload checksums PASS**. The immutable
original package and both earlier delivery/recovery packages remain untouched.
[Exact approved-source CI](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40193880238)
is completed/success: 698 PASS / 1 protected live SKIP. Existing prepared bytes
were used; no build, dependency install or new product change was made.

Fresh readback matched the expected baseline: Pages `82da70e6…` / source
`e8ff0317…`, Auth `0ea8304d…`, API `da36e666…`, each Worker 100%. Current rollback
static bytes/headers passed 26 checks before activation. Settings, bindings and
namespace were fingerprinted without exporting variable values or credentials.
Read-only socket samples found no established Engine listener connections before
upload/traffic switching; there is no independent application active-generation
counter. No owner work was observed or cancelled. Existing Engine process
identity matches the retained operator proof; imports/profile were not reprobed.
The protected Tunnel mapping remains the prior **owner-executed** evidence.

See [preflight](preflight.json), [ordered execution and exit codes](execution.json)
and [inert version verification](inert-versions.json). The documented historical
migration tag remains `word-session-v1`; no new migration or namespace was applied.

## Actual activation and postflight

Inert uploads returned Auth `8ec17425…` and API `cfb80b7b…`, exit 0. Both old
versions were still 100% at the inert verification. Downloaded module bytes match
the package's compiled Worker checksums and retained JOSE notice. Version bindings,
namespace and runtime/migration tag match baseline; settings fingerprints match.
Only then did the reviewed commands switch **Auth/store → API → frontend**, all
exit 0, with intermediate traffic/Pages readbacks. Pages channel `main` is only
the existing staging channel; no GitHub-main change, merge or production promotion.

- [Frontend postflight](frontend-static.json): **78/78 PASS** on immutable,
  `olc-word-staging.pages.dev` and `word-staging.openlegalcore.org`. All 23 served
  files per host match the package; `_headers` matches locally and its effects
  are checked. Taskpane/signin/redirect with and without `.html` have the exact
  approved CSP and no-store. Manifest, immutable asset cache, no-referrer,
  nosniff, HSTS and absence of X-Frame-Options pass. No script was executed.
- [Control plane](control-plane.json): exact versions/100% traffic, unchanged
  binding/setting fingerprints, existing namespace, historical migration tag,
  domains, static project settings, disabled automatic production/previews and
  existing Word routes. Worker preview subdomains remain disabled.
- [Diagnostic GET protection](diagnostic-get.json): missing capability, with or
  without an attempt ID, returns **401 SESSION_EXPIRED**; foreign Origin and
  cross-site GET return **403 ACCESS_DENIED**; query string returns **400**.
  Responses have gateway marker and no-store. These are read-only admission
  checks, not synthetic diagnostic entries. The public MSAL configuration remains
  byte-identical, **200**, no-store. No capability was issued or refreshed.
- **Authorized empty lookup: NOT_RUN.** Supported connected Word-session inventory
  is empty and no current Word capability is available. No session, credential
  extraction, sign-in or artificial completion/production record was created.
  Thus live successful store lookup/receipt and Word clipboard remain unaccepted.

Cloudflare metadata cannot expose secret values. Existing secret bindings were
inherited using the reviewed upload controls; no secret-setting operation occurred.
No credential value was exported or exercised through a provider call. Fingerprints
for secret bindings describe API-visible references/metadata, not a secret-value
verification. Raw CLI/configuration output stays private and is not published.

## Rollback and acceptance limits

[Rollback remains available, not executed](rollback.json): exact 24-file e8ff0317
frontend, retained Pages `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4` with **26/26** fresh
immutable-host byte/header checks PASS, API `da36e666…` and Auth `0ea8304d…` readable.
The reviewed order is frontend → API → Auth/store. Namespace, current sessions,
credentials and user data must be retained; there is no data restore/reset.
No proven postflight regression required rollback. Actual rollback execution
remains NOT_RUN.

The historical incident remains **FAIL_OWNER_REPORTED / UNDETERMINED**. The
original OLC-72 login **MANUAL PASS** record is unchanged and does not accept
this diagnostic delivery. Engine correlation remains **UNSUPPORTED** at pin
`eef8ed0794046922842258ce587aab722db5fcb4`; its already documented missing
correlation contract was not implemented here.

**NOT_RUN:** successful authorized empty lookup, live joined receipt, clipboard
in the owner's Word host, newly loaded owner's pane, new model behavior,
proposal display/use, Apply, Undo/Redo, saved-result reopen and remaining
nonempty draft/language/attachment retention. No new Word test was initiated.
No completion/provider call, owner request replay, open Word/browser action or
Engine/Tunnel/DNS/LWS/Studio change occurred. No new product test suite was needed
for this documentation-only record; approved-source CI is identified separately
from the later evidence commit. PR #3 remains draft/unmerged.
