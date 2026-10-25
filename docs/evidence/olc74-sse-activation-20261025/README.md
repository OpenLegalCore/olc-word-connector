# OLC-74 frontend-only staging activation — actual delivery

**STAGING_DIAGNOSTICS_DELIVERED / POSTFLIGHT PASS. Incident cause UNDETERMINED.**
The owner explicitly authorized activation of reviewed product source
`de34ecdbc6d53ce756ecfc2e44b7c7ff6133339f`, tree
`9c6e04323999f8852be618a0445b1e2a58a72905`. Only prepared Pages frontend bytes were
uploaded. This improves bounded SSE diagnostics; it is not incident resolution
or successful real Word/model acceptance.

## Actual identities and verification

| Component | Actual identity / result |
| --- | --- |
| Pages project | `olc-word-staging` |
| Canonical deployment | `6f22feb3-14cc-4fab-a3e0-d9b30cd55c79` |
| Delivered source | `de34ecdbc6d53ce756ecfc2e44b7c7ff6133339f` |
| Immutable URL | `https://6f22feb3.olc-word-staging.pages.dev` |
| Taskpane asset | `taskpane.add14d180a105236dd9d.js` |
| Asset SHA-256 | `f4c05e65fabc8cf9e12eae11c3bc39b8048b56169f6a1e49f28cf045004a1a43` |
| Served frontendVersion | `word-b597de926a50cb988c79b8aa166b7ba4da8c986aa2afb94d2509a28b3d3c28cb` |
| Auth/store version, unchanged | `8ec17425-5690-46ed-801a-fe214ebaff3b`, 100% |
| API version, unchanged | `cfb80b7b-78ed-4da3-8a4a-4b9462c9deb0`, 100% |
| Worker uploads / traffic switches | 0 / 0 |
| Completion/provider/Word actions | 0 / 0 / 0 |

[Preflight](preflight.json) confirms the exact authorized archive SHA-256
`35f77a4573e8404cf07d66198a1b70bc4076815ca71a885e284544ec10d8ad4e`, all **56 internal
checksums**, all 57 archive entries including the index, and equality with the
reviewed v2 packet. [Approved-source CI 40208491747](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40208491747)
was reread as completed/success on the exact approved SHA. No build, install or
product change was made during activation. The later documentation-only successor
is distinct; no new full suite or exact-documentation-head CI is claimed. Merge
still requires then-current exact-head CI and owner approval; no merge occurred.

Fresh read-only control-plane metadata matched the expected current-before-apply
baseline: Pages `4bcc267c-62f0-461b-98af-6583436a6bc4` / source `dc3bef4a…`, plus the
same two Worker versions at 100%. Two local listener TCP samples had zero
established connections. These are sampled observations, not an application
admission lock or proof about future requests. The owner was asked to hold new
submissions during delivery; no request was cancelled and Word was untouched.
No Engine, Tunnel, authentication or process control was changed.

[Exact APPLY command and exit 0](execution.json): Pages-only staging upload from
a verified standalone copy, 16:33:51.407–16:34:03.032 UTC on 2026-10-25, using the
existing pinned Wrangler. `--branch main` means only the already existing
Cloudflare staging delivery channel. No GitHub main push or production promotion.
The original packet/archive and earlier recovery packages remain unchanged;
private raw CLI output is retained locally and excluded from this publication.

[All 78 static checks PASS](frontend-static.json) across immutable,
`olc-word-staging.pages.dev` and `word-staging.openlegalcore.org`: all 23 served
files per host and three extensionless taskpane/signin/redirect paths match
reviewed hashes. The 24th local file `_headers` is checked by checksum and served
effects. Exact CSP, no-store on taskpane/signin/redirect, manifest no-cache,
static immutable cache, absence of X-Frame-Options, no-referrer/nosniff/HSTS pass.
The approved manifest and CSP/cache file match the previous baseline exactly.
[Taskpane HTML/asset/fingerprint checks PASS](frontend-fingerprint.json) on all
three hosts. This verifies delivered server bytes; it does not inspect or prove
which frontend the owner's already-open pane has loaded.

[Control-plane before/after](control-plane.json) confirms unchanged Pages
settings/domains/channel, all Word routes, both Worker deployments/versions/100%
traffic, and settings/binding fingerprints. Public MSAL config stays 200/no-store
with identical SHA-256. No Worker upload, secret setting, SSO flow or policy change.
Secret values were not read or exercised: the fingerprints compare API-visible
settings/binding representations, not secret plaintext.

## Owner-supplied attempt metadata correction

[Corrected owner record](owner-attempt.json) for
`bd72b0b0-acc9-442b-b147-8c0641aaa366`, 14:00:35.812–14:00:44.429 UTC, includes
HTTP 200, SSE_ERROR_EVENT and:

```text
frontendVersion: word-e37f072f824c4a8121ed20b628b457249a52fbc0cde0a015b36b8c2fa883eedc
provenance: podal lastnik, brez neodvisnega pregleda zavihka
```

The earlier documentation statement that this reported frontend fingerprint was
missing is corrected in this documentation-only successor. It does not alter the
approved product commit or immutable packet. The supplied value matches the known
fingerprint of the prior dc3bef4 frontend, but is still owner-supplied metadata;
there was no independent inspection of the owner's tab. **Actual request body
and original SSE code remain NOT_ACQUIRED; cause UNDETERMINED.** The temporally
adjacent Engine HTTP row still lacks a joining ID/hash and is not attributed.
There is no new provider/completion call, retry or independent Word test.

## Rollback and acceptance limits

[Rollback evidence](rollback.json): retained deployment
`4bcc267c-62f0-461b-98af-6583436a6bc4` / source
`dc3bef4a8b7adac234bb92720f97a9106179be25` remains successful/available; exact
24-file rollback bytes are preserved in the reviewed packet. **26/26 baseline
static byte/header checks PASS. Rollback not needed or executed.** The reviewed
frontend-only rollback targets that Pages deployment; its fallback redeploys
exact baseline bytes. No store/namespace/credential/user-data rollback.

Actual new Word clipboard/diagnostic UX, model/proposal display/use,
Apply/Undo/Redo, saved-result reopen and other unaccepted retention scenarios
remain **NOT_RUN**. Historical SSO **MANUAL PASS** and the earlier
**FAIL_OWNER_REPORTED / UNDETERMINED** trial are unchanged. Engine pin remains
`eef8ed0794046922842258ce587aab722db5fcb4`; no Engine/Studio/LWS/infra change.

PR #3 remains draft/unmerged on `codex/olc-74-word-adapter-offline`, entry HEAD
`de34ecdbc6d53ce756ecfc2e44b7c7ff6133339f`. Base ref is
`codex/olc-72-word-native-sse`; API base/common ancestor is `69dbe682…`, separate
PR #2 remote tip `c2b8b63…` with byte-identical historical SSO acceptance evidence.
The original user checkout and its two existing documentation edits are preserved.
Only reviewed Markdown/JSON documentation is published; exact successor SHA,
changed paths and remote-byte verification are in the PR publication handoff.
