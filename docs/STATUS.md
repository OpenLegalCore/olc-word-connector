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
credentials, live Workers, route or Access-policy changes are performed here.

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
| New architecture delivery | **NOT DEPLOYED**; exact package and activation/rollback prepared |
| Engine content/runtime and native Word writes | Separate outstanding qualification; no new provider/Engine call |
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
Next: review the candidate and separately authorize the narrow new-resource/
Access-destination activation, then qualify the real Word dialog and idle recovery.
