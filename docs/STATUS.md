# Word Connector — OLC-72 review status

Updated: 2026-10-24. Status: **IN REVIEW**, draft PR #2, branch
`codex/olc-72-word-native-sse`. This follow-up starts at `c062b372`.

The settings connection check is implemented locally in SL/EN. It performs only
the existing protected-session GET and, if accepted, model-discovery GET. It
preserves the workspace, draft, locale and selection attachment, reuses explicit
sign-in recovery and never automatically submits a completion. The main form,
manifest, hosting CSP, Engine contract, document operations and Worker are unchanged.

| Evidence | Actual status |
| --- | --- |
| Owner-accepted appearance | Preserved; main form unchanged |
| Draft after approximately 30 minutes idle | Owner verified on the preceding staging candidate |
| Fresh protected GETs from the actual Word pane after idle | Not verified |
| Actual Office callback / pane-cookie / authentication recovery | Not verified |
| Native document writes, formatting, Undo/Redo, save/reopen | Separate pending Word qualification |
| Engine content/runtime acceptance | Separate open dependency; no new provider call |
| New settings control on staging | Not deployed |

All 15 local contribution gates pass: 577 tests passed / 1 protected live test
skipped, typecheck, lint, formatting, production audit (0 vulnerabilities), four
manifest validations, five builds and bundle isolation. No live provider call.
Exact-head CI remains a required PR gate; its actual URL/result, reproducible
commands and final immutable Git identity are recorded in the handoff and PR.
These checks do not establish a Word runtime PASS. The next live step requires separately
approved staging delivery of the verified artifact, followed by explicit
**Settings → Check connection** in the existing Word pane, without reloading,
clearing the draft, sending a completion or changing Access rules.

See [access recovery](WORD_WEB_ACCESS_RECOVERY.md),
[English instructions](USER_GUIDE.md#9-restore-protected-access) and
[Slovenian instructions](USER_GUIDE.sl-SI.md#9-obnovite-zaščiteni-dostop).
