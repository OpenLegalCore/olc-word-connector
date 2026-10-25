# OLC-74 existing attempt and bounded SSE-code candidate

**IN REVIEW / NOT ACTIVATED. Incident cause UNDETERMINED.** Attempt
`bd72b0b0-acc9-442b-b147-8c0641aaa366`, 2026-10-25
14:00:35.812–14:00:44.429 UTC: the owner supplies HTTP 200 / SSE_ERROR_EVENT.
The original SSE error code is **NOT_RECOVERED**. The delivered parser's error
branch demonstrably discards it; this diagnostic defect does not identify the
cause of the failed request. No request replay, provider call or Word action occurred.

## What is established and what is missing

[Observations and access limits](observations.json) distinguish the supplied
pane metadata from our fresh read-only observations. The narrow Engine journal
contains [one HTTP 200 at 14:00:43.308961 UTC](engine-access.json), with no attempt
UUID, body hash or terminal code. It cannot be attributed to this attempt by time
alone. HTTP headers can precede an SSE failure. The service PID and invocation
match the retained operator proof for `eef8ed0794046922842258ce587aab722db5fcb4`,
53 imports and Planner sol/high/8000. No process/import/profile was changed or
reprobed. The active release directory is unreadable; accessible operator metadata
does not establish the effective private inspection directory. No correlated
inspection artifact was obtained. Missing logs are not a cause.

There is no connected Word session through supported document tools and no
retained browser Network capture available to this investigation. No tab was
opened/reloaded or credential store accessed. Current Worker metadata confirms
the existing diagnostic versions and no configured observability/logpush; that
is not proof that historical logs never existed. A fresh tail cannot recover
this historical error and was not started. No current capability was available
for the authenticated receipt GET; its ten-minute retention has elapsed anyway.
The receipt retains transfer metadata, not the original SSE code or request body.

**The complete actual incident body is unavailable.** Its exact question,
selection, loaded frontend fingerprint and sent-byte hash cannot be verified.
No production input/output is copied here. This limits task 1's historical
verification; a reconstruction is not promoted to a capture.

## Full serialization path checked offline

The deployed `documentReview.ts`, session API and upstream gateway source remain
unchanged. The new linking regression exercises the actual OpenAICompatibleAdapter,
WordSessionClient, session API, upstream gateway and SQLite-backed receipt store
with synthetic Unicode/newline/quote inputs. The upstream bytes equal the exact
frontend JSON bytes for SL and EN: one user message with separate instruction and
frozen selection text parts; model `lexai-engine-local`, stream true,
include_usage true, explicit language, and the full strict closed canonical
`lexai_document_review_v1` schema. Neither gateway strips/replaces these fields.
Both bound and reserialize JSON; they rebuild upstream authentication headers
and omit the Word capability, cookies and diagnostic headers.

[Engine validator evidence](engine-contract.json) records all eight module hashes
extracted directly from the exact pin. The own verification script imports only
these pure admission dependencies in a temporary directory; no Engine checkout
write, settings/environment load, provider import or call. An audit hook forbids
network/process execution during validation. The actual `parse_json_body` and
`validate_chat_request` admit both captured synthetic upstream bodies; four
negative controls per language reject unsupported language, wrong format,
invalid usage option and unsupported content part. This proves compatibility
of the exercised Word profile with pinned admission/default limits. It does not
prove the original body, semantic Planner/Writer behavior, effective runtime
limits or successful real Word/model use. No request-profile fix is justified
by these results, and none is made.

Reproduce with existing locked dependencies, without installs:

```bash
OLC_EXPORT_SYNTHETIC_WORD_REQUESTS=1 node_modules/.bin/vitest run test/gateway/diagnostics.test.ts
python3 scripts/verify-engine-word-request.py /home/rajko/olc-engine /tmp/olc74-synthetic-word-requests
```

## Minimal code change and regression boundary

The stream parser still rejects every error envelope, including after a delta,
without successful completion/application or POST replay. It now carries only
`error.code` through `ChatGatewayError` into optional diagnostic `upstreamCode`.
The 16 exact literals in `src/chat/upstreamSseError.ts` are verified against the
pinned `workflow.py:_workflow_failure_code`, explicit WorkflowError codes and
`server.py:stream_failure` call sites. There is no regex acceptance, trimming,
case folding, message/type/param/exception copying or raw envelope retention.
Missing, malformed, unsupported or changed codes become `UNKNOWN`. This is an
observed wire code, not a cryptographic proof of Engine execution/correlation.
Existing `code`, `phase`, `reason` and memory TTL/count bounds remain unchanged.
The Worker receipt and Engine correlation support are unchanged.

[Verification](verification.json): 92 focused tests PASS; full suite 732 PASS,
1 protected live SKIP; audit/typecheck/lint/format, four manifests, all build
profiles, Worker build and bundle isolation PASS. Coverage includes every allowed
code, unknown/malformed values, failure after delta, one POST, same attempt ID
across pane/Worker receipt, successful flow, and clipboard retention after pane
navigation without sensitive fields or a Word write. Exact-head CI is linked in
the PR publication comment. Controlled replies are not incident reproduction
or model/Word acceptance.

## Reviewable candidate and rollback

[Artifact map](candidate-artifacts.json) lists exact frontend/rollback hashes,
loaded-version fingerprint and unchanged Worker binaries. The candidate preserves
the approved real-host manifest, CSP/cache rules and MSAL vendor bytes. Shared
error-class bundling changes the signin JS asset/reference; its SSO logic is
unchanged. Eighteen same-path files match; only taskpane/signin JS/license paths
and their HTML references change. No Worker update is required.

Current baseline remains Pages `4bcc267c-62f0-461b-98af-6583436a6bc4`, source
`dc3bef4a8b7adac234bb92720f97a9106179be25`, Auth/store `8ec17425…`, API `cfb80b7b…`,
both 100%. [26 fresh immutable-host byte/header checks PASS](baseline-static.json).
The new local packet contains these exact 24-file baseline rollback bytes and
the 24-file candidate, verifier, checksums and frontend-only APPLY/ROLLBACK handoff.
Its final source SHA, archive path/hash and CI are in the PR publication comment.
No activation, rollback, main push, merge or infrastructure change occurred.

Historical login MANUAL PASS and the earlier FAIL_OWNER_REPORTED / UNDETERMINED
trial are preserved. Actual new code/clipboard in the owner's Word host,
proposal display/use, Apply/Undo/Redo/reopen and other outstanding retention
scenarios remain NOT_RUN. The missing Engine coordination contract remains:
validated request correlation plus sent-body hash/response identity and safe
terminal readback tied to release, with bounded retention/access; this frontend
change does not implement or pretend to recover that support.
