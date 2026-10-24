# Word Connector — OLC-72 review status

Updated: 2026-10-24. **IN REVIEW**, draft PR #2,
`codex/olc-72-word-native-sse`. This owner-approved architecture change starts at
`d419b477c527f5437e5a32429c7b7f19319f0a20`, retained in a local recovery ref.
The original user checkout, its two documentation edits, other clones and old
recovery packages are preserved.

The candidate replaces the pane's cookie prerequisite with an explicit native
Office login, S256 PKCE, verified human Access JWT, single-use codes (max 60s)
and opaque Word sessions (max 15m). Code consumption, expiry, revocation and
rate limits use SQLite Durable Object transactions. A separate API Worker checks
session scope before protected operations and again after completion-body
admission, immediately before SSE/Engine access. Cleanup is transactional too.
Engine bearer and Access service credentials remain server-side and reuse the
originals; no new Engine key or Access service-token pair was created. Word
capabilities remain transient. The owner-authorized
staging activation reused the two provisioned Workers and SQLite namespace,
added the narrow routes/auth destination and delivered the approved frontend.
Existing policies, legacy gateway/routes and DNS remain unchanged. See the
[sanitized execution record](evidence/olc72-word-session-activation-20261024/README.md).

The accepted form, colors, typography, automatic removable selection, SL/EN,
Send/Stop, Engine document-review profile, strict stop → DONE, actual usage/null
and guarded document writes remain unchanged. Storage Access is not imported by
the new production composition. No refresh token, persistent draft/history,
automatic completion, silent-login promise or provider fallback is added.

| Evidence / delivery layer | Actual status |
| --- | --- |
| Owner's individual Access required cause | Unproven; not declared resolved |
| Implementation | Local auth/API Workers, SQLite store and pane integration implemented |
| Full offline suite | 608 pass, 1 protected live skip; 35 passing files, 1 skipped |
| Local contribution gates | All 16 pass, including production audit (0 vulnerabilities), 4 manifests, 5 frontend builds, Worker build and bundle isolation |
| Real-browser synthetic qualification | Firefox 157, all cookies blocked, actual production bundle, synthetic Office/Access/Engine; no completion |
| Open-pane draft/locale/removed attachment | Retained through synthetic expiry/recovery; no automatic resend |
| New pane | New explicit login; prior memory session/draft not persisted |
| Actual Word edge cases with the new session architecture | **NOT_RUN in this continuation**; no connected supported Word surface available |
| Functional/visual owner evidence | Existing evidence preserved; PR #2 and OLC-72 also record the owner's 2026-10-24 normal-operation report, without an exact artifact SHA or separate expiry/reopen qualification |
| Active staging source | `aa5d369f3e99067e8059a50fdd99f22535ca9810`; previous `ded891c22b735ca323bfede552e5219683d24841` retained for rollback |
| New architecture delivery | **STAGING TECHNICAL PASS**: existing new Workers/store, auth-only Access destination append, two narrow routes and prepared Pages delivery verified |
| Original server credential availability | Confirmed privately and provisioned only to the new API Worker; no replacement or export of deployed secrets |
| Real human Access / PKCE / replay | PASS using official Access client and live endpoints; verified code issued/exchanged, replay rejected; distinct from Office dialog acceptance |
| Cookie-free Word API | Missing token: marked JSON 401; valid session/models: 200; revoked session/models: 401. Test session revoked |
| Published files / document headers | 45/45 HTTP 200 and byte-equal; 9/9 HTML CSP checks match, no X-Frame-Options. One unchanged cached PNG retains an older CSP header; no purge performed |
| Active frontend boundary | Approved JS identity, `/word-api` composition and absence of Storage Access calls verified |
| Engine content/runtime and native Word writes | Separate outstanding qualification; no completion or document write |
| Word for Mac | Backlog |

`npm ci` completed with the locked dependency tree; no `--ignore-scripts` command
was used. Local npm reported its install-script approval policy. The actual
esbuild/workerd binaries, all builds and offline tests were executed successfully;
this does not qualify unrelated keyring/Office sideload tooling. The two new
Miniflare transitive dependencies have scoped security overrides (`undici` and
`sharp`); unrelated pre-existing Office development-tool findings remain outside
this change. Exact-head CI
remains the required PR gate; its immutable run/result is linked from the PR and
final handoff. Merge is not authorized.

See [architecture and security](WORD_SCOPED_SESSION.md),
[prepared staging / rollback](WORD_SESSION_STAGING.md), and
[new sanitized evidence](evidence/olc72-word-session-20261024/README.md).
The [previous evidence synchronization](OLC72_SYNC_REPORT_20261024.md) and
[historical access diagnostics](WORD_WEB_ACCESS_RECOVERY.md) are preserved.
After the owner reopened Codex, the scoped preserving Access PUT succeeded;
readback changed only destinations and update time. No OAuth flow was repeated.
This establishes effective write access after reconnection; it does not prove
the internal cause of the preceding transport failures. The API Worker is not
a human Access destination. Both new workers.dev/preview surfaces stay disabled.

Replacement-chat handoff, 2026-10-24: the owner reports an existing signed-in
Word welcome page in the earlier visible browser panel. This chat's browser
inventory exposes two surfaces with zero tabs; direct binding returns
`Tab not found in browser 2`. Document Control reports no connected Word session.
The [sanitized Word-surface handoff](evidence/olc72-word-session-activation-20261024/word-surface-handoff.md)
records these direct observations separately from the already accepted owner
functional report. It establishes a connection limitation, not a new login failure.

Next: expose the same existing signed-in Word tab to this chat, then verify the
loaded artifact, native Office dialog, usable form, open-pane recovery after
known expiry/revocation with draft/locale/removed attachment retention, canceled
dialog and separate new-pane login. These specific cases were NOT_RUN here.
No new Microsoft login, OAuth consent, staging activation, completion or document
write is needed to resolve the surface connection. Existing windows, processes,
checkouts, local edits and recovery packages remain preserved; no rollback
trigger was observed. OLC-72 remains IN REVIEW.
