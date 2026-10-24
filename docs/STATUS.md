# Word Connector — OLC-72 review status

Updated: 2026-10-24. Status: **IN REVIEW**, draft PR #2, branch
`codex/olc-72-word-native-sse`. This access-lifecycle follow-up starts at delivered
`a7562740902ee230bf754e8a993fb75dc439e295`.

The settings connection check was delivered in SL/EN. It performs only
the existing protected-session GET and, if accepted, model-discovery GET. It
preserves the workspace, draft, locale and selection attachment, reuses explicit
sign-in recovery and never automatically submits a completion. The main form,
manifest, hosting CSP, Engine contract, document operations and Worker are unchanged.

Owner reports Access required after reopening and Office's Allow/Ignore prompt.
The local fix distinguishes HTML denial/server failures from login challenges,
reactivates an existing storage-access grant before GETs on a new iframe, and
offers the existing cookie action without forcing another dialog first. Recovery
performs only safe GETs; it never submits the retained message. Office Ignore is
a declined dialog, not policy denial. No new diagnostics or Access mutation.

| Evidence | Actual status |
| --- | --- |
| Owner-accepted appearance | Preserved; main form unchanged |
| Draft after approximately 30 minutes idle | Owner verified on the preceding staging candidate |
| Fresh protected GETs from the actual Word pane after idle | Not verified |
| Actual Office callback / pane-cookie / authentication recovery | Not verified |
| Native document writes, formatting, Undo/Redo, save/reopen | Separate pending Word qualification |
| Engine content/runtime acceptance | Separate open dependency; no new provider call |
| Settings control on staging | a756274 delivered; artifact and isolated production-bundle wiring verified |
| Cookie grant after a new iframe | Reproduced in isolated Firefox with synthetic identity; fixed locally |
| Owner's exact browser/Word cause | Still unproven; actual Word session unavailable |
| Last documented lifecycle delivery | ded891c, Pages success recorded 2026-10-24T03:56:50.495Z; not freshly rechecked by the evidence sync |

All 15 local contribution gates pass for the lifecycle successor: **592 tests
passed / 1 protected live skipped**, typecheck, lint, formatting, production audit
(0 vulnerabilities), four manifest validations, five builds and bundle isolation.
The actual production task-pane bundles also passed isolated Firefox/local-HTTPS
reopen and synthetic session-recovery checks, retaining multiline draft, locale
and removed attachment. That uses synthetic Office/identity, not actual Word.
Exact-head CI and immutable identity are recorded in the final handoff and PR.
No live provider call.
Exact-head CI remains a required PR gate; its actual URL/result, reproducible
commands and final immutable Git identity are recorded in the handoff and PR.
These checks do not establish a Word runtime PASS. The separately approved
Pages-only delivery is recorded in the [synchronization report](OLC72_SYNC_REPORT_20261024.md)
and [sanitized existing evidence](evidence/olc72-access-20261024/README.md).
The synchronization adds documentation only; it does not rerun functional checks
or establish current live state. Real Word reopen/idle/expiry acceptance is still
**NOT_RUN**, and Access required is not declared resolved. Where the host forbids Storage Access, the recommended
Word-scoped application-session architecture requires separate approval; it is
documented rather than silently changing Access rules or implementing a bypass.

See [access recovery](WORD_WEB_ACCESS_RECOVERY.md),
[English instructions](USER_GUIDE.md#9-restore-protected-access) and
[Slovenian instructions](USER_GUIDE.sl-SI.md#9-obnovite-zaščiteni-dostop).
