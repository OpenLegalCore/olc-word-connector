# OLC-74 staging delivery and retained preparation

Current diagnostic delivery: [actual frontend-only SSE-code activation](evidence/olc74-sse-activation-20261025/README.md)
records source `de34ecd…`, Pages `6f22feb3…`, postflight PASS and exact current-before-activation
rollback `4bcc267c…` / `dc3bef4…`. Worker versions/settings are unchanged. The earlier
coordinated diagnostics activation and initial e8ff0317 sections below are historical.
Delivery improves diagnostics; the historical incident remains UNDETERMINED.

**IN REVIEW / STAGING DELIVERED / OWNER-REPORTED WORD TRIAL FAILED.** On 2026-10-25 the
owner authorized frontend-only activation of `e8ff0317ef699204783de90eb65b6377a95ce9cd`.
Canonical Pages deployment is `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4`; source and
all delivered bytes match the reviewed package. See [actual activation evidence](evidence/olc74-staging-activation-20261025/README.md).
No Worker payload or change is part of this delivery.
A later [read-only incident review](evidence/olc74-word-trial-20261025/README.md) records
that the owner received the generic safe-stop view instead of a proposal. The
exact HTTP/SSE/adapter outcome remains uncorrelated; native apply is NOT_RUN.

## Exact scope

The product baseline remains `bacbecaa0833f9b99a5aeb6410a56878a4509631`.
Source, tests, dependencies, manifests, hosting headers and Worker code are
unchanged from that reviewed commit. PR #2 documentation commit
`c2b8b63c496d34ae89688bd544b66aeb4824a6aa` was cherry-picked onto PR #3 without
rebasing or force-pushing. The one STATUS conflict retained both the adapter
record and the owner's MANUAL PASS for reopen and one post-idle access check.
The original [acceptance record](evidence/olc72-microsoft-delivery-20261025/README.md)
and staging instructions are byte-identical to PR #2. Nonempty draft/language/
attachment preservation and the other listed NOT_RUN cases remain unaccepted.

## Engine dependency and route evidence

Required Engine TEST release: **`eef8ed0794046922842258ce587aab722db5fcb4`**,
full tree `12b8cf14a512b6be6c8cfc277364a97276449fd6`.
The local operator handoff `olc74-engine-test-eef8ed0-20261025` records actual
deployment and postflight PASS. All 87 files in its evidence checksum manifest
match. Its final proof checks all 53 imported Engine modules against the exact
release archive, with release-local paths and execution identity. It derives
effective settings from the actual process environment: Planner
`gpt-5.6-sol / high / 8000`, Writer `gpt-5.6-sol / high / 16000`, Selector
`gpt-5.6-terra / medium`. A fresh read of the running systemd unit confirms the
same PID as that operator proof. This is operator-attested code/import/profile
evidence; no new import probe, environment export or model call was performed.

The active Microsoft API Worker still points to the existing protected Word
origin, and Microsoft auth is enabled. Auth/API versions match the baseline below.
The earlier mapping blocker is resolved by an **owner-executed** protected local
read supplied with activation authorization. The active cloudflared process
explicitly selects local configuration, whose mtime predates that process start.
The protected Word origin's ingress destination matches the listener, and the
listener's Python PID matches the exact Engine operator release/import proof.
An agent read-only systemd check confirms that same Engine PID remains active.
These are configuration/process/listener links; no new protected-config read,
Tunnel Read permission, live completion or model-version inference was used.
Private paths, addresses and PIDs remain local. See the [sanitized owner evidence](evidence/olc74-staging-activation-20261025/owner-tunnel.json).
No Tunnel, route, Engine or identity setting was changed.

Engine delivery PASS does not accept Word/model proposal behavior. Native Word
replacement/insertion, Undo/Redo and saved-result reopen remain NOT_RUN.

## Frontend and rollback bytes

The pre-activation rollback Pages source is `edfaf1dc3367cdd76c24ee9e176efb6bff2cedf8`,
deployment **`7e4bcdfe-11ff-4d61-9789-80962046e5b1`**. Current source is
`e8ff0317ef699204783de90eb65b6377a95ce9cd`, deployment
`82da70e6-53ef-409e-b6cc-7f0ee91a9dd4`. The Pages delivery branch is
`main`; automatic production and preview deployments are disabled. The project
is static (`uses_functions=false`). Preserve these settings and existing domains.

- Auth Worker: `0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff`, 100%.
- API Worker: `da36e666-89d1-4a59-b7b8-6fec4ad88807`, 100%.
- Approved real-host manifest SHA-256:
  `2ce9617367832ec2bb3b141e28e8ce87467030210ec62a7db37bb597950d200e`.
- Preserved `_headers` SHA-256:
  `d7ba8a562548d191cfd0d7249b5a081a37fe235efc95dd6dc7976213582c0ad5`.
- Candidate task pane: `taskpane.02aa65737465e62401a7.js`, SHA-256
  `4aa6d608de93656fe5599a1071df3c46b9402f6106d19f063e7db03981dec167`.

The freshly built generic staging output matches all reviewed bacbecaa artifacts.
The package replaces only its template manifest with the approved current
real-host bytes. Candidate and rollback each contain 24 files. All 21 files
outside the taskpane family match the current delivery byte-for-byte, including
MSAL/auth assets, CSP/no-store headers, manifest, CSS and icons. Only taskpane HTML
and its two content-hashed JS/license paths change. There is no new configuration
endpoint, HTTP parameter, Worker, migration or credential.

The rollback directory matches every hash in the retained delivery manifest.
Fresh provider-free verification made 23 immutable-host asset GETs plus four
critical current-host GETs: **27 PASS**, including Microsoft CSP/no-store and
absent X-Frame-Options for the three auth/taskpane documents. `_headers` matches
the delivered source and its observed effects. No API/session/model GET was needed.

## Review package and executed staging APPLY

The local handoff supplies the final Word commit/tree, CI URL, archive hash,
per-file checksums and concrete package path. Generated assets are deliberately
outside Git. The package includes `frontend/`, `rollback/`, offline verification,
sanitized evidence and `APPLY-ROLLBACK.md`. It contains no Worker deployment
payload, operator environment, credentials or private Engine data.

The existing CLI is Wrangler 4.151.3; its exact local path and hashes are pinned
in the package. Its command help was checked without installing or updating anything.
After explicit owner staging authorization, unchanged-baseline readback,
owner route attestation and exact `e8ff0317` CI success, the reviewed APPLY
command uploaded only `frontend/` to `olc-word-staging --branch main` and exited 0.
This `main` is the staging project's Pages delivery channel; GitHub main was not
changed, and both PRs remain unmerged. No build or dependency installation was needed.

Three sampled socket reads and an immediate pre-APPLY read found no established
Engine HTTP connections. No application admission lock was installed and no Word
window was inspected; the owner was asked to hold submissions during the switch.
No active work was found or cancelled. All 78 required postflight HTTP checks pass
on immutable, canonical pages.dev and custom hosts: all 23 served files per host,
plus three extensionless critical documents per host. `_headers` is checked by
its preserved checksum and observed CSP/cache effects, not as a served file.
Auth/API versions, configuration and project settings are unchanged.

The original review archive, extracted payload and rollback are retained unchanged.
Wrangler's generated CLI cache was moved out of the reviewed packet; no payload
file changed. Rollback is available at the exact baseline deployment and all 26
immutable-host asset/header checks pass after activation. ROLLBACK was not executed.
On later rollback use the retained Pages-only command; do not change Workers,
Tunnel or Engine as an incidental remedy.

## Checks and limits

The original offline suite and successful CI on bacbecaa remain product evidence.
They were not rerun locally because product and test trees are unchanged.
The new staging build passes; all generated bytes match the reviewed build.
The production bundle isolation gate passes on the matching preserved production
output. An initial attempt to point that production-only verifier at `dist/stage`
reached its canonical-production-manifest check and failed as expected for a stage
manifest; this is recorded, not claimed as a stage PASS. Final-head CI is required
and its actual result is in the PR/package handoff. Conflict resolution, local
links, JSON, exact path scope, privacy/secret review and `git diff --check` are
recorded in [the evidence](evidence/olc74-staging-candidate-20261025/README.md).

The actual staging frontend activation is recorded above. No provider call,
completion, Word write, browser action, merge or other-project change occurred.
The delivery checkpoint did not exercise Word or a model request. The later
owner-reported trial failed before proposal display; this investigation did not
replay it or establish its failing layer. Native apply, Undo/Redo and result reopen
remain NOT_RUN. Historical SSO MANUAL PASS is not acceptance of this new delivery.


## Later diagnostics candidate — separate, not activated

The delivery and rollback above remain historical checkpoints. PR #3 now also prepares a [coordinated diagnostics candidate](OLC74_DIAGNOSTICS.md), including frontend, API Worker and existing store code. Its rollback baseline is the current `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4` / `e8ff0317` delivery, with the same retained Auth/API versions. Do not use the original frontend-only APPLY for this coordinated candidate. New code has offline PASS; new live diagnostics and Word/model acceptance are NOT_RUN. The historical failure remains UNDETERMINED.
