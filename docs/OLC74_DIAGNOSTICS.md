# OLC-74 bounded failure diagnostics — candidate, not activated

**IN REVIEW.** This change starts at documentation HEAD
`da7c95959b0b9c7709770811d514a01bd9d4495f`. Active staging remains source
`e8ff0317ef699204783de90eb65b6377a95ce9cd`, Pages
`82da70e6-53ef-409e-b6cc-7f0ee91a9dd4`. The historical Word trial remains
[FAIL_OWNER_REPORTED / UNDETERMINED](evidence/olc74-word-trial-20261025/README.md).
This diagnostic implementation supplies no missing historical request record.
The original [SSO MANUAL PASS](evidence/olc72-microsoft-delivery-20261025/README.md)
is unchanged and does not accept this candidate or document proposals.

## Pane record and copy

The actual OpenAI-compatible adapter creates a cryptographic UUID v4 and UTC
start time before serializing/sending each completion. Its in-memory record has
only: schema number, attempt ID, start/end UTC, loaded frontend fingerprint,
failed/validated outcome, internal error code, phase, fixed reason and optional
observed HTTP status. It excludes request/response content, exception messages,
stack traces, document/selection identifiers, user identity, URLs and credentials.

**Kopiraj diagnostiko / Copy diagnostics** appears after a completion failure.
The last failure remains accessible when returning to the form, opening Settings,
changing language or checking the connection. The record survives controller
replacement within the pane. Up to five completed attempts are readable for
30 minutes in memory, with expiry pruned on access; pane disposal clears them and invalidates unfinished
attempts. Pane close/reload does not persist or restore diagnostics.

An explicit copy action can make one bounded, authenticated **GET** to
`/word-api/diagnostic`, using `X-OLC-Attempt-ID`. It uses the current Word capability,
with no login, renewal, replay, completion or document action. The read has a
five-second limit and an 8 KiB ceiling. Its entire closed response schema, ID,
version, timestamps, stage vocabulary, status range and expiry are validated
before copy. Clipboard failure uses the existing browser clipboard fallback;
it never calls a Word write. If the receipt is absent/expired, authentication
has changed, or reading fails, the frontend record still copies with Worker
`UNAVAILABLE`. This is an access/result limitation, not a diagnosis of the model.
A later explicit copy can read newly available metadata; it never retries POST.

The embedded `word-<sha256>` fingerprint identifies the **loaded** frontend,
not the latest server page. Webpack hashes sorted source files plus its config,
Babel config, package manifest and lockfile, with path/content separators. No
clock, environment, credential or document input enters that hash. The
[artifact map](evidence/olc74-diagnostics-20261025/artifacts.json) ties it to
specific JS hashes. Unbundled tests explicitly use `unbundled-test`.

| Failure | Phase / safe reason examples |
| --- | --- |
| HTTP rejection or unexpected content type | `http / HTTP_STATUS`, `HTTP_CONTENT_TYPE`; numeric status when the adapter received it |
| Fetch rejection | `http / FETCH_FAILED` with `NETWORK_ERROR` |
| Timeout / cancellation | current phase plus `REQUEST_TIMEOUT` / `CANCELLED` |
| SSE error envelope after a delta | `sse / SSE_ERROR_EVENT` |
| Invalid SSE JSON, model or finish reason | `SSE_JSON`, `SSE_MODEL`, `SSE_FINISH_REASON` |
| EOF before completion, DONE without stop | `SSE_INCOMPLETE`, `SSE_DONE_WITHOUT_STOP` |
| Stream read failure | `sse / STREAM_READ_FAILED` |
| Result/schema/provenance rejection | `result_validation / DOC_SCHEMA_KEYS`, `DOC_DUPLICATE_KEY`, `DOC_SOURCE_METADATA`, `DOC_SOURCE_URL`, `DOC_SOURCE_PROJECTION`, etc. |
| Wrong proposal language | `result_validation / PROPOSAL_LANGUAGE` |

All previous closed-schema, source projection, provenance, language, size,
citation/URL and frozen-selection checks remain in force. Reason labels are
attached to existing rejection conditions. No response is repaired or guessed.
Only a validated result after stop and DONE enables the existing explicit Apply
flow. Error after delta, cancellation and disconnect remain fail closed.

## Worker receipt and actual access

For the same-origin completion only, the frontend sends `X-OLC-Attempt-ID` and
`X-OLC-Frontend-Version`. After the existing capability and owner-policy checks,
the API Worker validates these headers and records `accepted`. It observes
upstream HTTP status (or `upstream_unavailable`), the returned response HTTP status,
and transfer EOF/cancel/read error. No response bytes are parsed for diagnostics.
Old clients without either diagnostic header keep their existing behavior;
malformed or partially supplied diagnostic headers are rejected.

The existing `WORD_SESSIONS` SQLite Durable Object stores these safe fields only.
There is no new binding, namespace, migration, logging service or logging-policy
change. Internal operations remain private to the binding. Records are bound to
the digest of the current Word capability, contain no token/principal, expire no
later than ten minutes or capability expiry, and are limited globally to 64
receipts with five events each. Reads enforce expiry; the existing alarm removes
expired rows. Revoked/expired capabilities and different/new capabilities cannot
read old receipts. This can make a receipt unavailable after access renewal; it
does not delete the pane's local failure record.

Writes are serialized best effort, with a one-second wait budget per event and
`waitUntil` lifecycle support. Storage outage, isolate termination or loss of
connectivity may leave a partial or missing receipt. Metadata availability never
controls result validation. A receipt is a bounded diagnostic record, not an
audit guarantee. Copying immediately may precede the last write.

**Transport EOF is not a valid model result.** The Worker does not validate stop,
DONE or document-review JSON. The client can intentionally cancel the reader
once it sees DONE, so even `transfer_cancelled` can accompany a validated frontend
result. Compare the two layers rather than interpreting the Worker event alone.
The frontend's `validated / VALIDATED_STOP_DONE` is a distinct client result.

[Offline evidence](evidence/olc74-diagnostics-20261025/README.md) uses the real
adapter, session client, API gateway, SQLite store and workerd default handler.
It proves joined IDs, accessible authenticated reads, denial without a session
and after revocation, cross-capability isolation, retention limits, transfer
boundaries and sanitized output. **Live availability of the new endpoint is
NOT_RUN:** this candidate has not been activated. Effective current Cloudflare
settings return no observability configuration; console log persistence is not
assumed. The new read path does not depend on that setting.

## Engine boundary and missing contract

The required Engine TEST pin remains
`eef8ed0794046922842258ce587aab722db5fcb4`, with the retained operator
release/import/Planner-profile evidence and owner-executed Tunnel mapping.
A read of `src/lexai_engine/server.py` at that exact Git object confirms that the
basic Word handler/access logger does not consume/log this attempt ID or record
a correlated terminal result. Its HTTP 200 can precede an SSE failure. No Engine
code, profile, route, running process or inspection storage was changed.

The copied record therefore explicitly says Engine correlation `UNSUPPORTED`.
The new headers stop at the API Worker; they are not added to the Engine request.
Worker `upstream_http` identifies an HTTP response from the configured protected
upstream, not a correlated Engine execution or model success.

Future Engine coordination would need an approved bounded correlation contract:
accept/validate the UUID header on basic Word completions, propagate it into
safe admission/access/terminal metadata, and expose a supported authenticated
lookup tying it to the actual Engine release, HTTP outcome and fixed terminal
error/stop/DONE/cancellation state. That contract must exclude content, identity,
credentials and arbitrary exception strings and specify retention/access rules.
This candidate neither claims nor implements that future Engine change.

## Coordinated staging and rollback candidate

The local review packet contains the exact frontend bytes, both compiled Workers,
minimal settings-preserving upload configurations, current e8ff0317 frontend
rollback bytes, checksums, verifier and precise APPLY/ROLLBACK instructions.
Auth Worker changes are limited to the existing store class; API Worker adds the
receipt/observer. Their SSO verification, issuance and owner-policy logic are
unchanged. Both Worker payloads are required before the diagnostic frontend.
No automatic activation, production promotion, GitHub-main change or merge is
part of preparation/publication.

The approved real-host manifest and `_headers` are byte-identical to current
staging. MSAL vendor assets, redirect, domains, host settings and dependencies
are preserved. Eighteen same-path frontend files match. Taskpane and Microsoft
signin JS/license paths and their HTML references change: the signin entry
imports the shared error class with its added safe reason field; its SSO logic
is unchanged. All changed/added/removed paths and hashes are explicitly listed
in the artifact map. No source maps are included.

Future APPLY must reread the exact baseline, final-head CI, Engine/operator proof,
active request state and settings; wait for the owner's work, never cancel it
unilaterally. Use the pinned existing Wrangler with `--keep-vars`, no new vars or
secrets, and the existing store binding/historical migration tag. Upload versions
without traffic, verify their metadata/settings, then activate store/Auth, API
and frontend in that order only under a separate staging authorization. Preserve
all routes, identity/access settings and project/domain configuration.

Rollback restores the current e8ff0317 frontend bytes/retained deployment first,
then API version `da36e666-89d1-4a59-b7b8-6fec4ad88807`, then Auth/store version
`0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff`. Read-only version queries confirm both
rollback versions remain available. No namespace/schema destruction or credential
reset is needed; old generic expiry cleanup tolerates the bounded new rows.
Worker rollback traffic switching and new live endpoint availability are NOT_RUN.
Exact package path, commit, archive SHA-256 and final CI URL are returned in the
PR handoff after publication.

Actual Word proposal display/use, clipboard behavior in the owner's host,
Undo/Redo, saved-result reopen, and remaining draft/language/attachment retention
checks remain NOT_RUN. Controlled offline results do not accept a real model or
Word session. First later diagnostic acceptance: after separately authorized
activation, when an owner-driven trial fails, click **Kopiraj diagnostiko** once
and retain that sanitized record; do not click Send again to obtain a record.
