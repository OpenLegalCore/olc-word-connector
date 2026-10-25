# OLC-74 staging frontend activation — 2026-10-25

**STAGING DELIVERED / IN REVIEW / WORD ACCEPTANCE NOT_RUN.** The owner explicitly
authorized this frontend-only activation. The original review package remains
unchanged; these are separate post-activation evidence files.

| Identity | Actual value |
| --- | --- |
| Delivered Word source | `e8ff0317ef699204783de90eb65b6377a95ce9cd` |
| Source tree | `99999621daa6caa3666382e61ee63b749596bb3a` |
| Reviewed product baseline | `bacbecaa0833f9b99a5aeb6410a56878a4509631` |
| Engine TEST dependency | `eef8ed0794046922842258ce587aab722db5fcb4` |
| Canonical Pages deployment | `82da70e6-53ef-409e-b6cc-7f0ee91a9dd4` |
| Immutable staging URL | <https://82da70e6.olc-word-staging.pages.dev> |
| Delivery created | 2026-10-25 11:16:06 CET / 10:16:06 UTC |
| Taskpane asset | `taskpane.02aa65737465e62401a7.js` |
| Asset SHA-256 | `4aa6d608de93656fe5599a1071df3c46b9402f6106d19f063e7db03981dec167` |
| Reviewed archive SHA-256 | `ea5bfd63788d36121ae6909ceb2a4a3815f5fca3b9379482574b245b0b043bf5` |

The existing `olc-word-staging` Pages delivery channel is named `main` and the
API labels its environment `production`. This operation affected that staging
project only. GitHub main was neither changed nor pushed; Word PRs
[#2](https://github.com/OpenLegalCore/olc-word-connector/pull/2) and
[#3](https://github.com/OpenLegalCore/olc-word-connector/pull/3) remain draft,
open and unmerged. Source after the delivery is documentation only.

## Entry and owner-executed route evidence

The root AGENTS/current owner scope, previously read legacy project documents,
current contribution/status/adapter guidance, and the immutable package's
APPLY/ROLLBACK procedure govern this work. The current owner instruction supplies
the missing route attestation and supersedes the package's historical activation
block. Existing checkouts and unrelated user edits are preserved.

The owner manually performed the protected local read: the active cloudflared
process explicitly selects local configuration, the configuration mtime precedes
process start, its protected Word ingress destination matches the listener, and
that listener's Python PID matches the Engine operator release proof. The agent
confirmed the same Engine service PID is still active through an unprivileged
systemd read. The already checked 53 imports and effective Planner
`gpt-5.6-sol / high / 8000` remain operator evidence. No import probe was rerun.

This is **owner-executed structural route evidence**, not an automated protected
Tunnel inspection or a forwarding/model acceptance test. No extra OAuth scope,
OS authentication, configuration change or new Engine request was used. Private
addresses, process IDs and config paths remain in the local handoff.
See [sanitized provenance and limits](owner-tunnel.json).

Three sampled read-only TCP observations and another immediately before APPLY
found zero established Engine connections. No application admission lock was
installed; the owner was asked to hold submissions during the switch. No active
work was detected or cancelled, and no Word/browser window was inspected.

## Actual checks

| Check | Result |
| --- | --- |
| Archive and all 71 internal payload hashes; no links/path traversal | PASS |
| Extracted packet, 24 frontend and 24 rollback files | PASS before and after APPLY |
| Existing Wrangler 4.151.3 package/launcher/CLI hashes | PASS; no installation or build |
| Exact delivered-source CI | PASS: [40180031619](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40180031619), every validate step successful |
| Current Pages baseline, settings, domains and Worker versions | PASS, expected original baseline |
| Required preflight static-byte/header comparisons | PASS, 78/78 |
| Reviewed frontend-only APPLY | exit 0; 2 assets uploaded, 21 reused, `_headers` uploaded |
| Actual canonical ID/source/success readback | PASS, values above, commit_dirty=false |
| Postflight static-byte/critical-header comparisons | PASS, 78/78 |
| Retained rollback immutable-host comparisons | PASS, 26/26; rollback NOT_EXECUTED |
| Auth/API deployments and allowed configuration readback | PASS, unchanged |
| New local product suite or build | NOT_RUN, exact existing delivery bytes and source CI used |
| Model/completion, Word display/write, browser actions | NOT_RUN; no calls or actions |

HTTP coverage is all **23 served files on each of three hosts** (immutable,
canonical pages.dev and custom domain), plus taskpane/Microsoft signin/redirect
extensionless spellings on each. Every body hash matches the package. Critical
documents have the exact approved Microsoft CSP, no-store and absent
X-Frame-Options; manifest/cache, immutable assets, HSTS, nosniff and referrer
policy are checked. `_headers` is a deployment rule input, verified by its
unchanged hash and observed effects, rather than counted as a public response.
See [individual HTTP checks](http.json) and [all artifact hashes](checksums.json).

An initial broader helper invocation returned **exit 1**: it expected literal
no-cache on two legacy canonicalized helper pages (six responses) and current
document CSP on nine historically cached, unchanged immutable assets. All 78
body hashes already matched; critical SSO/taskpane CSP/no-store passed. This was
existing baseline behavior, not baseline byte/control-plane drift. The helper
was narrowed to the reviewed document/header requirements, retaining the original
failure locally; no hosting rule or delivery byte was changed to resolve it.

The first post-APPLY package file-set check returned **exit 1** solely because
Wrangler created a new CLI cache file and empty temporary directories. All 71
payload hashes and the archive were unchanged. That generated cache was moved to
the separate local activation evidence directory, and only empty tool-created
folders were removed. A first empty-folder cleanup also returned 1 for a remaining
empty tmp folder; targeted cleanup completed. Final package verification is
**exit 0**, with the original file layout restored.
See [verification qualifications](verification.json) and [control-plane readbacks](delivery.json).

## Rollback and acceptance boundary

The immediate pre-activation deployment remains
`7e4bcdfe-11ff-4d61-9789-80962046e5b1`, source
`edfaf1dc3367cdd76c24ee9e176efb6bff2cedf8`. Its 24-file exact-byte rollback and
the reviewed Pages-only rollback command remain available in the original
package. All retained immutable-host checks pass after activation. No rollback
was required or exercised. Keep both Workers at their original 100% versions:

- Auth `0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff`.
- API `da36e666-89d1-4a59-b7b8-6fec4ad88807`.

The [SSO MANUAL PASS](../olc72-microsoft-delivery-20261025/README.md) remains
limited to the owner's previously reported reopen and post-idle access checks.
It is not acceptance of this new frontend. Nonempty draft/language/attachment
preservation, actual new Word proposal display/use, model behavior, insertion/
replacement, Undo/Redo and saved-result reopening remain **NOT_RUN**. Production
result storage remains memory-only. Deployment evidence and controlled offline
tests do not establish native Word acceptance.

First step for a separately authorized acceptance: in a test Word document load
the new pane, select a short synthetic paragraph, and request “Preoblikuj ta
odstavek jasneje.” First record the displayed separate proposal, any required
notice, and the unchanged document. Applying it is a later explicit owner action.
This protocol was prepared here; no such request was sent.

The first published evidence commit introduced a STATUS overlap against PR #2.
A documentation-only additive correction preserves the original SSO checkpoint
section byte-for-byte and retains the current delivery outcome in its own end
section. The read-only integration preview passes; no merge or redeploy was used.

Only reviewed documentation/evidence paths are published on the adapter branch.
Delivered-source CI is pinned above; it is not relabelled as CI for later evidence
commits. The exact then-current PR head still needs CI before any future merge.
No provider call, Word write, Engine/Worker/auth/Access/Tunnel/DNS/LWS/Studio
change, production promotion or merge occurred.
