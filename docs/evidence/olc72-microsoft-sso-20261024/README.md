# Microsoft SSO candidate — 2026-10-24

**LOCAL IMPLEMENTATION / VALIDATION PASS. NOT ACTIVATED. ACTUAL MICROSOFT WORD: NOT_RUN.**

The primary OLC-72 objective remains removal of repeated Cloudflare user logins
and interruptions after idle time/reopening the pane. The owner's reported
manually authenticated **OLC Engine connected** form is accepted evidence of the
currently delivered aa5 flow. It is not relabeled as a failure or as new NAA
acceptance. Engine answer/content work was not taken over.

## Scope and source boundary

- Starting head `d6c365840759364fc7793bb6b202a748113ebfac`, retained in local
  `recovery/olc72-before-microsoft-sso-20261024` before changes.
- Same existing PR branch `codex/olc-72-word-native-sse`, draft PR #2. No merge.
- Delivered baseline remains `aa5d369f3e99067e8059a50fdd99f22535ca9810`.
  No live Entra, Cloudflare, authentication configuration, Pages/Worker version,
  Tunnel/cloudflared, DNS, local Engine or inbound network change was performed.
- The old user checkout, its two pre-existing documentation changes, other
  checkouts, prior recovery packages, windows and processes remain untouched.
- MSAL Browser **5.26.0** / Common **16.14.3**, exact MIT upstream commit
  `16a4714f38ba2844f34d154dd59dd8f1402457c9`, locked npm integrity and complete
  emitted license. No sample code copied. The vendor chunk is isolated; only
  its inactive library storage implementations are exempt from the bundle's
  string-level storage marker rule. Application source and other bundles still
  reject persistent storage, server secrets, fakes and unsafe Word mutations.

## Deterministic and local Worker evidence

**628 tests PASS, 1 protected live test SKIP; 39 passing files, 1 skipped.**
The tests use synthetic Microsoft keys/claims, synthetic host/MSAL outcomes and
local workerd/SQLite. They make no provider completion call and are not actual
Microsoft identity, tenant consent, NAA broker or Word acceptance.

| Acceptance contract | Evidence |
| --- | --- |
| Silent startup/renewal, API scope and memory cache | `MicrosoftAccess.test.ts` uses the production orchestration with a synthetic MSAL boundary |
| No cached account / Word login hint | `acquireTokenSilent` then bounded `ssoSilent`, no automatic popup |
| Consent/login/cancellation | Interaction is explicit; cancellation does not launch another window |
| Unsupported host | Standard MSAL/Office dialog branch; exact-origin/state/shape channel and Office Ignore cancellation tested |
| Capability expiry/new pane/concurrency | Ten concurrent acquisitions share one renewal; expiry after 15 minutes and a fresh pane reacquire access silently |
| Revocation/no replay | Revoked capability is rejected; safe GET retries once after renewal; completion is not replayed; late disposed renewal cannot publish a session |
| Draft/locale/attachment | Production runtime preserves multiline draft, locale and both attached/removed choices through silent renewal and consent interruption before submission |
| Cryptographic validation | Actual synthetic RS256 signatures; wrong issuer, Graph/client audience, scope, client, key, version and times rejected |
| Signing-key trust/rotation | Fixed discovery URLs, key issuer constraints, coalesced metadata, bounded refresh and successful synthetic key rollover |
| Paid access authorization | Other valid Microsoft identity denied, email cannot substitute for `tid:oid`; removing an allowed principal rejects an existing capability |
| No Engine/Word effects | Auth/recovery tests assert no completion request/Word write; existing gateway and Word boundary regressions remain green |

Relevant tests are in `test/gateway/microsoftIdentity.test.ts`,
`test/gateway/wordSession.test.ts`, `test/taskpane/MicrosoftAccess.test.ts`,
`MicrosoftSessionRenewal.test.ts`, `MicrosoftSignInDialog.test.ts` and
`ProductionTaskPaneRuntime.test.ts`.

[Exact local commands/results](gates.json) record all required contribution
gates. Locked install, production audit (zero vulnerabilities), full suite,
typecheck, lint, CI-scoped Prettier, all four manifests, all five frontend
targets, Worker build and production bundle verifier pass. A first sandboxed
Worker test could not bind loopback (`EPERM`); its rerun with the local socket
permission passed. Early regression failures were fixed before the final pass.
No failed run is counted as PASS. Exact-current-head repository CI remains a
separate gate; no older run is assigned to this head.

## Prepared package, no activation

[Preparation proof](package-preparation.json) and
[artifact-only checksums](artifact-sha256.json) cover 48 candidate/rollback files.
The candidate preserves the approved real-host manifest SHA-256
`2ce9617367832ec2bb3b141e28e8ce87467030210ec62a7db37bb597950d200e`, accepted
CSS and all PNG bytes. New Microsoft auth assets, dependency license, CSP and
no-store headers are staged. Rollback uses the **working aa5 Pages and both
session Worker modules**, retaining all older recovery layers too. Private
operator configuration/resource references stay outside this repository. No
credential file/value/hash or identity/token is published in these proofs.

No suitable registration is configured in the inspected project. An external
Entra directory inventory was unavailable, so no claim is made that a matching
registration cannot already exist. Live registration, consent, verified owner
configuration, actual host support and Word startup/reopen/idle/fallback behavior
remain **NOT_RUN / NOT_CONFIGURED**, as applicable.

The concrete missing operator action is documented with account types, redirects,
API scope, allowed client and required values in
[Microsoft configuration](../../MICROSOFT_SSO.md#registration-discovery-and-exact-missing-configuration).
The [coordinated activation/rollback](../../MICROSOFT_SSO_STAGING.md) requires
those verified inputs, current-head CI, artifact/control-plane review and then
actual no-completion Word acceptance. Nothing here enables anonymous Engine
access or changes the outbound-only network architecture.
