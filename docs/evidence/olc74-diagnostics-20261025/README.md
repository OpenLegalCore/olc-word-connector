# OLC-74 diagnostic candidate evidence — 2026-10-25

**PASS for controlled offline diagnostics; NOT ACTIVATED.** Product behavior and
[historical incident findings](../olc74-word-trial-20261025/README.md) are distinct.
The owner-reported failure remains **FAIL_OWNER_REPORTED / UNDETERMINED**.
The historical [SSO MANUAL PASS](../olc72-microsoft-delivery-20261025/README.md)
is retained unchanged, with its remaining NOT_RUN cases.

- [Contract, retention, privacy, rollout and limits](../../OLC74_DIAGNOSTICS.md).
- [Actual command outcomes](gates.json): local full suite 696 PASS / 1 protected
  live SKIP, followed by final focused suite 58 PASS after adding the receipt
  trust-boundary regression. Final-head CI run/SHA is linked from PR #3's handoff.
- [Actual focused test names/status](targeted-tests.json). HTTP, network, timeout,
  cancellation, SSE error after delta, incomplete terminal, result and language
  rejection produce distinct metadata. Success remains possible and does not
  imply Worker transfer EOF is model success.
- [Exact generated artifact checksums](artifacts.json), including 24 frontend and
  24 current-baseline rollback files, compiled Workers and loaded version mapping.
- [Fresh supported read-only settings](remote-settings-safe.json) and
  [Worker deployment/rollback availability](worker-baseline.json). Only allowlisted
  metadata is retained; no owner IDs, variable values, tokens or environment dump.
- [Fresh rollback byte/header checks](rollback-static.json): 26 static GET checks
  PASS on current staging. No session/models/completion request.

The real default Worker handler/workerd and SQLite receipt test makes the metadata
actually retrievable by the authenticated test client. It also proves denial
without a session, after revocation and across capabilities. Actual persisted
collection/event ceilings are tested. Unknown response fields and private sentinel
values cannot enter copied diagnostics. This is not a mock of the receipt store.

The new endpoint's staging access, traffic activation and rollback execution,
actual model behavior and native Word actions are **NOT_RUN**. No provider call,
Word/browser action, live code/settings change, dependency installation, Engine
change or merge was performed. Safe synthetic fixtures contain no incident input,
private document URL, owner content or generated real legal response.
