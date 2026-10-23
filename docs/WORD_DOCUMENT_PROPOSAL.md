# OLC-72 explicit document proposal candidate

Status: local implementation for review, based on `390590db71742b2682fe80cb57a0484f40ca76e6`.
Not deployed, not a new Engine capability, and not native Word acceptance.

## Contract and remaining Engine handoff

Read-only Engine source evidence at
`9753ad104853ce0fc4e23db9c9165e3c2abd073d` includes
`docs/contracts/DOCUMENT-REVIEW-1.md` and the canonical request/response examples
under `docs/examples/document-review/`. This is source evidence, not a fresh
attestation of the currently running Engine.

That opt-in `lexai_document_review_v1` contract already separates `claims`,
`notice`, `sources` and nullable `proposal`. Its proposal has `markdown`,
`language`, `change_summary` and verified `source_labels`. It requires its exact
strict JSON schema, separate ordinary text parts for the instruction and frozen
selection, `lexai-engine-local`, `response_language: sl|en`, native SSE and usage.
Streaming deltas are provisional JSON fragments; only a validated complete
object after `stop` then `[DONE]` can authorize a proposal. Ordinary questions
can legitimately return `proposal: null`; this legal-review profile does not
promise arbitrary stylistic editing.

The current Word text-answer adapter still uses its existing prompt envelope
and has no normalized proposal field from Engine. This candidate deliberately
does not switch that wire profile or parse a proposal out of the explanation.
The production basic Engine path therefore continues to show no document-write
actions. No gateway, credential, manifest or Engine configuration changes are
required by this local candidate.

Required handoff with the owning Engine session before enabling live proposals:

1. Confirm the supported document-review profile and runtime release against
   the pinned source, including the exact canonical request schema and selected
   text representation. Confirm supported task categories and null proposals.
2. Agree how provisional JSON deltas expose the explanation to the existing
   safe streaming UI, and validate the full response, sources, limits and
   language before exposing any document action. Retain strict `stop` → `DONE`
   and discard all proposals on error, cancellation or incomplete streams.
3. Agree an explicit document-text projection. Engine supplies Markdown, while
   this Word writer accepts exact plain text. Do not silently strip citations,
   Markdown or parts of the explanation. Either supply an explicit plain-text
   field in an approved contract or specify, display and qualify an agreed
   projection before implementation.
4. Add sanitized recorded contract fixtures for success, null proposal,
   malformed/oversized proposal, language mismatch and error after partial
   output. Qualify the Word adapter integration without live provider calls
   first. No automatic retry or conversation history is introduced.

The local provider-neutral result extension is `proposal: null | { text,
language, changeSummary }`. It is a Word domain type, **not** an assertion that
Engine already returns this shape. Exact keys, matching frozen language,
nonempty text, no NUL and UTF-8 limits (32 KiB text, 2 KiB summary) are validated.
Only the synthetic harness currently supplies it. The proposal uses plain
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
`/harness.html?proposal=explicit` supplies a separately authored synthetic
proposal, explanation, sources and fixture usage. No Engine/provider is called.
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
3. Change text or formatting, move/delete the target or lose the range before
   replacement; verify no write. Test duplicate clicks, cancel, timeout and
   error after a partial response; verify no unintended insertion or retry.

Deterministic tests cover retained-range validation including OOXML drift,
collapsed-cursor restrictions, bounded explicit proposals, safe rendering,
one-shot actions, cleanup, cancellation/late results and simulated surrounding
text/history. Native Word formatting and Undo/Redo remain **NOT VERIFIED**.

## Local qualification record — 2026-10-23

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
