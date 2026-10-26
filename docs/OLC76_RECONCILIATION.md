# OLC-76 Word documentation reconciliation

Date: 26 October 2026. Base `fddc65d7ebf8a2f5e16332a322adca5783deacfd`.
This is a documentation-only candidate against the existing correlated-capture
branch. It neither moves main nor changes/deploys/reverts the Word product.

## Completed bounded changes

One [status register](STATUS.md) now separates the released beta, implemented
fddc source, attributed737/fddc deployment, manual Microsoft access acceptance
and the latest failed proposal attempt. The complete old status and proposal
records remain byte-identical archives. All old setup/activation/rollback
directions are classified by the [complete documentation map](DOCUMENTATION-MAP.md)
and cannot override current status or authorize a live action.

The owning technical/integration guides describe the actual Microsoft API-token
exchange and Word capability boundary, retaining the legacy Access/PKCE branch
without presenting it as current Microsoft login. The proposal guide preserves
strict validation, separate proposal/explanation, no automatic replay and guarded
explicit Apply. The missing manifest-permissions anchor is repaired against the
actual checked-in XML; a ReadDocument stage template is not accepted write proof.

Current AGENTS points to files actually present in fddc. The legacy AGENTS/spec/
implementation/P3 files in the original dirty local checkout remain untouched;
their absent files are not imported as current architecture. No password or
privilege workflow is introduced by this documentation change.

## Verification and limits

Relative links/anchors, changed-path whitelist, git diff --check, privacy review
and exact original/archive equality are checked before publication. Source,
Workers/store, manifests, assets, packages, lockfiles and runtime configuration
remain identical to fddc. Existing source/evidence is reused; no new product,
provider, login, Apply or live deployment tests are represented as performed.
Independent project review covers the complete documentation diff, current
owner goal and preservation of Word/Studio/LWS; exact review result is recorded
in the PR and final handoff.

OLC-74 remains open. SSO manual pass does not accept proposal display/Apply or
all hosts. The aa5 package is historical and would not preserve later Microsoft
SSO. Current all-client recovery and unattributed local branch/work disposition
remain OLC-76 coordinator obligations. Global Linear edits and Studio/LWS docs
belong to the coordinator/owning sessions; this PR does not take over those products.
Owner acceptance and exact-head CI are required before any future merge.
