# Explicit Word document proposal — source contract

Source: `fddc65d7ebf8a2f5e16332a322adca5783deacfd`. Current outcome and
acceptance boundaries live in [STATUS.md](STATUS.md). The [complete old record](WORD_DOCUMENT_PROPOSAL-through-20261025.md)
is preserved byte-for-byte; its aa52/8eb dependency and login-blocker statements
are historical. OLC-74 remains open, not a new semantic/native PASS.

Production uses `documentReviewBody`/`documentReviewSchema` in
`src/chat/documentReview.ts`, with unchanged instruction and frozen selection
as separate text parts. The exact strict `lexai_document_review_v1` schema is
required; no name-only profile, invented proposal or plain-text fallback.
The later Engine [source contract at737](https://github.com/OpenLegalCore/olc-engine/blob/737a3d292890828bdcea5d7ea041c22744bee1d2/docs/contracts/DOCUMENT-REVIEW-1.md)
defines requested-output/status/notice obligations; client syntax validation
does not establish factual or legal quality.

Only decoded notice/claims stream as explanation. Source/proposal JSON stays
separate. `stop` → `[DONE]`, strict shape/status/language/limits and valid sources
are required before enabling a proposal. Partial/error output cannot enable Apply.
`proposal.markdown` is inserted literally, never harvested from explanation or
repaired by stripping citations. The UI does not write automatically.

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


## Verification and recovery boundary

Controlled adapter/Office tests establish guarded behavior, not native success.
Historical evidence is catalogued in [DOCUMENTATION-MAP.md](DOCUMENTATION-MAP.md).
Latest actual Word failure produced no proposal/Apply. No replay occurred here.
The old aa5 package does not preserve later Microsoft SSO; current application
recovery requires exact component/configuration/ownership proof and preserves
current session/user data. No rollback is executed or authorized by this page.
