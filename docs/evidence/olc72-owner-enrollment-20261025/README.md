# OLC-72 owner enrollment — 2026-10-25

Base/head before this unit: `963a1f201cdcab09c49ec28142e7f95ad0f037f3`,
tree `91ddf0afd0ae31792cc98405cabee2def1acf4c7`; PR #2 branch
`codex/olc-72-word-native-sse`. Production auth/client code remains the independently
reviewed `30e6b7b` implementation, including concurrent-401 renewal.

The owner supplied the actual dedicated SPA/API IDs and screenshot-based
configuration evidence. This supersedes the previous unknown-registration state;
no registration was recreated. API account-type confirmation and verified owner
identity are still pending. Application and directory object IDs are not a
substitute. Other projects/apps and live Worker auth remain unchanged.

The missing acquisition handoff is implemented as an **operator-only** explicit
MSAL popup page, using the already registered staging redirect, and a loopback
receiver. No task-pane entry, production bundle, dependency lock or manifest was
modified. It uses pinned MSAL, memory-only cache and the existing cryptographic
API-token verifier. A bounded, nonce/Host/Origin-checked local POST stores only
verified identity/app IDs in a new private file; it grants no capability. The
optional operator `probe` command has only fixed session/models/revoke routes.
No completion route, document write or token output is present.

## Checks actually run

- All 18 project commands in [checks.json](checks.json) exited 0: locked install,
  zero-vulnerability production audit, full tests, strict TypeScript, lint,
  formatting, four manifest validations, five frontend builds, Worker build,
  production isolation and diff check.
- Full suite: **642 passed / 1 protected-live test skipped**, 40 passing files.
- New tests cover one-time/private result, no token persistence in identity
  output, Origin/nonce/Host denial, cross-site start denial, bounded body and
  exact preflight, signature-verifier failure propagation, exclusive output,
  concurrent receipt rejection, safe-route-only probing and revocation.
- First sandbox run could not bind loopback (`EPERM`); the authorized unsandboxed
  run exposed a test-client issue (Node fetch ignores an overridden Host).
  The Host test was corrected to use Node HTTP, then all tests passed. These are
  local synthetic transport checks, not actual Microsoft or Word evidence.
- Separate overlay build succeeded; all 15 baseline served assets are byte-identical.
  `_headers` retains the baseline prefix and adds only helper rules. Added files:
  `owner-enrollment.html`, `owner-enrollment.js`, `owner-redirect.js`,
  `microsoft-redirect.html`, `MSAL-LICENSE.txt`. Rules cover extensionless Pages
  canonical URLs too. The exact approved real-host manifest/CSS/icons are retained.
- Current Pages read still identifies delivery `e133e092-9679-4734-9ad6-9ae1ae71394d`
  sourced from `aa5d369`. The complete aa5 package and earlier rollback layers are
  retained; recovery branch `recovery/olc72-before-owner-enrollment-20261025` keeps
  this unit's starting reference.

## Execution gates still open at commit

Overlay delivery and real Microsoft owner verification: **NOT_RUN**.
Microsoft-only API activation and actual Word acceptance: **NOT_RUN**.
Exact-new-head CI must succeed before overlay publication. No live allowlist,
Worker, Tunnel, cloudflared, DNS, Engine or Word change has occurred in this unit.

The Cloudflare connector's asset check returned HTTP 403 (endpoint authorization),
so asset publication will use the already authorized Wrangler installation/session;
no new Cloudflare login is requested. Runtime results will be recorded separately,
not inferred from the successful local suite.
