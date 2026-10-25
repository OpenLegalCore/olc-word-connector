# OLC-74 Word adapter — isolated offline candidate

Status: **IN REVIEW; NOT DEPLOYED; NOT WORD/MODEL ACCEPTED** (2026-10-25).

## Pins and scope

- Word development base: PR [#2](https://github.com/OpenLegalCore/olc-word-connector/pull/2),
  branch `codex/olc-72-word-native-sse`,
  `69dbe682100575a6492fdf8fbfcde2b5b7eeaa45`.
- Isolated adapter branch: `codex/olc-74-word-adapter-offline`.
- Engine dependency: draft PR [#54](https://github.com/OpenLegalCore/olc-engine/pull/54),
  **`eef8ed0794046922842258ce587aab722db5fcb4`**. This supersedes the
  `8c0a51f` handoff; it is source compatibility evidence, not an installed release.
- [Execution handoff](https://linear.app/openlegalcore/issue/OLC-72#comment-cf706976-d31b-4a14-8b92-8fb827a34c8c).

Read at the Engine pin: [canonical contract](https://github.com/OpenLegalCore/olc-engine/blob/eef8ed0794046922842258ce587aab722db5fcb4/docs/contracts/DOCUMENT-REVIEW-1.md),
[reference mapping](https://github.com/OpenLegalCore/olc-engine/blob/eef8ed0794046922842258ce587aab722db5fcb4/examples/studio_document_review.py),
[example vectors](https://github.com/OpenLegalCore/olc-engine/tree/eef8ed0794046922842258ce587aab722db5fcb4/docs/examples/document-review),
[ordinary-request evidence and consumers](https://github.com/OpenLegalCore/olc-engine/tree/eef8ed0794046922842258ce587aab722db5fcb4/docs/evidence/OLC-74-ordinary-request),
including `CUMULATIVE.diff`, and
[Writer IPC correction](https://github.com/OpenLegalCore/olc-engine/tree/eef8ed0794046922842258ce587aab722db5fcb4/docs/evidence/OLC-74-content-revision-ipc).
The exact public JSON schema remains unchanged (sorted compact SHA-256
`8c38e918961d844623da34dbaa98449d04723d3c9eccac48d1e746d47304d904`).
No Engine code or reference implementation is copied into Word.

## Entry and isolation

The owner's current explicit OLC-74 instruction authorizes this bounded adapter
review independently of the pending SSO acceptance. The supplied/root AGENTS and
legacy technical specification, implementation plan, status and P3 contract were
read from the original checkout. Those legacy documents and AGENTS are absent
from the newer PR #2 tree; they are not reintroduced or used to undo the owner's
current approved Engine-only/proposal scope. Current contribution, proposal,
technical and integration guides govern its existing implementation. No separate
ENTRY/EXIT file exists in this base; this record supplies the requested entry/exit
review against AGENTS and CONTRIBUTING.

The original checkout is `main` at
`227ee1e63fcbf52884b1e74a113729210d5084ad`, with pre-existing edits to
`docs/IMPLEMENTATION_PLAN.md` and `docs/STATUS.md`. Its patch was saved locally
before work. The existing SSO checkout was independently read at the same PR #2
head, clean. Neither checkout nor the login branch was edited. Tests/builds run
in a separate worktree with its own copied dependency directory and output paths;
no existing server, Word window or browser is used.

## Contract and actual consumers

The first failing boundary was `adaptDocumentReview`: every ANSWER/PARTIAL
required claims and sources. It now accepts a validated nonnull proposal with
empty claims. A legal proposal still requires nonempty labels and its exact
first-use source projection. The only empty-evidence shape has empty claims,
empty sources and empty proposal labels, and Word additionally requires the
actual frozen, nonblank selected text from the request.

**Engine owns semantic admission and evidence verification.** Its internal bound
`revision/document_only` decision is not on the public wire. Word cannot prove
that route from JSON shape, selection or prose; it trusts the pinned Engine's
successful terminal validator, as does the reference adapter. Word does not
classify phrases, claim legal verification locally, add a bypass field, or admit
sourceless claims/Q&A. This dependency must be attested before activation.

The adapter preserves its closed schema, duplicate-key checks, source metadata,
label uniqueness/order, field/count/UTF-8 limits, language matching and public
citation/link restrictions. No explanation is manufactured. A received notice
remains explanation/status metadata, visible separately and never copied into
the proposal. PARTIAL still rejects an empty notice. Exact notice derivation,
including temporal warnings, remains the Engine's validator responsibility;
Word does not possess its private research context.

`documentReviewStream` emits only actual claims/notice strings and accepts zero
explanation deltas. `DocumentProposal` still validates exact normalized keys,
nonempty text/summary, language and byte limits. `TaskPaneController` and state
copies retain raw JSON and a separate proposal without requiring nonempty
explanation. The production model/view render that proposal independently;
Copy answer is disabled for an empty explanation. Sources still use the existing
safe link renderer. Proposal preview and insertion use the identical literal
string, including any markup characters, without HTML interpretation.

No provisional fragment enables a write. Existing transport validation requires
complete valid JSON, stop and DONE; an error, missing terminal, cancellation,
timeout or disconnect fails closed. Explicit replacement still uses the captured
location/text/structure and rejects another occurrence with identical text.
No retry, provider request, authentication change or document effect is added.

## Storage and reopen limits

Production stores raw/mapped results and the target only in the controller's
memory for the current pane. The regression reopens the retained result after a
settings connection-check failure and proves exactly one completion POST. A
separate synthetic serialized receipt is read through the real adapter mapping
without transport or changed raw provenance. These are different evidence layers.

**There is no durable saved-result store or cross-instance pane resume in this
base.** Destroying the pane clears the result and target. This change does not
introduce content persistence or a new restoration API. Actual Word close/reopen,
Save/reopen, Insert/Replace/Undo/Redo and semantic model acceptance are NOT_RUN.
They are not inferred from the memory/receipt tests. A future durable restore
must retain immutable request language/context and revalidate raw results without
completion replay; a saved locator must never silently authorize a new target.

## Offline verification and exit

[Recorded checks and matrix](evidence/olc74-word-adapter-20261025/README.md) and
[machine-readable commands](evidence/olc74-word-adapter-20261025/gates.json)
report actual results. All responses and Office host state are synthetic. The
HTTP adapter, stream parser, controller, state copies, production view/runtime
and Office adapter are real implementations; no live staging endpoint is used.
The full suite explicitly disables the protected live Engine opt-in.

Final review must verify the exact changed paths, whitespace, source/Office/DOM
boundaries, no automatic writes/retries, secret/private-data absence and no
harness in production. Manifest, dependencies, lockfile, styles/assets, auth,
Workers, routes and shared infrastructure are outside the delta. Local dependency
installation is NOT_RUN: an existing byte-identical-lock dependency tree was
copied into this isolated worktree without modifying its source. Fresh locked
installation remains a separate CI gate.

## Prepared later coordinated delivery and rollback

This is a source/artifact candidate, not permission to activate it.

1. Reconcile Word PR #2 and Engine PR54 again. Keep the exact reviewed adapter
   commit and Engine pin together; any newer source needs its own review. Require
   exact-head `CI / validate`, approved Engine runtime/import attestation and a
   separately authorized coordinated activation window. The stacked draft targets
   the PR #2 development branch; CI's PR filter is `main` only, so use the existing
   manual workflow on the adapter branch without changing CI or auth code.
2. Preserve the approved Microsoft SSO configuration, real-host manifest, CSP,
   icons and existing Worker deployments. Generic local build output alone is
   not a substitute for that operational overlay. The candidate requires no new
   package, HTTP parameter, Worker/auth change, migration or credential.
3. The Engine operator must qualify the pinned Engine candidate and its rollback
   separately. This task supplies no Engine installation command and does not
   touch its service. Coordinate the compatible Engine before serving the Word
   adapter; keep the current Microsoft access path stable throughout.
4. Before switching any frontend bytes, retain the exact current Pages artifact
   and deployment ID. The owner's current checkpoint is Pages source
   `edfaf1dc3367cdd76c24ee9e176efb6bff2cedf8`, deployment
   `7e4bcdfe-11ff-4d61-9789-80962046e5b1`; auth Worker
   `0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff`; API Worker
   `da36e666-89d1-4a59-b7b8-6fec4ad88807`. Re-read in the later authorized window;
   a read-only Pages project query confirmed this source/deployment and disabled
   automatic production/previews before publication. Worker/runtime attestation
   was not repeated in this offline task.
5. On adapter incompatibility, stop new submissions and cancel in-flight work,
   restore those exact prior Pages bytes first, and verify that Microsoft access
   still works. Keep the current Microsoft Workers unchanged. If Engine was also
   changed, its owning operator restores the separately retained Engine baseline
   after the frontend rollback. Do not revert SSO to historical Cloudflare login,
   alter Tunnel/DNS, replay UNKNOWN operations or automatically apply proposals.

OLC-72 remains open: the owner accepted repeated pane close/reopen with connected
state and a usable form; idle over 16 minutes and preservation of input, language
and attached/removed selection remain pending. That access acceptance is separate
from the document proposal and saved-result limitations above.
