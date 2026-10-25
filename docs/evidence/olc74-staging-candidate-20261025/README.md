# Staging preparation evidence — 2026-10-25

**CANDIDATE ONLY / NOT DEPLOYED / UPSTREAM MAPPING UNVERIFIED.**

See the [candidate contract and handoff](../../OLC74_STAGING_CANDIDATE.md).

| Check | Actual result |
| --- | --- |
| Product/test/infrastructure tree versus reviewed bacbecaa | PASS, unchanged |
| PR #2 acceptance documentation | PASS, cherry-pick with one reviewed STATUS conflict; both accurate records retained; read-only three-way comparison against PR #2 is conflict-free |
| New staging build | PASS, byte-identical to reviewed generic staging assets |
| Real-host manifest and hosting/MSAL continuity | PASS, 21 unchanged files; manifest and headers pinned |
| Rollback artifact | PASS, all 24 recorded hashes match; 27 fresh static HTTP checks pass |
| Operator Engine release/import/profile evidence | PASS, exact eef8ed0 release, 53 imports, 87 evidence hashes, Planner sol/high/8000 |
| Current Engine process | PASS, same live systemd MainPID as operator final proof |
| API Worker protected origin and active Worker versions | PASS, current readback matches baseline |
| Fresh Tunnel ingress/listener binding | UNVERIFIED: missing Cloudflare Tunnel Read and local root-read access |
| Production-only bundle verifier pointed at stage | FAIL, canonical production-manifest requirement; invocation is inapplicable to stage |
| Correct production bundle verifier | PASS; matching script/CSS/auth bytes already verified in staged output |
| New local full test suite | NOT_RUN, unchanged product and test trees; prior 677 PASS/1 SKIP and CI retained |
| Final exact-head CI | Required; actual run and result are attached to PR #3 and local package |
| Activation/provider/Word/browser/merge | NOT_RUN, not authorized in this preparation |

[Artifact comparison](artifacts.json) and [sanitized dependency evidence](dependencies.json)
are machine-readable. Full retained rollback/frontend hashes, public HTTP readback,
local operator proof paths, command records, final CI and immutable commit/tree are
in the local review package. No private operator JSON/environment or credentials
are published here. MANUAL PASS for SSO reopen/post-idle access is preserved from
PR #2; no input retention or proposal acceptance is inferred.
