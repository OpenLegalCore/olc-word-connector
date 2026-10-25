# OLC-74 Word trial investigation — 2026-10-25

**OWNER-REPORTED TRIAL FAILED; ROOT CAUSE UNDETERMINED.** This is an evidence
review of an existing request. No retry, completion, provider call, Word action,
code change, deployment or infrastructure/authentication change was performed.

The owner reports that a selected-paragraph revision on staging produced the
generic safe-stop view instead of a proposal, with the document reported
unchanged. The referenced screenshot is `image(20261025-111638).png`; its pixels
were not supplied to the accessible tools. Input text, instruction text, private
document URL/IDs and screenshot contents are deliberately not published.

The target delivery is Word source `e8ff0317ef699204783de90eb65b6377a95ce9cd`,
Pages `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4`, with Engine TEST dependency
`eef8ed0794046922842258ce587aab722db5fcb4`. The investigation starts from PR #3
documentation head `4c4878b912eb7f182270e4be9e273b05c36643a9`.

## What is established

| Question | Evidence and result |
| --- | --- |
| Did this particular request reach Engine? | **UNKNOWN.** Four existing completion access records are available, but no request identifier or confirmed Send timestamp joins one to the owner's trial. |
| What was its browser/Worker HTTP status? | **UNKNOWN.** No historical browser or Worker invocation record was obtained. |
| What did Engine record? | Four `POST /v1/chat/completions` header responses with HTTP 200; one predates activation. These are unattributed requests, not four proven attempts of this incident. |
| Did the SSE stream succeed? | **UNKNOWN.** No captured stream bytes, error code, stop or DONE record for this request. HTTP 200 alone is insufficient. |
| Did adapter validation reject it? | **UNKNOWN.** The in-memory controller error code and original response are unavailable. Generic UI text does not identify validation or any other failing boundary. |
| Is the current served taskpane the reviewed candidate? | **PASS for the public delivery.** HTML and JS hashes match e8ff0317. The already-open owner's loaded asset is **UNKNOWN**. |
| Did Workers change? | **No detected change:** supported Wrangler deployment readback returns the same Auth/API deployments and 100% versions. |

Actual owner trial outcome is recorded as **FAIL_OWNER_REPORTED**, not an
independently inspected Word result. The generic message is not itself a root
cause. The reported unchanged document is not an independent document comparison.

## Engine records and limits of correlation

The existing current-service journal was read without exporting raw messages,
peer addresses, process environment or document/model content. The extended
snapshot covers **08:00:00–11:35:12 UTC** on 2026-10-25, 39 journal entries in the
current Engine invocation. A narrower initial incident window contained the first
three completion rows; the extended read found one later row as well.

| Record | UTC | Europe/Ljubljana, CET | HTTP | Relation to activation |
| --- | --- | --- | --- | --- |
| 1 | 10:14:31.849 | 11:14:31.849 | 200 | Before the 10:16:06 UTC staging activation |
| 2 | 11:15:50.639 | 12:15:50.639 | 200 | After activation, unattributed |
| 3 | 11:16:17.815 | 12:16:17.815 | 200 | After activation, unattributed |
| 4 | 11:31:18.066 | 12:31:18.066 | 200 | Later observation, unattributed |

No row contains a request ID, trace ID or CF-Ray. The screenshot filename's clock
and actual Send time were not confirmed; the owner supplied a private document
link instead. Temporal proximity under one possible interpretation is not a
cross-layer identifier. No row is asserted to contain the reported selected text.
The investigator initiated none of these completions.

Engine source at the exact pin emits HTTP 200 before terminal stream processing
and can subsequently emit an SSE error. Its access logger does not include the
terminal result or a correlation ID. There are no non-access error/correlation
keyword records in this reviewed journal snapshot; that does **not** prove that
the application stream succeeded. See [sanitized access metadata](engine-access.json)
and [source references](source-map.json).

The Engine service still identifies the same release/invocation as the retained
operator proof. Private process IDs and paths remain local. The already verified
imports/profile were not reprobed. The bounded Tunnel journal has no entries;
that is not a proof of transport success or failure.

An accessible inspection-file search found 103 historical `run.json` paths;
the newest mtime is 05:23:12 UTC, before this incident window. Their request/output
contents were not inspected or copied. The effective current inspection directory
was not established from accessible unit metadata; protected operational package
and release paths are denied. Therefore **absence of an incident file in accessible
directories is not a claim that no protected record exists**. No OS authentication,
service/configuration change or database/content dump was attempted. Signed
standalone/workflow persistence is conditional in the Engine source; it is not
a demonstrated durable recovery record for this basic Word request.

## Browser and Worker evidence access

Supported browser inventory exposes only the Codex in-app browser/MCP Apps,
without the owner's Word tab. The supplied URL was used only to locate an
already-open tab, which was not found. A URL does not connect the owner's browser
or recover its previous Network log. No new Word tab was opened, reloaded or
interacted with; no browser profile, cookie or credential store was scraped.

Cloudflare MCP failed before the log query could run because its secure credential
store could not decrypt its saved credential. No reconnect or scope expansion was
attempted. This investigator connector failure is not evidence of a Word SSO
failure. The existing supported Wrangler CLI still allowed read-only metadata:

- API deployment `56ce5a31-b8d4-4817-8781-029bd294dc4c`, version
  `da36e666-89d1-4a59-b7b8-6fec4ad88807`, 100%.
- Auth deployment `b373fe59-d785-4146-950b-d496727b4bfb`, version
  `0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff`, 100%.

Version/deployment metadata is not a historical invocation log. The source
configuration's observability default is false, but the active version query did
not establish the effective logging setting. This review does **not** conclude
that no Worker log exists. No tail was started, since that would not recover this
historical request. The source rebuilds upstream headers without propagating a
client correlation header; an investigator static-GET CF-Ray is not an incident ID.

Fresh static HTML/JS GETs with the established verification User-Agent match the
reviewed hashes. An earlier plain-client HTML GET returned 403, while the later
verification GET returned 200. These are new **static probes**, not the historical
completion; their difference is recorded without assigning a cause to the Word
failure. See [all observations and access limitations](observations.json).

## What is still required to identify the failing layer

An already-retained browser/Worker record with the original HTTP status and
correlation identifier, plus the original stream terminal metadata or controller
error code, would distinguish transport/service failure from SSE or result
validation. A correlated protected Engine inspection record may also help if one
exists. These data were not obtained, and no new request is authorized by this
review to manufacture them. No proposed cause is elevated to a finding.

The delivered [staging/rollback checkpoint](../olc74-staging-activation-20261025/README.md)
is preserved. This owner-reported failure supersedes NOT_RUN only for that reported
trial outcome. Native Apply, Undo/Redo, result reopening and the remaining
draft/language/attachment checks remain NOT_RUN. Historical OLC-72 login MANUAL
PASS remains separate and unchanged. Only reviewed documentation is published;
no remedial product or delivery change is included.
