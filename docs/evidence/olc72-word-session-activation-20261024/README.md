# Word-session staging activation — 2026-10-24

**STAGING TECHNICAL ACTIVATION: PASS. ACTUAL WORD: NOT_RUN.**
Approved source: `aa5d369f3e99067e8059a50fdd99f22535ca9810`.
Tree: `b64d715a110e5c995cb6e9dba2dc8a6b17625833`.
[Exact-source CI](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40100297920)
was freshly read as completed/success. No qualifications were rerun.

The approved frontend is delivered. Real human Access login, live PKCE exchange,
replay rejection, cookie-free session/models and revocation pass. Existing
policies, legacy gateway/routes and DNS are preserved; rollback is retained.
The chronological earlier blocks below remain historical evidence.

## Initial attempt

- All 75 prepared package checksums pass. The prepared real-host manifest,
  accepted CSS, CSP, icons and preserved prior Pages bytes match the package.
- Fresh exact-resource reads match the recorded prior Pages/legacy Worker pair,
  old route IDs and existing human Access app/policy. The rollback pair is
  preserved; it was not activated because the frontend was never changed.
- At 14:40 UTC two new Workers were uploaded without public routes. SQLite
  migration `word-session-v1` and the shared `WordSessionStore` binding are
  present. Both workers.dev and previews are disabled; observability/logpush
  are disabled. Uploaded source-map content fingerprints match the prepared
  Worker modules. No existing Worker was replaced.
- Original protected Word Engine/service credentials were found, checked for
  consistency in memory and provisioned server-side only to the new API Worker.
  No credential value or hash is part of this report. No deployed secret was
  exported, and no replacement key/service token was created.
- At 14:43 UTC a provider-free protected origin `GET /v1/models` using those
  originals returned HTTP 200 and `lexai-engine-local` through ordinary curl.
  A separate Python client returned Cloudflare 403/error 1010
  `browser_signature_banned`; this does not establish invalid credentials.
  The model name alone does not establish the Engine release. A separate
  read-only service inspection found a newer existing runtime; its exact
  identity is recorded privately. The old runtime evidence is historical.
  No Engine runtime/configuration was changed or content requalified.
- The destination append could not execute: the existing read-only MCP OAuth
  grant returned `Insufficient scope`. Automatic approval review first rejected
  a partial PUT payload; a complete read-back-preserving payload was then used
  and reached the scope block. Subsequent direct reads confirm the Access app
  still has only its original destination and policy.
- Official reauthorization requesting the needed `access.write` scope was
  blocked by automatic approval review because the connection had an explicit
  read-only authorization. Specific scope consent was pending at that time. The rejection was
  not bypassed through another transport or credential source.
- No new routes or Access destinations were attached, and no Pages upload
  occurred. Public manifest HTTP 200/SHA-256 and the active JavaScript still
  match the previous `ded891c22b735ca323bfede552e5219683d24841` frontend.

## Continuation after explicit scope consent

The owner subsequently approved the existing connection's `access.write` scope
only for adding the new auth destination and removing it during rollback.
The supported CLI 0.154.0 DCR login completed successfully. The authorization URL
and final consent screen were checked: the sole write permission was **Access:
Apps and Policies Write**. Existing required read scopes were retained; no API
token, alternative credential, other write permission or admin scope was added.
The final consent screen showed 13 permissions including required background,
user and account reads. The CLI reported successful login.

Fresh exact-resource reads reconfirmed the same existing new Worker versions,
shared namespace, binding names and disabled workers.dev/preview/observability.
Nothing was recreated or reprovisioned. The previous Pages/legacy Worker pair,
old routes and Access configuration still matched the saved baseline.

The preserving PUT through the already-loaded MCP tool again failed with the
transport error **Insufficient scope**, before any Access update was observed.
A subsequent exact app read confirms its original single destination and policy.
This continuation was **not rejected by automatic approval review**; successful
OAuth login and the still-failing loaded connection are separate observations.
The credential-adoption/cache explanation remains an inference until reconnection
and a successful scoped operation establish it.

[Official app-server documentation](https://learn.chatgpt.com/docs/app-server) and the installed protocol provide
`config/mcpServer/reload`. The CLI's supported proxy cannot reach its default
control socket because that socket does not exist; inspection of the existing
local app-server processes finds stdio transports and no reachable control
listener. No service was started/restarted and no private authentication storage
was extracted. Reopening the local Codex application is the remaining reconnect
step; another scope approval or OAuth login is not requested.

No additional infrastructure mutation occurred at that checkpoint. New auth
destination/routes and Pages delivery were then **NOT_PERFORMED**. The retained
rollback remained usable and was not needed.

## Completion after reopening Codex

No MCP OAuth login or consent was repeated. Fresh exact-resource reads confirmed
the same provisioned Worker versions, namespace and binding names. The existing
connection successfully executed the complete preserving Access PUT at 15:25 UTC.
Readback changed only destinations and update time; policy contents/timestamps,
audience, session and cookie settings stayed identical. Only the auth Worker was
appended; the API Worker is not a human Access destination. This proves effective
write access after reopening, not the internal cause of the earlier failures.

Only the two approved narrow auth/API routes were attached, using existing
authorized Wrangler access. No Worker was recreated, version redeployed or
credential reprovisioned. Both workers.dev/preview surfaces remain disabled.
The old protected routes, gateway version and policy are unchanged.

[Live boundary evidence](live-boundary.json): anonymous session/models return
marked JSON 401 without cookies. Anonymous auth redirects to the existing Access
issuer. The official Access CLI then completed a **real human account-member
login**, including the real browser approval screen. No identity was mocked and
no provider completion was made. Its protected client cache was consumed only in
the operator process; JWT, PKCE verifier/code and Word capability were never
printed, hashed for diagnostics, placed in process arguments or published.
The capability was held in memory and revoked at the end.

The live auth Worker issued a code after verified human identity; PKCE exchange
returned 200. Replaying that code returned 401/INVALID_GRANT. With the valid Word
capability, cookie-free session and models GETs returned 200 and the expected
`lexai-engine-local` model. Revocation returned 200; subsequent session/models
GETs returned 401/SESSION_EXPIRED. All eight live checks passed. This is a real
Access/server-protocol qualification, **not an Office callback or Word PASS**.

Only after those checks, the prepared Pages bytes were published at 15:32 UTC,
with source pinned to the approved implementation rather than a later docs head.
[Delivery evidence](delivery-verification.json): all 45 comparisons of 15 public
files across immutable, canonical and custom hosting are HTTP 200/byte-equal.
The manifest and prepared headers retain their approved checksums; CSS/icons are
unchanged. The active JavaScript matches the artifact, contains the new API
boundary and no Storage Access calls. All nine HTML CSP checks match, and no
X-Frame-Options header is present.

One custom-host PNG response has an older CSP header in an existing cache entry
(HIT, observed age over 101,000 seconds); its bytes/ETag match. The immutable
new and rollback image headers include the approved ancestor list. The final
taskpane/signin HTML responses, including their redirect chains, were separately
confirmed to include the approved Office ancestor. The initial strict all-file
header comparison is retained privately: 44/45 headers matched, **45/45 bytes
matched**. No cache purge or header/rule change was performed. This observation
does not represent an observed session/API failure or a new Word acceptance.

Final control-plane reads confirm the new canonical source, unchanged legacy
gateway/policies/routes and DNS, disabled automatic production/preview builds,
and the preserved successful prior Pages rollback. No rollback was needed.
The official Pages rollback endpoint needs write permission beyond this MCP
grant; the reviewed fallback remains re-upload of the verified prior static
bytes/headers with existing authorized Wrangler access. Resource IDs and exact
operator commands remain in the protected package. No new permission was requested.

## Evidence limits and next gate

The current browser inventory contains no Word tab, and Document Control reports
no connected Word document. An operator-opened staging tab reports **Word host
required**; it is not a Word session. Actual Word login, native Office callback,
reopen, known expiry/revocation recovery, dialog cancellation and draft/locale/
removed-selection retention are **NOT_RUN** for this architecture.

Real human login, PKCE exchange/replay and live Word-capability session/models/
revocation are PASS as recorded above. Synthetic qualification was not repeated
as a substitute for Word. There was no completion, Send click, document write,
merge, policy modification, DNS change or modification of the original user checkout.

The [reviewed activation sequence](../../WORD_SESSION_STAGING.md) is technically
executed. Remaining access acceptance needs a supported connection to the actual
Word browser/document surface: usable form and native dialog, open-pane recovery
after known expiry/revocation with retained multiline draft/locale/removed
attachment, and separate close/reopen login. A new pane destroys memory state;
no persistent draft or silent-login claim is made. Do not click Send or write the
document for this acceptance. Any subsequent session/API failure requires the
retained Pages-first rollback. Do not delete the namespace or rotate credentials.

Private source locations, full control-plane snapshots, operational resource IDs,
receipts and proposed Access payload remain in the protected operator package.
The owner's individual incident is **not declared resolved**.
