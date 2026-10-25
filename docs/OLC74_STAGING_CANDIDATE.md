# OLC-74 staging candidate — preparation only

**IN REVIEW / NOT DEPLOYED. Activation is blocked by unverified current Tunnel
ingress mapping.** No Worker payload or change is part of this candidate.

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
However, the remaining origin → local TEST listener mapping is **UNVERIFIED**:
the Cloudflare connection returns 401 because it lacks Tunnel Read, local config
read is denied, and noninteractive sudo requires OS authentication. Neither a
model name nor a models GET is used as version evidence. The missing read must
confirm the actual ingress and its listener/process binding before activation.
No Tunnel, route, Engine or identity setting was changed.

Engine delivery PASS does not accept Word/model proposal behavior. Native Word
replacement/insertion, Undo/Redo and saved-result reopen remain NOT_RUN.

## Frontend and rollback bytes

The current Pages source is `edfaf1dc3367cdd76c24ee9e176efb6bff2cedf8`,
deployment **`7e4bcdfe-11ff-4d61-9789-80962046e5b1`**. The production branch is
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

## Review package and later commands

The local handoff supplies the final Word commit/tree, CI URL, archive hash,
per-file checksums and concrete package path. Generated assets are deliberately
outside Git. The package includes `frontend/`, `rollback/`, offline verification,
sanitized evidence and `APPLY-ROLLBACK.md`. It contains no Worker deployment
payload, operator environment, credentials or private Engine data.

The existing CLI is Wrangler 4.151.3; its exact local path and hashes are pinned
in the package. Its command help was checked without installing or updating anything.
After separate activation authorization, a fresh unchanged-baseline read,
successful current upstream mapping attestation, and exact-head CI, the package's
APPLY command uploads only `frontend/` to `olc-word-staging --branch main` with the
final reviewed commit. ROLLBACK either uses the exact Pages rollback endpoint for
the baseline deployment or redeploys the verified `rollback/` directory with
source `edfaf1d`. Both preserve Microsoft Workers. The package contains the full
literal commands; none were executed here.

Before any later switch, the operator must pause new submissions and cancel
in-flight work. After a switch, verify the canonical Pages ID/source, exact bytes
and SSO headers before releasing that pause. On failure restore the baseline
Pages first; do not change Workers, Tunnel or Engine as an incidental remedy.

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

No activation, provider call, Word write, browser action, merge or other-project
change occurred. The concrete remaining delivery blocker is a fresh effective
Word Tunnel ingress/listener attestation; functional model/Word acceptance remains
a later, separately authorized step.
