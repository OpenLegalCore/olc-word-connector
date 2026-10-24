# Backend and gateway integration

[Documentation index](README.md) · [Installation](INSTALLATION.md) ·
[Technical guide](TECHNICAL_GUIDE.md) · [Security](../SECURITY.md)

This guide defines the current OLC Engine integration contract for OpenLegalCore
Word Connector. The repository provides the browser add-in and a generic
same-origin Cloudflare Worker example. It does not provide Engine, a legal
corpus, hosting, identity, DNS or credentials.

## Integration principles

1. The task pane calls only relative routes on the HTTPS origin that serves it.
2. OLC Engine and infrastructure credentials remain server-side.
3. OLC Engine is the only backend. There is no fallback or automatic retry.
4. The dedicated API exposes only `/word-api/` session, models and completion
   operations; the separate `/word-auth/authorize` boundary verifies human login.
5. Unexpected hosts, paths, methods, content types, redirects and oversized
   bodies fail closed.
6. A request contains no Word text or only the exact selection shown in the
   removable task-pane attachment and frozen by an explicit Send action.

```mermaid
flowchart LR
    Word["Word task pane"] --> API["Word-scoped API Worker"]
    Word --> Dialog["Office top-level login"]
    Dialog --> Auth["Human Access + verified JWT"]
    Auth --> Store["SQLite Durable Object"]
    API --> Store
    API --> Engine["OLC Engine"]
    Access["Server-only service credentials"] --> Engine
```

## Browser-facing contract

Production wraps the Engine adapter with a memory-only Word session. Browser
requests use `credentials:omit` and a Word-scoped Authorization capability, never
an Engine bearer or Access service token. Human Access cookies are used only in
the separate top-level Office dialog. See [PKCE, JWT and session boundary](WORD_SCOPED_SESSION.md).

| Route | Method | Result |
| --- | --- | --- |
| `/word-api/v1/models` | GET | Model list with `lexai-engine-local` |
| `/word-api/v1/chat/completions` | POST | Bounded native SSE |
| `/word-api/session` | GET | Authenticated session metadata |
| `/word-api/session/exchange` | POST | Single-use code + PKCE exchange |
| `/word-api/session/revoke` | POST | Revoke current Word capability |
| `/word-auth/authorize` | GET | Human Access + verified JWT; exact Office return |

The local OLC-72 candidate fixes the model and selects the documented
`lexai_document_review_v1` profile (supported from Engine 9753ad1, not 09171ea).
The request fixes the frozen interface language:

```json
{
  "model": "lexai-engine-local",
  "stream": true,
  "stream_options": { "include_usage": true },
  "response_language": "sl",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "<exact user instruction>"},
        {"type": "text", "text": "<exact frozen selection, omit this part when absent>"}
      ]
    }
  ]
}
```

The example above is abbreviated: **also include**
`response_format.type="json_schema"`, `json_schema.name="lexai_document_review_v1"`,
`strict=true` and the **full exact canonical schema**. The executable
`documentReviewBody`/`documentReviewSchema` in `src/chat/documentReview.ts` supplies
it. The pinned schema fingerprint and actual offline admission checks are in
[the proposal contract](WORD_DOCUMENT_PROPOSAL.md). A profile name alone or a
modified schema is invalid. No profile fallback is allowed.

`sl-SI` maps to `sl` and `en-US` maps to `en`. Content deltas are actual JSON
fragments; an incremental reader forwards only decoded `claims[].text` and
`notice` prefixes to the safe explanation renderer. Source/proposal fragments
never appear as explanation. Success requires
`finish_reason: "stop"`, followed by `data: [DONE]`, with no error event. EOF,
`length`, tool terminals, malformed events, timeouts and interruptions fail even
when partial text was displayed. Usage is the actual final aggregate or `null`;
the connector never estimates it. Only complete validated output can expose
separate sources or the explicit proposal. `NEEDS_CLARIFICATION`, `NOT_FOUND`
and `UNSUPPORTED` require empty claims/sources and `proposal:null` and cannot
enable document actions.

## Request parts and explicit document text

The one user message contains original text parts, not embedded JSON format
instructions. The first is the full unmodified instruction; the optional second
is the exact captured selection. No history, role/intent classifier or invented
context is added. The legacy `olc.word.legal_source_search.v1` envelope remains
only in the older direct/test compatibility path, not production composition.

With no valid attached selection, only the message is sent. The task pane
observes Word selection changes and displays a compact preview; moving focus
into the input preserves that preview. Selected text is limited to 20,000
characters and supported Word body or single-table-cell shapes. Model output is
untrusted text; only the renderer's narrow formatting
and exact HTTPS source-host allowlist can create links.

Claims/notice, source metadata and `proposal` remain separate. Document text is
the exact `proposal.markdown` string, previewed and inserted literally as plain
text; no citations, links, formatting markers or paragraphs are stripped. If
the public text restrictions fail, reject the result instead of repairing it.
Raw final JSON stays in current-result memory only. See
[document-write guards and the outstanding Engine incident](WORD_DOCUMENT_PROPOSAL.md).
This local adapter is not an activation or semantic-acceptance claim. The
existing login failure remains an unchanged production blocker.

## Preserved legacy gateway and new API boundary

The reference files are:

- `infrastructure/cloudflare/word-gateway-example/worker.js`
- `infrastructure/cloudflare/word-gateway-example/wrangler.toml`

They are inert until an operator supplies an exact public host, Engine origin,
routes and secrets. Required bindings are:

| Name                      | Kind     | Purpose                                  |
| ------------------------- | -------- | ---------------------------------------- |
| `PUBLIC_HOST`             | variable | Exact browser-facing hostname            |
| `ENGINE_ORIGIN`           | variable | Exact protected HTTPS OLC Engine origin  |
| `ENGINE_API_KEY`          | secret   | Dedicated server-side Word Engine Bearer |
| `CF_ACCESS_CLIENT_ID`     | secret   | Dedicated Access service-token client ID |
| `CF_ACCESS_CLIENT_SECRET` | secret   | Matching Access service-token secret     |

The gateway rebuilds upstream headers from trusted bindings, strips browser
cookies and supplied authorization headers, rejects redirects and bounds JSON
and SSE responses to 1 MiB. Request JSON is limited to 64 KiB. Downstream
cancellation cancels the upstream stream.

Use a dedicated Access service token allowed only by the existing Engine Access
policy. Add it alongside any existing service token; do not remove or rotate the
old token as part of Word activation. Validate the new pair directly from its
protected secret-bearing environment before assigning the two Worker secret
bindings. The pair and Engine Bearer must never enter Pages, JavaScript, Git,
Linear, logs or command arguments.

## Session recovery and cancellation

The new API checks the shared Durable Object on every protected request and
SSE start. Missing/expired/revoked capability returns 401; denial is 403, not
inferred expiry. Timeout, network failure, throttling, unavailability and malformed
responses remain separate. Code exchange is atomic and rate limited. The Office
dialog passes no credentials to the pane; its verified, state-bound code is
exchanged before the two safe GETs. Cancellation and late exchanges cannot restore
a closed pane. There is no Storage Access action in the new composition.
The old protected gateway/callback remains preserved for rollback. Current
source/configuration is not a live change; see [staging procedure](WORD_SESSION_STAGING.md).

Cancel, timeout and supersession abort the active fetch and invalidate its
operation identity. Late deltas, resolution and rejection cannot become a
result. **Edit message** starts a new independent request; no conversation
history is persisted.

## Verification

Run the deterministic project gates from [Contributing](../CONTRIBUTING.md).
The opt-in Engine live contract test is skipped unless its explicit environment
switch and in-memory direct-test credential are supplied by an authorized
operator. Ordinary CI makes no private infrastructure or provider call.

A connected deployment is accepted only after exact-artifact verification and
a separately authorized Word for the web walkthrough covering both languages,
message-only and attached-selection requests, deltas, usage or null,
cancellation and session recovery. Document writes additionally require the
separate native Word replacement/insertion, formatting, Undo/Redo and
Save/reopen matrix. Receiving a response must always leave the document unchanged.
