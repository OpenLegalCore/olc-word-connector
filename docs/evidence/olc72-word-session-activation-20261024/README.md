# Word-session staging activation — 2026-10-24

**PARTIAL / BLOCKED. This is an execution record, not Word acceptance.**
Approved source: `aa5d369f3e99067e8059a50fdd99f22535ca9810`.
Tree: `b64d715a110e5c995cb6e9dba2dc8a6b17625833`.
[Exact-source CI](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40100297920)
was freshly read as completed/success. No qualifications were rerun.

## Actual results

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
  read-only authorization. Specific scope consent is pending. The rejection was
  not bypassed through another transport or credential source.
- No new routes or Access destinations were attached, and no Pages upload
  occurred. Public manifest HTTP 200/SHA-256 and the active JavaScript still
  match the previous `ded891c22b735ca323bfede552e5219683d24841` frontend.

## Evidence limits and next gate

The current browser inventory contains no Word tab, and Document Control reports
no connected Word document. An operator-opened staging tab reports **Word host
required**; it is not a Word session. Actual Word login, native Office callback,
reopen, known expiry/revocation recovery, dialog cancellation and draft/locale/
removed-selection retention are **NOT_RUN** for this architecture.

Real human login, PKCE exchange/replay and live Word-capability session/models/
revocation checks are also **NOT_RUN**, because the new auth/API routes are not
attached. Synthetic qualification is retained separately and is not substituted.
There was no completion, Send click, document write, merge, policy modification,
DNS change or modification of the original user checkout.

After explicit OAuth scope consent, continue the
[reviewed activation sequence](../../WORD_SESSION_STAGING.md): append only the
auth destination with a complete preserving payload, verify exact readback,
attach the two narrow routes, and qualify the new live boundary with real human
login before publishing the prepared frontend. Any frontend failure requires
the retained Pages-first rollback. Do not delete the new namespace or rotate
credentials to work around this block.

Private source locations, full control-plane snapshots, operational resource IDs,
receipts and proposed Access payload remain in the protected operator package.
The owner's individual incident is **not declared resolved**.
