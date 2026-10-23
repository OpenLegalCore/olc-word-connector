# Technical guide

[Documentation index](README.md) · [Integration](INTEGRATION.md) ·
[Compatibility](COMPATIBILITY_AND_LIMITATIONS.md)

OpenLegalCore Word Connector is a strict TypeScript, vanilla HTML/CSS task-pane
add-in. OLC Engine is its only backend. The repository contains no Engine,
corpus, identity tenant or hosted service.

## Boundaries

| Component                 | Owns                                                            | Must not own                                  |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `OfficeWordAdapter`       | Selection-change observation, exact capture and validation      | HTTP, provider data or DOM rendering          |
| `TaskPaneController`      | One active operation, cancellation and stale-result suppression | Office.js, routes or provider parsing         |
| `OpenAICompatibleAdapter` | Engine model discovery, request construction and SSE validation | Office.js, task-pane DOM or document mutation |
| `TaskPaneView` / runtime  | Localization, connection flow, form state and safe rendering    | Provider credentials or Word proxy objects    |
| Same-origin gateway       | Route allowlist, bounds and server-only credentials             | Browser UI or Word access                     |

`ChatGateway` remains provider-neutral at the controller boundary so the
controller receives serializable requests, deltas and final results. That
interface is not a promise of multiple runtime providers.

## Document boundary

No-document mode never calls `captureSelection()`. Selected-text capture occurs
only after an explicit Search or Retry action. The adapter returns serializable
data; Office.js proxy objects never cross its boundary. The production flow has
no document mutation method. Cancel, timeout, validation failure, session
expiry, backend failure and late events leave Word unchanged.

## Engine transport

Production composition creates one `OpenAICompatibleAdapter` in same-origin
mode. The model is fixed to `lexai-engine-local`; there is no build-time model
override. It uses:

| Purpose         | Route                       |
| --------------- | --------------------------- |
| Model discovery | `GET /v1/models`            |
| Completion      | `POST /v1/chat/completions` |

Completion sends `stream: true`, `stream_options.include_usage: true` and the
frozen locale mapped to `response_language: sl|en`. Text deltas are emitted to
the controller while the operation remains active. A final result exists only
after `finish_reason: "stop"`, then `[DONE]`, with no error. Usage is copied
from the terminal aggregate or is `null`.

The prompt envelope keeps the message and quoted selection in separate
fields. The selected text is labelled quoted data, not instruction. Refine is a
new independent search; the connector stores no conversation history and never
retries automatically.

## Safe rendering

The renderer creates DOM nodes and assigns text with `textContent`. It never
executes model-provided HTML. It supports a narrow heading, list, bold and
reference subset. A link becomes clickable only for credential-free HTTPS URLs
on exact `pisrs.si`, `www.pisrs.si`, `sodnapraksa.si` or
`www.sodnapraksa.si` hosts.

## Localization and session flow

The current task pane supports `en-US` and `sl-SI`. Locale is resolved from
Office, then the browser, then English, and is not persisted. It controls
connector UI and `response_language`; it does not rewrite the question.

The browser sends only same-origin credentials. Redirects, HTML, `401` and `403`
become `SESSION_EXPIRED`. Sign-in uses `/api/session` and never auto-resubmits a
question.

## Gateway and credential isolation

The checked-in Worker is an inert example with only `/v1/models`,
`/v1/chat/completions` and `/api/session`. It requires `PUBLIC_HOST`,
`ENGINE_ORIGIN`, `ENGINE_API_KEY`, `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET`. All credentials remain server-side. The production
bundle verifier rejects server bindings, Access headers, persistent browser
storage, private-origin markers, test harnesses and document mutation
primitives.

## Builds and verification

Use Node.js 24 and the locked dependency tree. The maintained build targets are
`harness`, `word-harness`, `development`, `staging` and `production`. Deployable
outputs omit source maps and include the selected manifest and Cloudflare static
headers.

Run the complete command set in [Contributing](../CONTRIBUTING.md). Deterministic
tests cover controller state, selection observation and focus preservation, Engine SSE, late-event
suppression, safe rendering, production composition, gateway bounds, manifests
and bundle isolation. Protected live tests are opt-in and are not ordinary CI.

The accepted `v0.1.0-beta.1` record predates the Engine-only decision and covered
the then-current two-provider release. That evidence remains historical; a new
Engine-only Word for the web acceptance is required before this candidate can
merge.
