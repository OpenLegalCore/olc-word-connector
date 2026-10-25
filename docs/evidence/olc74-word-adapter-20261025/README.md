# OLC-74 Word adapter offline evidence — 2026-10-25

Status: **IN REVIEW / NOT DEPLOYED / NOT NATIVE OR MODEL ACCEPTED**.
[Contract, pins, consumers, limitations and rollback](../../OLC74_ADAPTER_HANDOFF.md).
[Exact commands/exit codes](gates.json) · [Publication deployment guard](publication-safety.json) ·
[Final diff/privacy review](review.json) · [Artifact continuity](artifact-continuity.json).

## Actual results

- RED on Word base with new positive regressions: **2 FAIL / 24 PASS**, exit 1.
  Both SL/EN cases fail at the old claims/sources requirement.
- Focused adapter + actual production runtime/Office boundary: **57 PASS**, exit 0.
- Full deterministic suite: **677 PASS / 1 protected-live SKIP / 0 FAIL**, exit 0.
- All **17 executed local command gates PASS**: full suite, typecheck, lint,
  exact CI format, production dependency audit (0 vulnerabilities), four official
  manifest validations, five frontend builds, local Worker build, bundle isolation,
  diff whitespace. Raw logs remain in the local checkpoint, not the repository.
- An intermediate runtime assertion observed the transient `applying` status
  before the asynchronous drift failure. Waiting for the actual alert fixed that
  test assertion; no production behavior was changed for it.
- Local `npm ci`: **NOT_RUN**, preserving the no-install scope. Dependencies were
  copied from the clean SSO checkout with byte-identical `package-lock.json`;
  no shared dependency directory or existing checkout was modified. Fresh install
  is required in exact-head CI, reported separately in the final PR handoff.

All test responses, selection text and Office host state are independently
controlled synthetic data. Actual adapters/controller/view/Office implementation
are exercised without a network fetch or an open Word/browser. This is acceptance
of structural contracts, not model semantics or native Office behavior.

## Acceptance matrix

| Scenario | Actual consumer evidence | Result |
| --- | --- | --- |
| SL/EN legal document-only, claims empty, source metadata present | Production gateway, incremental JSON reader, renderer, exact preview and explicit Office replacement | PASS |
| SL/EN content-only revision, sources/labels empty | Same actual path with frozen selected text; zero invented explanation deltas | PASS |
| PARTIAL notice | Reader/mapping preserve notice separately; visible notice never inserted; empty notice rejected | PASS |
| Explanation + proposal | Real adapter and production runtime retain separate blocks/actions | PASS |
| Cited Q&A / null proposal | Claims require legal sources; no proposal actions | PASS |
| Clarification / null proposal | Notice displayed; no document action | PASS |
| Empty/null/invalid proposal, foreign/duplicate labels, wrong language, invalid metadata | Real adapter rejects; existing size/citation/URL/closed-shape/duplicate-key suites remain green | PASS |
| Empty sources with claims, absent/blank frozen context, unmatched source order | Adapter rejects; no sourceless claim/Q&A path | PASS |
| Full provisional JSON before stop; stop without DONE; error after delta; cancel/disconnect | No action before terminal; errors cannot expose a result or mutate controlled Office state | PASS |
| Retained result after settings-check failure | Real runtime restores same proposal; exactly one completion POST | PASS |
| Serialized synthetic raw receipt readback | Same adapter revalidates raw JSON/context; no second completion | PASS |
| Explicit replacement/insertion and equal-text location drift | Real Office adapter with queue-aware controlled host; one-shot exact write or fail closed | PASS |
| Actual Word close/reopen / Save/reopen / Undo/Redo | No live Word operations performed | NOT_RUN |
| Durable result restoration in a new runtime | Base has no persistent result store; not introduced | NOT_RUN |
| Actual model behavior / installed Engine compatibility | No provider calls, installation or activation | NOT_RUN |

All 26 compared non-taskpane staging and Worker artifacts match the clean
PR #2 checkout byte-for-byte, including Microsoft auth/sign-in/redirect modules,
CSS, icons, headers, manifest and both compiled Workers. Only the taskpane
artifact family is excluded because it contains the reviewed adapter/UI delta.

## Scope and final review

Only three production files change: `src/chat/documentReview.ts`,
`src/chat/OpenAICompatibleAdapter.ts` (passes the actual request context), and
`src/taskpane/ProductionTaskPaneRuntime.ts` (disables blank Copy answer).
The strict schema, stream reader, normalized proposal validator, controller,
Office adapter, manifests, styles/assets, packages, lockfile, auth, Workers and
CI definition are unchanged. Tests and documentation make up the remaining delta.
No copied third-party implementation or new dependency is introduced.

The final review checks exact paths, whitespace/links, architecture boundaries,
plain-text output, explicit-only writes, selection drift, source/notice retention,
credential/content privacy and production bundle isolation. The original main
checkout's documentation patch and the clean SSO checkout are preserved. No
service, browser, Word window, provider, Tunnel, DNS or other project is modified.

Read-only Pages metadata immediately before publication confirms automatic
production deployments disabled, previews `none`, and the canonical deployment
still matching the owner's checkpoint. This reads project metadata only and
performs no HTTP request to the active staging data path.

The existing workflow filters PRs to `main`; this draft targets the PR #2 branch.
Run its existing manual CI workflow at the exact adapter head and report the
result externally. Do not broaden the workflow or change the login branch.
