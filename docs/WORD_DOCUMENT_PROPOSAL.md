# OLC-72 explicit document proposal candidate

Status: IN REVIEW. The document profile was reviewed at `8d96dbf`; the local
access-recovery follow-up is described in [its evidence and qualification record](WORD_WEB_ACCESS_RECOVERY.md).
The owner confirmed that candidate's visual PASS; its CSS, assets and layout are
unchanged. The 8d96dbf review was pushed to draft PR #2; its access follow-up is local, without deployment,
merge or native Word acceptance. See [access recovery](WORD_WEB_ACCESS_RECOVERY.md)
for the separate production-login blocker and reviewed implementation plan.

## Current contract and Engine incident handoff

Read-only Engine source evidence at `9753ad104853ce0fc4e23db9c9165e3c2abd073d` includes
`docs/contracts/DOCUMENT-REVIEW-1.md` and the canonical request/response examples
under `docs/examples/document-review/`. This is source evidence, not a fresh
attestation of the currently running Word origin. Pure offline admission of the
actual Word-generated synthetic request was checked with the existing Engine
interpreter (`-B`, no configuration, key or network access):

| Engine source | Actual admission |
| --- | --- |
| `09171eacabf884798675ef44d3b16e8c24c79abe` | REJECT `unsupported_response_format` |
| `9753ad104853ce0fc4e23db9c9165e3c2abd073d` | PASS, `document_review=True` |
| `aa52aa19d068d53c9e9d1ad58a2c04f94d4a901f` | PASS, `document_review=True` |

The 9753 and `8eb44dd9bbbb4c81f272dcbd738d09e756f4fe22` canonical request
examples are byte-identical. The schema's sorted compact JSON SHA-256 is
`8c38e918961d844623da34dbaa98449d04723d3c9eccac48d1e746d47304d904`,
checked against Word's independently expressed protocol definition in tests.

That opt-in `lexai_document_review_v1` contract already separates `claims`,
`notice`, `sources` and nullable `proposal`. Its proposal has `markdown`,
`language`, `change_summary` and verified `source_labels`. It requires its exact
strict JSON schema, separate ordinary text parts for the instruction and frozen
selection, `lexai-engine-local`, `response_language: sl|en`, native SSE and usage.
Streaming deltas are provisional JSON fragments; only a validated complete
object after `stop` then `[DONE]` can authorize a proposal. Ordinary questions
can legitimately return `proposal: null`; this legal-review profile does not
promise arbitrary stylistic editing.

The production Word composition now explicitly selects this documented profile.
The older text-envelope transport remains only for compatibility tests/direct
consumers; there is no runtime fallback or UI profile choice. Messages contain
the unchanged instruction and, when present, frozen selection as separate text
parts. The full exact schema is included, not just its name.

An incremental JSON token reader sends only root `notice` and `claims[].text`
strings to the existing streaming UI, decoding split escapes without exposing
proposal or source JSON as explanation. It emits each actual received prefix;
it does not buffer a final answer and replay it. All partial content remains
non-applicable. Only after the existing strict `stop` → `[DONE]` gate do closed
shape, duplicate-key, limits, status, language and source-label/order checks
produce a result. Claims/notice become explanation; sources are separate
metadata rendered through the existing HTTPS host allowlist. Empty URLs stay
empty and are never manufactured. The original JSON remains in memory for the
current result only, without logs or persistent conversation history.

The local proposal's `text` is **exactly** Engine `proposal.markdown` and its
summary is exactly `change_summary`. The preview and Word insertion both use
the same literal string: no Markdown/HTML interpretation, citation removal,
trimming, unescaping of user input or extraction from the explanation. Any
Markdown syntax is visibly literal and stays literal in Word. Engine's public
text contract forbids inline source markers/links in this field; violations
are rejected, never repaired. Rich-text proposal conversion is not included.

Latest available incident evidence was read from OLC2-26 comments
`784bf79e-98c6-40d3-a2ce-bec695938bfc` and
`50db090e-ea63-4b81-ad85-18700b1815da` (23 October). It distinguishes a
technically completed but factually unsupported Studio proposal from semantic
acceptance. The reported TEST release was 8eb44dd; local 8bd9b68/aa52aa1 add
material-fact/source-applicability checks, but are not installed. Even their
controlled SUPPORTED assessment is not a semantic proof. That handoff explicitly
leaves Word's "rewrite without citations" incident open. It does not contain a
Word-specific corrected release or a new Word functional PASS.

Remaining owning Engine handoff: provide the immutable Word-incident fix and
its qualified evidence/contract changes (if any), distinguish it from the local
aa52 candidate, and attest the exact release/imports actually behind the Word
HTTPS origin before separately approved activation. Do not repeat the incident
or treat the model ID as runtime proof. The existing login failure remains a
separate production blocker. Its proven client-side misclassification is fixed,
but actual Word iframe expiry/cookie/policy evidence is still required. No
provider call or runtime activation is authorized by this review.

The latest retained Engine runtime proof independently read for this review
records `8eb44dd9bbbb4c81f272dcbd738d09e756f4fe22`, deployment/postflight PASS,
but `RELEASE_GATE=NOT_PASS` and `OWNER_ACCEPTANCE=PENDING`. It is historical
runtime evidence, not a fresh attestation of the current Word HTTPS origin.
The newer aa52aa1 source candidate is not an installed semantic correction.

## Review corrections and release boundaries — 2026-10-23

The review reproduced and corrected two defects: valid structured JSON above
the legacy 50,000-character text limit was rejected, and all same-origin `403`
responses were incorrectly reported as session expiry. Document-review now uses
a bounded 1 MiB default plus its existing field/count limits; explicit lower
limits still reject oversized results. Non-HTML `403` remains access denial;
login challenges remain fail-closed and are described without asserting expiry.
The new recovery regression proves draft and removed-selection preservation
across failed/successful manual checks, without a second completion or Word write.

The accepted CSS, form layout, assets, manifest and hosting CSP are unchanged.
The current gateway already passes the bounded profile request/SSE without
interpreting it; no Worker update is required for this frontend candidate.
The prepared staging package must retain the current production manifest and
CSP bytes, and use current Pages `5e4e601b-364d-41d9-afe3-14819d09733b` as its
frontend rollback, with Worker `d6ef17bc-bd07-4cd9-a219-d36bfcda1738` unchanged.
Packaging is preparation, not activation approval. The package handoff records
the final immutable head, checksums, CI and read-only control-plane snapshot.

Word Web is the active acceptance target; Word for Mac is explicitly backlog.
Native replacement/insertion, formatting, Undo/Redo and Save/reopen are still
NOT_RUN for this successor. Earlier answer/source/usage and visual acceptance
remain historical evidence; they do not qualify these new write operations.

Review qualification on Node 24.21.0: all 15 Contributing command gates exited
0: full deterministic suite **536 passed / 1 protected live skipped**, typecheck,
lint, exact CI formatting command, production audit **0 vulnerabilities**, four
official manifest validations, five builds and production bundle verification.
The three directly affected suites also passed (154 tests). No protected live
test or provider request ran. The existing local dependency tree was reused;
its earlier `npm ci --ignore-scripts` installation did not qualify dependency
lifecycle scripts. Exact-head GitHub CI uses ordinary `npm ci` and is required
in addition; the immutable final run ID and result belong in PR/Linear and the
staging handoff, without a self-referential commit SHA in this document.

The local provider-neutral result extension is `proposal: null | { text,
language, changeSummary }`. It is a Word domain type, **not** an assertion that
Engine already returns this shape. Exact keys, matching frozen language,
nonempty text, no NUL and UTF-8 limits (32 KiB text, 2 KiB summary) are validated.
The adapter now maps only the explicit Engine proposal into it. The proposal uses plain
`textContent` independently of the explanation renderer and is inserted exactly
as previewed, without interpretation as HTML, Markdown or OOXML.

## User actions and safety

- No response, partial delta or automatic UI action writes to Word. Actions
  appear only for an explicit valid proposal after successful completion.
- **Replace selected text / Zamenjaj označeno besedilo** uses the request's
  retained original range, never a search for matching text. Immediately before
  queuing the write, the current selection must still be that range with exact
  text, context and captured OOXML. Moved, edited, reformatted, deleted or lost
  targets fail closed. No whole-document capture or fallback occurs.
- **Insert at cursor / Vstavi na mesto kazalca** captures a collapsed cursor at
  the click. Any nonempty selection or unsupported structure is rejected. It
  inserts at that position without replacing another selection.
- Each result permits one attempted document action. Both buttons lock before
  awaiting Word, preventing double or cross-action clicks. A failed or uncertain
  write is not retried. If Word's commit acknowledgement is lost, the UI reports
  an unconfirmed outcome and asks the user to inspect the document; it does not
  claim that Word is unchanged. Reset/disposal releases retained ranges.
- No code writes formatting, HTML, OOXML, other ranges or the document body.
  Exact replacement changes text within the target; insertion inherits Word's
  insertion-point formatting. Mixed runs, paragraph boundaries and native
  Undo/Redo still require real Word qualification; mocks cannot establish them.
- Selection attachments, frozen language, independent questions, Send/Stop,
  source rendering and actual usage/null behavior remain unchanged. Cancellation,
  timeout and response errors never expose a proposal action.

## Reproducible local preview and evidence limits

Build using `npm run build:harness` and serve `dist/harness` on loopback. The
existing actual runtime harness at
`/harness.html?proposal=explicit` passes a separately authored synthetic
HTTP/native SSE result through the actual document-review adapter and parser,
with separate proposal, explanation, sources and fixture usage. No Engine/provider is called.
`?proposal=none` exercises ordinary questions, and
`?proposal=explicit&scenario=partial-error` exercises a partial response failure.

At 280 px: inspect the thin `#b57a50` copper input border and copper focus; Send
a synthetic message; confirm that the document simulator is unchanged until
click. Test the original selection, empty cursor, different selection and
modified target controls. The Undo/Redo controls simulate text history only;
they are not evidence of Word formatting or native Undo/Redo.

`npm run build:word-harness` also includes an opt-in
`taskpane.html?proposal=explicit` route using the real Office adapter and the
same synthetic gateway. It must be explicitly hosted/sideloaded separately
before use; this work does neither. Use a disposable document, not client data.
Record native Word host/browser/build and verify:

1. Select a unique middle range between distinct surrounding paragraphs, with
   mixed character formatting nearby; send, review and replace once. Confirm
   only the target text changed, surrounding text/styles remained intact, and
   native Undo then Redo restores/reapplies the intended change once.
2. For a fresh result, put a collapsed cursor between formatted runs and insert.
   Confirm no existing text is overwritten, and inspect formatting and native
   Undo/Redo. Also reject a nonempty different selection.
3. Save the modified disposable document using Word's native Save/AutoSave,
   close it and reopen the saved copy. Check the exact changed range, surrounding
   paragraphs, formatting and section/page settings. This verifies document
   persistence, not conversation history; the connector does not retain results
   or automatically regenerate after reopening.
4. Change text or formatting, move/delete the target or lose the range before
   replacement; verify no write. Test duplicate clicks, cancel, timeout and
   error after a partial response; verify no unintended insertion or retry.

Deterministic tests cover retained-range validation including OOXML drift,
collapsed-cursor restrictions, bounded explicit proposals, safe rendering,
one-shot actions, cleanup, cancellation/late results and simulated surrounding
text/history. Native Word formatting and Undo/Redo remain **NOT VERIFIED**.

## Previous local qualification record — candidate 6077528, 2026-10-23

### Historical local qualification — 1d86fd7

All current local gates exited 0: `npm test -- --run` (30 files / **532 tests**
passed, one protected live test/file intentionally skipped), typecheck, lint,
the exact Contributing prettier check, audit (**0 vulnerabilities**), all four
manifest validators, all five builds and production bundle isolation. A later
assertion strengthening the existing UI test separately checks that sources
survive the controller/view mapping and raw JSON is never rendered; its affected
runtime suite passes. No gate is substituted by a simulator.

The synthetic preview now uses actual HTTP/SSE framing and the actual profile
adapter/parser, without network or provider calls. Native Word remains NOT_RUN:
supported browser inventory is empty and document control has no Word session.
A synthetic DOCX baseline, ZIP/XML check and native Save/reopen checklist are
prepared in the private local handoff; the ZIP check is not Word acceptance.
The accepted appearance is unchanged. No push, deployment, merge, credential
change or Engine/LWS/Studio modification occurred. The login failure remains
open as a production blocker.

### Historical 6077528 checks

Node `v24.21.0`; branch `codex/olc-72-word-native-sse`. All final commands below
exited 0. No dependency, manifest, gateway or hosting file changed.

| Command | Result |
| --- | --- |
| `npm test -- --run` | 29 files / 507 tests passed; one protected live file/test skipped by design |
| `npm test -- --run test/app/DocumentProposal.test.ts` | 14 passed after strengthening the late-delta assertion |
| `npm run typecheck` / `npm run lint` | Passed |
| Contributing's exact `npx --no-install prettier --check …` command | Passed; changed harness HTML also formatted and checked |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm run validate`, `validate:dev`, `validate:stage`, `validate:prod` | All four passed using the official Microsoft validator |
| `npm run build:harness`, `build:word-harness`, `build:dev`, `build:stage`, `build` | All five passed |
| `npm run verify:bundle` | Passed; no fake, private credentials or unsafe write primitive in production |
| `git diff --check` and changed Markdown local-link checks | Passed |

The sandbox initially blocked the loopback test socket and external npm/Microsoft
DNS. Those checks passed with the authorized execution permission; these were
environment restrictions, not suppressed test failures. No new provider call,
remote CI run, push, deployment or merge was performed. The supported browser
inventory was empty and no Word document-control session was connected, so this
record does not claim interactive browser or native Word acceptance. The local
runtime preview is prepared for owner review.
