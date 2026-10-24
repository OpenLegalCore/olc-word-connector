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
Engine bearer and Access service credentials remain server-side. No new
client credentials are created by this architecture. The owner-authorized
staging attempt has provisioned two new **unrouted** Workers and the SQLite
namespace; existing resources and frontend remain unchanged. See the
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
| Actual Word with the new session architecture | **NOT_RUN**; no connected supported Word surface available |
| Existing functional/visual owner evidence | Preserved as historical evidence; no new completion or visual acceptance claimed |
| Last observed staging source | `ded891c22b735ca323bfede552e5219683d24841`, read-only confirmed 2026-10-24; unchanged by this task |
| New architecture delivery | **PARTIAL / BLOCKED**: new unrouted Workers/store provisioned; no new route, Access destination or Pages switch |
| Original server credential availability | Confirmed privately and provisioned only to the new API Worker; no replacement or export of deployed secrets |
| Provider-free protected Engine discovery | HTTP 200, expected model; no completion. Python HTTP client separately encounters Cloudflare 1010, not evidence of an invalid bearer |
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
The owner explicitly approved `access.write` for only the auth-destination
append/rollback. Official DCR login completed successfully with that sole write
scope and the existing read scopes. The already-loaded MCP tool still returns
`Insufficient scope` for the preserving PUT; a subsequent exact read confirms
no destination/policy change. The installed CLI supports app-server MCP reload,
but no reachable control listener exists for the running stdio app-server.
Next: reconnect the local Codex client so it can adopt the completed grant, then
continue protection/routes/real-login checks before any Pages switch. No new
scope consent, credential or infrastructure workaround is required. Actual Word
dialog, reopen and idle recovery remain NOT_RUN.
