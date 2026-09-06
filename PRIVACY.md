# Privacy and data boundary

This statement describes the `v0.1.0-beta.1` OpenLegalCore Word Connector
source code. The repository provides a client and a generic gateway example;
it does not by itself operate a hosted service, legal database or identity
system.

The connector can use an operator-configured
[Open WebUI](https://openlegalcore.org/compatibility/) or
[OLC Engine](https://openlegalcore.org/components/olc-engine/)
backend. Its current legal-source scope is Slovenian
[legislation](https://pisrs.si/) and
[case law](https://www.sodnapraksa.si/), as supplied by that backend.

## Responsibility for a deployment

An organization or individual operating the connector is responsible for its
infrastructure, identity and access controls, backend configuration, legal
basis, notices, contracts, logging, retention, deletion and data-location
choices. Users should obtain that operator's privacy information before
submitting document content.

This repository cannot make universal claims about an independently operated
deployment, Microsoft 365 or Office.js, Open WebUI, OLC Engine, model provider
or legal-source service.

## Data flow by user action

| Action | Word content read | Data sent or changed |
| --- | --- | --- |
| Open the task pane or change provider | None | The connector may request the selected provider's model list; no document content is included |
| Search with **No document context** | None | The legal question is sent to the explicitly selected backend |
| Search with **Selected text** | Exact current selection, captured only when the user starts the search | The legal question and quoted selection are serialized as distinct fields in one structured prompt envelope and sent to the explicitly selected backend |
| **Copy answer** | None | The displayed answer is written to the system clipboard when permissions allow; Word is not changed |
| **Refine question** or **New search** | None | Task-pane state changes locally |
| Open a legal-source link | None | The browser visits the approved PISRS or sodnapraksa host |

The connector does not automatically read the document name, file path,
metadata, surrounding paragraphs or whole document. It never silently changes
from one context mode or provider to another.

## Selected-text boundary

The legal question and selected text remain distinct fields inside one
structured prompt envelope. Selected text is serialized as quoted data with an
explicit instruction that it is not a command. The current beta does not expose
whole-document capture.

Use the smallest relevant selection. Do not submit privileged,
client-confidential, personal or otherwise sensitive content unless you have
an appropriate legal and organizational basis and have verified the selected
deployment's processing and retention controls.

## Transport and credentials

Open WebUI and direct OLC Engine are separate, explicitly selected transports.
There is no automatic fallback or implicit credential sharing between them.

Connected browser builds use relative same-origin `/api/*` or `/v1/*` requests
with browser-session credentials. Provider API keys and private-origin
credentials belong in the operator-controlled gateway, not in frontend source,
bundles, manifests, URLs, browser storage, Office settings or logs.

Direct-development credentials, when intentionally used for local testing,
remain in memory for the current task-pane process. They are not a production
credential-delivery mechanism.

## Storage, logging and telemetry

The maintained connector source contains no analytics or telemetry integration
and does not persist the legal question, selected text, model response or
provider credential. It does not place those values in `localStorage`,
`sessionStorage`, IndexedDB, cookies, URLs, source maps, the Word document or
Office settings.

While the task pane is active, the current question, optional selection and
answer can exist in runtime memory, and the answer is displayed in the task
pane DOM. Selecting **Copy answer** creates a user-requested copy in the system
clipboard; the device and browser then control that clipboard's lifetime.

The generic gateway example returns `Cache-Control: no-store`, but a real
operator still controls platform, proxy, identity, backend and model-provider
logs. The absence of connector-side persistence is not a promise of zero
logging or immediate deletion throughout that wider system.

## Document and response safety

The current beta search workflow does not mutate the Word document. Answers
are rendered as untrusted text in the task pane. Cancellation, timeout,
session expiry, validation failure, backend error and late responses leave the
document unchanged.

Only credential-free HTTPS links on the exact approved PISRS and Slovenian
case-law hosts can become clickable. Opening one leaves the connector and
subjects the visit to that site's privacy and operational practices.

## Questions and incidents

For an operator-run deployment, direct privacy and data-rights requests to its
operator. For a suspected vulnerability, follow
[`SECURITY.md`](SECURITY.md) and email
[security@openlegalcore.org](mailto:security@openlegalcore.org) using synthetic,
redacted evidence. Public issues must never contain client documents, personal
data, credentials or private infrastructure details.

## Limits of this statement

This is a source-code data-boundary statement, not a universal privacy notice
for every deployment. It does not promise anonymity, zero logging, a specific
data location or a particular retention period. Operators must publish
information that matches the system they actually run.
