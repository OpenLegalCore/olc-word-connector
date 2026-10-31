# Word Connector — OLC-72 and OLC-74 review status

## OLC-74 approved native diagnostic attempt — blocked before sideload

The owner-approved one-time v2 CA lease was restored in 24.902 seconds; other
NSS entries matched baseline and Chrome again rejected localhost TLS. The
separate synthetic Word test reached an Enable Developer Mode prompt and was
stopped before confirming or establishing a dev registration. No native
read-only pane, capture or XML triple resulted. The Developer Mode scope is
unverified. See the [sanitized execution result](evidence/olc74-readonly-sideload-review/RUN-20261031.md).
OLC-74 remains open; Engine remains `54552da`.

## OLC-74 read-only sideload diagnostic — IN REVIEW

A test-only, one-shot Word probe and DOM export candidate is prepared for
independent review. The real historical Apply rejection remains unexplained;
the previously observed diagnostic OOXML mismatch has no captured XML diff.
The dev manifest remains unchanged, and the candidate is not delivered,
sideloaded or native-Word accepted. A web sideload may leave a development
registration whose selective cleanup is unverified. Owner approval is required
before a new CA lease or sideload; OLC-74 stays open. Targeted fake-runtime
tests pass; full-suite and remote manifest validation have limitations. See the
[review package and exact operating plan](evidence/olc74-readonly-sideload-review/README.md).

## Inactive OLC-74 correlated capture candidate

[Prospective diagnostic correlation](evidence/olc74-correlated-capture/README.sl.md)
adds final-wire hash/bytes and Engine completion ACK to the existing private
receipt, with unchanged TTL, authentication and Apply. It is not activated or an
incident fix. The owner export has been analyzed; the historical run join and
specific guard remain unproven. Prior source findings and failed evidence remain.

Updated: 2026-10-25. Microsoft SSO reopen and post-idle access checks have
**MANUAL PASS** owner acceptance; PR #2 remains draft and under review,
`codex/olc-72-word-native-sse`.

## Owner-accepted login outcome

The owner manually confirmed the active Microsoft SSO task pane reconnects to a
usable form after repeated close-with-X/ribbon reopen, and that **Settings →
Check connection** succeeds after the agreed over-16-minute idle interval while
the pane stays open. These observations complete the owner-accepted login/access
objective for those two scenarios. They are manual reports, do not prove a
specific internal recovery mechanism, and do not accept preservation of a
nonempty draft, language or selection attachment. OLC-74 proposal acceptance is
a separate scope.

The corrected Microsoft API is **ACTIVATED** and its actual owner-token safe
probe passes. Pages source `edfaf1d` is delivered after successful exact-head CI. All 69
static comparisons, canonical-URL no-store/CSP checks and public configuration
checks pass. See
[actual delivery and manual protocol](evidence/olc72-microsoft-delivery-20261025/README.md). The retained rollback implementation is
`aa5d369f3e99067e8059a50fdd99f22535ca9810`. The owner's manual-login screenshot
showing **OLC Engine connected** and a usable form is accepted as evidence of
that delivered flow. The screenshot `image(20261025-084628).png` records the
successful post-idle check and “Sporočilo ni bilo poslano”. No automated or
specific internal-mechanism claim is made.

Remaining `NOT_RUN`: whether an interactive Microsoft/Cloudflare sign-in was
shown during either reported scenario; post-idle preservation of a nonempty
draft/language/attachment; the second idle check with the attachment removed;
runtime NAA and loaded-script diagnostics; unsupported-host fallback/cancellation;
and actual second-account denial. These do not undo the two manual passes above.
Proposal preview/apply semantics remain outside this SSO acceptance and are
tracked under OLC-74.

## End-to-end activation continuation (2026-10-25)

The owner authorized the dedicated staging registrations and a coordinated
activation/rollback after configuration and artifact gates. **The first activation was rolled back; OLC-72 is not complete.** Reviewed code `30e6b7b` and its successful CI
remain the source baseline. A fresh read of Pages and all three Worker versions
matches the retained aa5 activation record; both session Workers' current plain
variables match retained private operator configuration. A new HTTP comparison
verified all 45 static files across the custom, canonical and immutable hosts.
Anonymous session/models GETs return 401; the old delivery has no Microsoft
configuration endpoint (404).

The retained 48-file package was verified and a separate package rebuilt from
`30e6b7b`, including its concurrent-401 fix, the approved real-host manifest,
identical CSS/icons and byte-identical aa5 rollback. No source/configuration,
live Entra/Cloudflare/Engine state or document was changed by these checks.

The owner has manually created the dedicated **OLC Word Connector Staging SPA**
and **OLC Word Connector Staging API** and supplied their actual IDs, scope and
screenshot-based configuration evidence. No duplicate registration is needed.
The owner confirmed API account types and completed real Microsoft sign-in.
The receiver cryptographically verified the actual user API token and saved only
the private `tid:oid`; application/directory object IDs were not used.

An operator-only MSAL sign-in page and loopback verifier now provide the missing
acquisition path without copying tokens. An additive Pages overlay preserves the
aa5 application while the owner signs in; no Worker/Engine authorization changes
occur during enrollment. The additive overlay was delivered after successful exact-head CI for
`4e70228`; 60/60 static comparisons and the existing anonymous API denial passed.
At that enrollment-overlay stage the task pane remained aa5d369 and all Workers
were unchanged. The loopback
receiver completed owner verification. The first API activation returned 503
before capability issuance and was rolled back to aa5 Worker versions.
A deterministic workerd regression now reproduces the unsupported `redirect:
"error"` fetch option; `manual` plus fail-closed response checking fixes it.
Correction `4c99928` passed all gates/CI and was activated: actual Microsoft
issuance, session, models and revoke passed (200), then revoked session returned
401. Final static checks found `.html` canonicalization bypassed the no-store
rules; explicit extensionless rules were delivered in `edfaf1d` and passed all
69 static/header comparisons. At that activation checkpoint, Word acceptance
was pending; the later owner results are recorded in the
[delivery acceptance evidence](evidence/olc72-microsoft-delivery-20261025/README.md).
See
[owner enrollment](MICROSOFT_SSO.md#owner-enrollment-continuation-2026-10-25).

See the [fresh preflight evidence](evidence/olc72-activation-preflight-20261025/README.md).

## Concurrent 401 follow-up (2026-10-25)

The owner-reported race was reproduced on reviewed head
`e8e247e5f128e5d139b753920fdfc65573f28488`: with Microsoft renewal held,
the second original GET retried with `Bearer undefined`. The deterministic
regression failed in both response orders before production code was changed.
Safe GETs now await the shared silent renewal or use the valid newer capability;
retry requires a present, unexpired capability. A delayed retry's 401 invalidates
only its own capability, preserving a newer session. Each GET still retries at
most once, completion POSTs never replay, and cancellation of a waiter does not
cancel renewal for the other request. No automatic interactive sign-in is added.

The new focused tests also cover rejected identity/capability renewal, both
cancelled waiter positions and stale original/retry responses. See the
[regression and verification record](evidence/olc72-concurrent-401-20261025/README.md)
for RED/GREEN results, exact local commands and Entra inventory findings.
This source correction remains **IN REVIEW / NOT ACTIVATED**.

Read-only connector discovery found no Entra/Microsoft Graph directory-management
connection; `az`, `mgc` and `pwsh` are absent. Therefore the actual SPA/API
registration inventory remains **NOT_QUERIED**, and registration existence is
**UNKNOWN**, not absent. The missing capability is an authenticated directory
connection able to read applications (normally `Application.Read.All`; personal
account ownership listing also requires `User.Read`). No existing Word login is
claimed as that directory authorization, and no live auth/configuration changes
were attempted.

## Candidate implementation

- Runtime `NestedAppAuth 1.1` detection, MSAL silent acquisition/renewal and an
  explicit Microsoft-only interactive action when login/consent is required.
  Unsupported hosts have a same-origin Office-dialog/standard-MSAL fallback.
- API-specific delegated scope and distinct API audience, trusted Microsoft
  discovery/JWKS, signature/key issuer, issuer, lifetime, SPA client and scope
  validation. Graph tokens, ID-token substitutes and other valid Microsoft
  users are not accepted as application authorization.
- Explicit owner `tid:oid` authorization, including checks for existing
  capabilities on each protected API access and immediately before SSE start.
- Coalesced, bounded renewal of the memory-only 15-minute Word capability from
  the silently obtained Microsoft token. No persistent token/draft storage,
  Cloudflare user fallback, automatic completion replay or automatic Word write.
- Connecting → usable form; one main Microsoft sign-in action; manual check in
  Settings. Main-view internal error codes are removed. Preflight before Send
  preserves draft, locale and attached/removed selection when interaction is
  required; recovery returns to the form without submitting it.
- Existing API forwarding, server-only Engine/service credentials, outbound
  Tunnel/cloudflared on Medo, DNS, routes and local Engine remain unchanged.
  There is no inbound connection or port forwarding.

## Evidence and limits

| Layer | Actual result |
| --- | --- |
| Starting PR head / local recovery ref | `d6c365840759364fc7793bb6b202a748113ebfac`; preserved before editing |
| Registration discovery | No Microsoft registration configured in the inspected project; external Entra directory not accessible/verified |
| Missing activation input | Actual distinct SPA/API registration IDs, delegated scope/redirect/consent configuration and verified owner `tid:oid`; no values invented |
| Offline suite | **636 PASS / 1 protected-live SKIP**, 39 passing files / 1 skipped |
| Local contribution gates | All 18 commands pass: locked install, production audit (0 vulnerabilities), full tests, typecheck, lint, exact CI formatting, 4 manifests, 5 frontend builds, Worker build, bundle isolation and diff check |
| Synthetic auth scenarios | Silent/new-pane acquisition, 15-minute capability renewal, concurrency, bounded denial, consent/cancellation, unsupported-host fallback, wrong issuer/audience/scope/client/signature, key rollover and account denial tested |
| Synthetic runtime recovery | Multiline draft, SL/EN and both attached/removed choices retained; no completion or document write |
| Actual Microsoft/Entra/Word NAA/fallback | **NOT_RUN**; registration/owner configuration missing, no actual host support inferred |
| Prepared staging and rollback | 48 artifact files, approved real-host manifest, accepted CSS/icons and aa5 rollback copied/verified; no deployment or fresh live control-plane attestation |
| Exact-current-head CI | Must be checked after this follow-up is published; the previous successful run on `e8e247e` does not establish the new head result |
| Current delivery / infrastructure | Preserved; no live Entra/Cloudflare/auth/Tunnel/DNS/Engine change, OAuth login, completion, document write or merge |

The original user checkout and its two documentation edits, all prior clones,
windows/processes, recovery refs and activation packages are preserved. Work is
isolated in a new temporary clone of the existing PR branch. The retained
[Cloudflare activation record](evidence/olc72-word-session-activation-20261024/README.md)
and [browser-surface handoff](evidence/olc72-word-session-activation-20261024/word-surface-handoff.md)
remain historical evidence; they do not qualify Microsoft SSO.

## Concrete next action

The operator must inspect/reuse or prepare the two registrations with the exact
account types, staging redirects, API scope and allowed SPA listed in
[Microsoft SSO configuration](MICROSOFT_SSO.md#registration-discovery-and-exact-missing-configuration),
then provide their actual IDs and verified owner principal through protected
configuration. No client secret, Graph permission, Cloudflare login, Tunnel
change or network reconfiguration is needed. The independent code is complete;
missing configuration is an activation blocker, not a request to redesign SSO.

Then require exact-head CI and review the
[prepared coordinated activation/rollback](MICROSOFT_SSO_STAGING.md) before any
delivery switch. Actual Word silent startup/reopen/idle recovery and fallback
acceptance remain separate gates, using only session/model discovery and
synthetic input, without Send or a Word write.

See [architecture and registration contract](MICROSOFT_SSO.md),
[sanitized candidate evidence](evidence/olc72-microsoft-sso-20261024/README.md),
and [third-party provenance](UPSTREAM_SOURCES.md#microsoft-identity--olc-72).

## OLC-74 adapter and staging activation — 2026-10-25

**IN REVIEW / STAGING DELIVERED / NATIVE ACCEPTANCE NOT_RUN.** Development branch
`codex/olc-74-word-adapter-offline` retains product baseline `bacbecaa` and delivered
source `e8ff0317ef699204783de90eb65b6377a95ce9cd`; both Word PR #2 and #3 remain
draft and unmerged. Engine TEST pin is `eef8ed0794046922842258ce587aab722db5fcb4`.
The original [adapter contract and offline evidence](OLC74_ADAPTER_HANDOFF.md)
remain valid; no source, tests, dependencies, hosting or Worker changes were made.

The owner supplied the missing protected local Tunnel/process/listener read as
owner-executed evidence. It links the current API origin to the exact operator
Engine process with 53 checked imports and Planner sol/high/8000. It is not an
agent automated Tunnel check or a new model call. Read-only preflight found the
expected baseline and no established Engine connections at sampled times.

The approved 24-file frontend was uploaded unchanged from the verified archive.
Current canonical Pages deployment is `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4`, source
`e8ff0317`; all 78 delivered static-byte/critical-header checks pass. Approved
manifest, CSP/no-store, Microsoft auth assets, domains, project settings and both
Worker versions are preserved. The immediate previous SSO Pages deployment
`7e4bcdfe-11ff-4d61-9789-80962046e5b1` / source `edfaf1d` and exact 24-file rollback
remain available; 26 retained immutable-host checks pass. Rollback was not needed.
See [delivery, owner proof, checksums and acceptance limits](evidence/olc74-staging-activation-20261025/README.md).

The original SSO MANUAL PASS applies to its reported reopen/post-idle access
scenarios only. It is not upgraded to acceptance of the new adapter delivery.
Actual Word proposal display, explicit use, Undo/Redo, model behavior and saved
result reopening remain NOT_RUN. Nonempty draft/language/attachment preservation
also remains NOT_RUN. No provider/completion call, Word/browser action, Worker,
Engine, Tunnel/DNS change, GitHub main change, production promotion or merge occurred.

## OLC-74 actual Word trial — owner-reported failure, 2026-10-25

**FAIL_OWNER_REPORTED / ROOT CAUSE UNDETERMINED.** The owner reports that a selected
paragraph revision on active staging showed the generic safe-stop notice instead
of a proposal and reported the document unchanged. The screenshot is referenced
by name; its pixels and the owner tab's historical Network/console records were
not available to this review. The private document link and input are not copied.

The [read-only incident evidence](evidence/olc74-word-trial-20261025/README.md)
confirms current public taskpane HTML/JS match delivered e8ff0317 and both Worker
versions remain unchanged. Four Engine completion access entries return HTTP 200;
one predates activation, and none has an incident correlation ID. The request's
exact Engine reachability, browser/Worker HTTP status, terminal SSE result and
adapter error code remain UNKNOWN. The generic UI and an HTTP 200 header record
cannot establish a validation error or a successful stream. Missing evidence is
not a cause. No new completion, code fix, deployment or Word action was performed.

This failure supersedes NOT_RUN only for the owner's reported trial outcome.
Native Apply/Undo/Redo/result reopen and the other outstanding scenarios remain
NOT_RUN. The historical OLC-72 SSO MANUAL PASS is preserved separately.


## OLC-74 bounded diagnostics candidate — in review, not activated

The owner authorized a limited diagnostic implementation on PR #3 from `da7c959`. It adds per-attempt UUID/UTC/loaded-version metadata, fixed phase/reason codes, copy from the pane after navigation, and an authenticated bounded receipt in the existing Word session store. Frontend/API/store code must be delivered together later. All validations, no POST replay, SSO policy and explicit guarded Apply remain intact.

Local full gates PASS (696 tests, one protected live SKIP); final focused regressions PASS (58). Exact-head CI and the reviewed staging/rollback packet are recorded in the publication handoff. Fresh reads confirm the existing active source/deployment and both Worker versions; 26 static rollback checks PASS. Nothing was activated. See [contract and cleaned evidence](OLC74_DIAGNOSTICS.md).

The actual historical Word trial remains **FAIL_OWNER_REPORTED / UNDETERMINED**. The prior SSO **MANUAL PASS** is unchanged. Live new diagnostics, real model/Word proposal display/use, Undo/Redo, result reopen and remaining draft/language/attachment checks are **NOT_RUN**. Engine correlation is explicitly **UNSUPPORTED** at pin `eef8ed0794046922842258ce587aab722db5fcb4`; no Engine change or completion call was made.


## OLC-74 diagnostic staging activation — actual delivery, 2026-10-25

**STAGING_DELIVERED / POSTFLIGHT PASS; Word/model acceptance open.** The owner explicitly authorized exact reviewed source `dc3bef4a8b7adac234bb92720f97a9106179be25`. Inert Worker uploads were verified before the ordered Auth/store → API → frontend traffic switch. Current Pages is `4bcc267c-62f0-461b-98af-6583436a6bc4`; Auth/store version `8ec17425-5690-46ed-801a-fe214ebaff3b`, API `cfb80b7b-78ed-4da3-8a4a-4b9462c9deb0`, both 100%.

Archive SHA-256 and all 68 internal checksums PASS; approved-source CI 40193880238 PASS. Prepared bytes were used without builds, installs or product changes. Inert Worker code hashes and settings/binding/namespace comparisons PASS; no new migration. After activation, all 78 frontend byte/security-header checks PASS, unchanged public MSAL config PASS, unauthenticated/cross-origin/query diagnostic GET protections PASS. Domains, Word routes and project/runtime settings are preserved. No secret-setting operation or provider call occurred; API-visible secret-reference equality is not a secret-value test.

Authorized empty diagnostic lookup is **NOT_RUN** because supported tools expose no current Word capability/connected Word session. No session or artificial record was created. Owner Word/pane state was not inspected or reloaded, and no new Word test was initiated. Live receipt/clipboard, actual model/proposal use, Apply/Undo/Redo/reopen and the other outstanding retention scenarios remain **NOT_RUN**. The historical trial remains **FAIL_OWNER_REPORTED / UNDETERMINED** and the original login **MANUAL PASS** remains unchanged.

Rollback was not needed or executed. Exact current-before-activation e8ff0317 frontend/Pages `82da70e6…` and both previous Worker versions remain available; all 26 retained rollback byte/header checks PASS. See [actual identities, ordered exit codes, cleaned evidence and limitations](evidence/olc74-diagnostics-activation-20261025/README.md). PR #3 stays draft/unmerged. Engine pin and prior owner-executed Tunnel proof remain unchanged; no GitHub-main, Engine/Tunnel/DNS/LWS/Studio or open Word/browser change.


## OLC-74 SSE code investigation — candidate IN REVIEW, not activated

Attempt `bd72b0b0-acc9-442b-b147-8c0641aaa366` (14:00:35.812–14:00:44.429 UTC)
has owner-supplied HTTP 200 / SSE_ERROR_EVENT. Cause **UNDETERMINED**, original
SSE code **NOT_RECOVERED**. The lone temporally adjacent Engine 200 lacks a joining
identity/terminal and is not attributed. Complete historical request bytes and
protected inspection records are unavailable; missing evidence is not a cause.

The minimal frontend candidate preserves only 16 pinned exact upstream error
codes, otherwise UNKNOWN, into bounded copyable diagnostics. No request-profile
change was justified: full actual-adapter/gateway synthetic SL/EN byte vectors
pass pure admission validators at Engine `eef8ed0794046922842258ce587aab722db5fcb4`.
This does not validate the actual incident body or semantic model behavior.
Local gates PASS: 732 tests, one protected live SKIP, 92 targeted PASS, all other
required gates PASS. Exact final-head CI and source/package SHA are linked in PR #3.
See [clean evidence, limitations and candidate](evidence/olc74-sse-code-20261025/README.md).

Active staging stays `dc3bef4` / Pages `4bcc267c…`, with unchanged Auth/API versions;
26 retained-baseline static checks PASS. No activation or provider/Word action.
Historical SSO MANUAL PASS and earlier FAIL_OWNER_REPORTED / UNDETERMINED remain
unchanged; real Word proposal/use and remaining acceptance remain NOT_RUN.


## OLC-74 frontend-only SSE diagnostics activation — 2026-10-25

**STAGING_DIAGNOSTICS_DELIVERED / POSTFLIGHT PASS; incident UNDETERMINED.**
Exact owner-approved product source `de34ecdbc6d53ce756ecfc2e44b7c7ff6133339f` is now
canonical Pages `6f22feb3-14cc-4fab-a3e0-d9b30cd55c79`. The prepared archive and all
56 internal checksums PASS; source CI 40208491747 PASS. Only prepared Pages bytes
were delivered, without build/install, Worker upload/switch, setting or route change.
All 78 served-byte/security-header checks and the taskpane asset/fingerprint on
immutable and both canonical hosts PASS. Public MSAL config is byte-identical.
Auth/store `8ec17425-5690-46ed-801a-fe214ebaff3b` and API
`cfb80b7b-78ed-4da3-8a4a-4b9462c9deb0` stay 100%; settings/binding/route fingerprints
match preflight. No secret-setting operation, Engine/Studio/LWS or open Word action.

Documentation correction for attempt `bd72b0b0-acc9-442b-b147-8c0641aaa366`:
owner supplied `frontendVersion: word-e37f072f824c4a8121ed20b628b457249a52fbc0cde0a015b36b8c2fa883eedc`.
Provenance: **podal lastnik, brez neodvisnega pregleda zavihka**. The prior claim
that this reported fingerprint was missing is corrected in this documentation-only
successor. Actual request body and original SSE code remain NOT_ACQUIRED; cause
UNDETERMINED. The approved product source/archive are preserved unchanged.

Rollback `4bcc267c…` / source `dc3bef4…` and its exact 24-file packet are retained;
26 baseline byte/header checks PASS. Rollback not needed/executed. No new completion,
provider call or independent Word test. Word clipboard/proposal display/use,
Apply/Undo/Redo/reopen and remaining acceptance are NOT_RUN. Historical SSO MANUAL
PASS and FAIL_OWNER_REPORTED are unchanged. See [actual cleaned delivery evidence](evidence/olc74-sse-activation-20261025/README.md).


## OLC-74 later owner attempt and isolated capture candidate — 2026-10-25

Owner supplied attempt `03deaad8-d499-4198-8399-5a0f615d0c03`,
16:51:39.442–16:51:49.056 UTC: HTTP 200 / SSE_ERROR_EVENT,
upstreamCode `terminal_validation_failed`, frontendVersion
`word-b597de926a50cb988c79b8aa166b7ba4da8c986aa2afb94d2509a28b3d3c28cb`.
Provenance: **podal lastnik, brez neodvisnega pregleda zavihka**. Concrete guard,
Writer output and joined Engine run remain **UNDETERMINED / NOT_ACQUIRED**.
Protected inspection is **NOT_READ** after automatic approval rejected its sudo
authentication method before execution; not an absence claim and no retry/bypass.
Engine metadata matches the retained eef8ed0 operator process/invocation/cwd proof;
no new protected import/byte verification. Nearby 200 is not attributed by time.

The proven code gap loses the fixed guard in private inspection. Unified work in
this session prepared [separate Engine draft PR #56](https://github.com/OpenLegalCore/olc-engine/pull/56),
source `1f81f126a5a70cb17fd9f5e78290c274d7f393fa`, from exact installed pin.
It adds fixed reason/field metadata and bounded private outer-handler capture,
without loosening validation, changing public SSE or adding a frontend notice.
Local final suite 2578 PASS / 461 prerequisite SKIP; separate Studio/LWS contracts
76 PASS / 37 PG SKIP, overlapping. Exact CI outcome is in the linked handoff.
**NOT ACTIVATED; this is a diagnostic candidate, not a proven incident fix.**
Historical reproduction is NOT_RUN because joined data are unavailable. Word UUID
joining remains unsupported; private run ID/bodyhash requires independently
retained actual sent bytes. No new provider/completion/replay, Word action,
Engine/Studio/LWS runtime or infrastructure change or merge. Word source/deployment/Workers/SSO and all
existing checkouts remain preserved. See [clean evidence and limits](evidence/olc74-terminal-failure-20261025/README.md).


## OLC-74 read-only sideload attempt — 2026-10-31

The second approved temporary CA lease was removed within its deadline, but the
Word ribbon opened the existing staging pane and the diagnostic capture did not
run. Chrome rejected localhost TLS after cleanup but still loaded the 127.0.0.1
variant; its cause is undetermined. Development registration status remains
unverified. No XML comparison or product fix was obtained. OLC-74 remains open;
see the [sanitized run report](evidence/olc74-readonly-sideload-review/RUN-20261031-SECOND-LEASE.md).


## OLC-74 manifest retrieval observation — review candidate

The diagnostic server now has a review-only, privacy-limited TLS/HTTP event
log and a control/observation boundary. Local HTTPS checks passed without a CA
import or Word sideload; actual manifest retrieval and Word registration remain
unverified. See the [observation plan](evidence/olc74-readonly-sideload-review/PLAN.md).
OLC-74 remains open.


## OLC-74 observed manifest attempt — 2026-10-31

After a control manifest response, the one-time observation recorded a TLS
handshake but no HTTP request before cleanup; Word showed no registration
dialog or local pane. CA removal was confirmed within the deadline. Chrome
rejected localhost TLS while the 127.0.0.1 test loaded; the difference remains
unexplained. No XML capture or product fix was obtained. See the [run
report](evidence/olc74-readonly-sideload-review/RUN-20261031-OBSERVED.md).
OLC-74 remains open.
