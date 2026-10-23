# Compatibility and limitations

[Documentation index](README.md) · [User guide](USER_GUIDE.md) ·
[Installation](INSTALLATION.md) · [Troubleshooting](TROUBLESHOOTING.md)

This page defines the evidence and support boundary for the
`v0.1.0-beta.1` source-only release. It distinguishes connector behavior from
the backend, legal corpus, identity system and Word environment supplied by an
operator.

## Status vocabulary

| Status               | Meaning                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `VERIFIED`           | Direct repository evidence or completed release-candidate runtime acceptance covers the named behavior                     |
| `VERSION-QUALIFIED`  | Verified only against the exact adapter or target profile stated; not a claim about every upstream release                 |
| `OPERATOR-DEPENDENT` | The connector supports the boundary, but availability or quality depends on infrastructure or data outside this repository |
| `NOT TESTED`         | Required runtime evidence does not exist, so no support claim is made                                                      |
| `NOT INCLUDED`       | The capability or service is outside this release                                                                          |
| `ROADMAP`            | Possible future work, not a commitment or current capability                                                               |

“Verified” never means that retrieval is exhaustive, that generated legal
content is correct, or that every tenant and browser policy will behave
identically.

## Word clients and distribution

| Area                                    | Status               | Evidence and limitation                                                                                                                                                                                            |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Word for the web, legal-source workflow | `VERIFIED`           | Owner-executed release acceptance covered both providers, both context modes, result actions, cancellation with late-response suppression, expired-session recovery with explicit retry, and an unchanged document |
| Word for Windows                        | `NOT TESTED`         | No current release runtime acceptance exists and no support claim is made                                                                                                                                          |
| Word for Mac                            | `NOT TESTED`         | No current release runtime acceptance exists and no support claim is made                                                                                                                                          |
| Add-in-only XML manifests               | `VERIFIED`           | Repository tests and manifest validation cover current identities, URLs, requirement set and permissions                                                                                                           |
| Local browser harness                   | `VERIFIED`           | Useful for deterministic UI inspection; it is not Word or live-backend evidence                                                                                                                                    |
| Protected connected deployment          | `OPERATOR-DEPENDENT` | The architecture supports an operator-controlled same-origin gateway; the repository supplies no operated environment                                                                                              |
| AppSource / Office Store                | `NOT INCLUDED`       | No listing or one-click public distribution is supplied                                                                                                                                                            |
| Hosted OpenLegalCore service            | `NOT INCLUDED`       | This repository distributes source, not a public backend, legal database or account                                                                                                                                |

Word for the web acceptance is evidence for the tested release candidate, not a
blanket certification of every Microsoft 365 tenant, browser, identity policy
or future Word version. Sideloading can be disabled by tenant policy.

The [product gallery](SCREENSHOTS.md) demonstrates the bilingual workflow but
does not replace runtime acceptance.

For OLC-72, the owner separately confirmed an Engine-only Word Web request with
an answer, sources, actual usage and an unchanged document. On 23 October 2026
the owner accepted the final simplified Slovenian form in the actual local
runtime harness at 280 px. This visual evidence covers the logo, single heading,
automatic removable selection attachment and Send action. It does not replace
the full simplified-form Word Web walkthrough or repeat the accepted request.

## Verified Word for the web workflow

The accepted release-candidate walkthrough covered:

- the then-current Open WebUI and direct OLC Engine selection and connection (historical release evidence);
- **No document context** and **Selected text**;
- English and Slovenian task-pane states;
- safe answer and source rendering;
- **Copy answer**, **Refine question** and **New search**;
- a clickable case-law source;
- **Cancel** while a delayed request was active, followed by a wait beyond the
  controlled delay with no late answer;
- **Session expired** → **Open secure sign-in** → explicit **Retry search**,
  without automatic resubmission; and
- an unchanged synthetic Word document throughout.

The provider, exact question and context mode were preserved across the
accepted session-recovery flow. With **Selected text**, an explicit retry
captures the then-current selection again.

## Provider transports

| Area                                    | Status              | Evidence and limitation                                                                                                                           |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical Open WebUI adapter evidence  | `HISTORICAL`        | Preserved evidence for `v0.1.0-beta.1`; Open WebUI is not part of the current Word Connector runtime.                                             |
| Direct OLC Engine adapter               | `VERSION-QUALIFIED` | Native SSE fixtures are pinned to Engine `09171ea`; the owner-confirmed Engine-only Word Web answer/source/usage PASS is separate from simplified-form acceptance |
| Shared `ChatGateway` behavior           | `VERIFIED`          | Deterministic parity covers normalized success, controlled failures, cancellation, late-result suppression and document safety                    |
| Exact model discovery                   | `VERIFIED`          | Connection succeeds only when the configured model ID appears in the selected provider's model list                                               |
| Automatic retry or fallback             | `NOT INCLUDED`      | OLC Engine is the only backend and a failure is never silently retried                                                                            |
| Browser-held provider credentials       | `NOT INCLUDED`      | Deployable composition creates neither provider Bearer headers nor Cloudflare service-token headers                                               |
| Public backend compatibility in general | `NOT INCLUDED`      | The documented OLC Engine contract is the boundary; arbitrary provider APIs are not supported                                                     |

The current connector supports only the documented direct OLC Engine transport. Their answers need not be word-for-word identical.

## Language and legal-source scope

| Area                                        | Status               | Evidence and limitation                                                                                                                                        |
| ------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task-pane interface: English (`en-US`)      | `VERIFIED`           | Complete connector-owned message catalog and accepted Word for the web workflow                                                                                |
| Task-pane interface: Slovenian (`sl-SI`)    | `VERIFIED`           | Complete connector-owned message catalog and accepted Word for the web workflow                                                                                |
| Persistent language preference              | `NOT INCLUDED`       | Settings changes only the current task-pane instance; a new runtime resolves Office language, browser language, then English                                   |
| Provider answer language                    | `SUPPORTED CONTRACT` | The frozen `sl-SI`/`en-US` UI locale is sent to Engine as `sl`/`en`; final language quality remains backend-dependent                                          |
| Slovenian questions and Unicode transport   | `VERIFIED`           | Request serialization and accepted runtime evidence cover Slovenian text                                                                                       |
| PISRS legislation                           | `OPERATOR-DEPENDENT` | The renderer recognizes approved PISRS links and the accepted workflow returned legislation sources; corpus completeness and temporal coverage remain external |
| Slovenian case law                          | `OPERATOR-DEPENDENT` | The renderer recognizes approved sodnapraksa links and the accepted workflow returned case-law sources; retrieval is not proven exhaustive                     |
| Historical-law questions                    | `OPERATOR-DEPENDENT` | Supported only when the configured corpus contains the relevant versioned material                                                                             |
| Combined legislation and case-law questions | `OPERATOR-DEPENDENT` | Supported by the request contract; result quality and coverage depend on the backend                                                                           |
| EU, foreign and broader legal sources       | `ROADMAP`            | Outside the Slovenian-source beta                                                                                                                              |
| Legal literature and internal firm sources  | `ROADMAP`            | Require separately reviewed data, access, privacy and retrieval contracts                                                                                      |

## Document context and actions

| Area                                               | Status         | Evidence and limitation                                                                                                     |
| -------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Message without document context                   | `VERIFIED`     | With no displayed selection attachment, the controller sends only the message                                                |
| Exact selected text                                | `VERIFIED`     | Observed from Word, shown as a removable compact attachment and frozen on Send as quoted data separate from the message      |
| Empty, oversized or structural selection rejection | `VERIFIED`     | Empty selection means message-only; oversized, unreadable or unsupported selection visibly blocks Send before completion; accepted selection is limited to 20,000 characters and supported body/table-cell shapes |
| Whole-document context                             | `NOT INCLUDED` | The connector never automatically reads or sends the whole document                                                         |
| Multi-document workflow                            | `NOT INCLUDED` | No document set, workspace or background indexing exists                                                                    |
| Safe answer and source rendering                   | `VERIFIED`     | Model HTML is not executed; only a narrow formatting subset and exact approved HTTPS source hosts are activated             |
| Copy answer                                        | `VERIFIED`     | Copies through the clipboard boundary and does not mutate Word                                                              |
| Explicit proposal replacement/insertion             | `LOCAL CANDIDATE` | Guarded user-clicked plain-text writes; basic Engine returns no proposal; native formatting and Undo/Redo not yet verified; see [proposal contract](WORD_DOCUMENT_PROPOSAL.md) |
| Drafting, redlining and tracked changes            | `ROADMAP`      | Require a separate product contract and cross-client evidence                                                               |

## Request and response limits

| Boundary                        | Current rule                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Message                         | 1–4,000 characters                                                           |
| Selected text                   | At most 20,000 characters                                                    |
| Adapter request timeout         | 120 seconds                                                                  |
| Reference gateway request JSON  | At most 64 KiB                                                               |
| Reference gateway JSON response | At most 1 MiB                                                                |
| Reference gateway SSE response  | At most 1 MiB                                                                |
| Normalized answer               | At most 50,000 characters                                                    |
| Clickable source URL            | Credential-free HTTPS; exact PISRS or sodnapraksa hostname; no explicit port |

Limits are safety and resource boundaries, not guarantees that every value below
a limit is suitable for a particular backend.

## Failure and recovery behavior

| Condition                    | Verified behavior                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| User cancels                 | Active request is aborted; task pane returns to ready; late completion cannot become visible                |
| Adapter timeout              | Request terminates at the bounded timeout; document remains unchanged                                       |
| Operation is superseded      | Previous operation identity is invalidated; stale result is ignored                                         |
| Protected session expires    | Task pane shows a controlled state and offers secure sign-in                                                |
| Sign-in completes            | No message is automatically resubmitted                                                                     |
| User checks the connection   | The form returns without sending; the user must explicitly select Send                                      |
| User selects Edit message    | The form is preserved, but the next submission is a new independent request without prior conversation turns |
| OLC Engine fails             | No automatic retry or fallback occurs                                                                       |
| Copy fails                   | Visible answer remains available; Word is unchanged                                                         |

## Important limitations

### Retrieval is not exhaustive

A missing semantic result does not prove that no relevant act, amendment,
historical version or decision exists. Coverage depends on what the selected
backend has ingested, indexed and exposed to its model and tools.

### Answers require professional verification

The connector is not an authoritative legal source or a substitute for legal
judgment. Verify cited text, issuing body or court, date, temporal validity,
procedural posture and relevance directly against authoritative sources.

### Backend compatibility is narrow

Compatibility is defined by the exact routes, request and response shapes in
the [integration guide](INTEGRATION.md). Similar-looking or generally
“OpenAI-compatible” servers are not automatically supported.

### Source-only is not an operated service

A successful build produces connector artifacts. It does not provision a
backend, legal database, identity policy, DNS, certificate, gateway, hosting,
logging, retention or incident-response process. Operators own those
boundaries.

### Privacy depends on the displayed attachment and deployment

With no selection attachment, the connector sends no document text. A displayed
**Selected text** attachment sends only that exact frozen selection to the
configured backend; it can be removed before Send.
The operator's infrastructure can still process the question, selected text,
answer and ordinary request metadata according to its own policies. See
[Privacy](../PRIVACY.md).

## Roadmap boundary

The standalone [Roadmap](../ROADMAP.md) records client-validation priorities,
distribution options, legal-workspace directions and related OpenLegalCore
initiatives. Roadmap entries are not implemented, supported or promised by
`v0.1.0-beta.1` unless this document explicitly classifies them as verified.
