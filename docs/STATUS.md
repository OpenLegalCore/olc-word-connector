# Word Connector — OLC-72 and OLC-74 review status

Updated: 2026-10-25. Microsoft SSO reopen and post-idle access checks have
**MANUAL PASS** owner acceptance; PR #2 remains draft and under review,
`codex/olc-72-word-native-sse`.

## Isolated OLC-74 adapter candidate — 2026-10-25

**IN REVIEW / NOT DEPLOYED.** Separate branch `codex/olc-74-word-adapter-offline`
starts at Word PR #2 `69dbe682100575a6492fdf8fbfcde2b5b7eeaa45` and targets
Engine PR54 `eef8ed0794046922842258ce587aab722db5fcb4`. It accepts validated
proposal-only results without inventing explanation, retains legal-source
validation, and narrowly accepts Engine-admitted content-only revision results
with the actual frozen selection. Empty explanation no longer enables blank
Copy answer; the proposal's separate explicit actions remain available.

See [adapter contract, evidence, delivery dependencies and rollback](OLC74_ADAPTER_HANDOFF.md).
No active SSO, Pages, Worker, Engine, Tunnel, DNS, browser or Word state was
changed. The owner MANUAL PASS from PR #2 documentation commit
`c2b8b63c496d34ae89688bd544b66aeb4824a6aa` covers repeated pane reopen and
one post-idle access check. Preservation of nonempty input, language and
attached/removed selection remains NOT_RUN; see the exact acceptance below. Existing historical entries below retain their original
checkpoint context. The new adapter has offline evidence only; actual model,
Word editing and durable result reopen remain unqualified.

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
