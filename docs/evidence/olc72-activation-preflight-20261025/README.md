# OLC-72 activation preflight — 2026-10-25

**End-to-end outcome NOT COMPLETE. No Microsoft activation or actual Word acceptance.**
The owner authorized scoped registration setup and coordinated staging activation
with rollback after the required gates. The concurrent-401 correction on
`30e6b7b94767e1f0eb713e83b8fdffba7c47a93c` is the reviewed source baseline;
[its CI / validate is successful](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40151308910).
No further production source change was justified by this inspection.

## Fresh evidence

[checks.json](checks.json) records the actual observations and active version IDs:

- Pages remains deployment `e133e092-9679-4734-9ad6-9ae1ae71394d`, source `aa5d369`.
- All three current Worker version IDs match the retained activation record.
  Session Worker variables match retained private operator configuration; only
  comparison booleans are published, not private values or owner identities.
- **45/45 HTTP file comparisons match** the retained aa5 bytes across custom,
  canonical Pages and immutable deployment hosts. HTML has no X-Frame-Options.
  Initial requests using Python's default user agent received Cloudflare 1010;
  the standard browser user agent succeeded. No security setting was changed.
- Anonymous `GET /word-api/session` and `/word-api/v1/models` return **401**.
  `/word-api/auth/config` returns **404**, consistent with the old delivery.
- All **48 retained package artifacts** match their recorded hashes. A separate
  candidate/rollback package was rebuilt from `30e6b7b`, with the new
  `taskpane.f0c0f90aebbb54b836d8.js`. `npm run build:stage` and
  `npm run build:word-session` both exited 0. The approved actual-host manifest,
  CSS/icons and aa5 rollback are byte-identical to the retained copies.
- Current MSAL/NAA composition, API signature/issuer/audience/client/scope checks,
  immutable owner allowlist and unchanged Worker-to-Engine boundary were read.
  Reading code and building artifacts do not prove actual host authentication.

The new protected local package is `olc72-staging-30e6b7b-20261025`, with a Git
recovery bundle and artifact hashes. The earlier e8 package, original checkout's
two documentation edits, all other checkouts and recovery packages are retained.
No infrastructure, live authentication, provider completion or Word write was
performed. Engine/Tunnel/cloudflared/DNS topology was not changed.

## Concrete external dependency

The visible Entra portal initially reached Microsoft's sign-in page. Following
an interruption, the connected in-app tab became inaccessible: navigation and
focus commands timed out, and the Codex panel request returned `queued`. The
owner confirmed that the panel would not open. Repeated hidden-tab/login
troubleshooting was stopped.

The owner then confirmed **Portal and App registrations are accessible** in their
normal browser. This is owner-reported portal access, not tool-verified app
inventory, consent or write privileges. The immediate next step is a read-only
lookup in **App registrations → All applications** for existing OpenLegalCore /
OLC Word staging SPA/API registrations. No new integration or new Cloudflare
login is required by that lookup. No registration ID, directory right or owner
principal is invented.

Registration configuration, verified owner `tid:oid`, actual Microsoft API token,
coordinated activation and Word startup/reopen/idle recovery remain outstanding.
If Word automation remains unavailable after delivery, use one manual acceptance
on the delivered build, recording startup, reopen, >15-minute capability renewal,
draft/language and attached/removed selection retention; no Send or document write.
The existing [registration contract](../../MICROSOFT_SSO.md) and
[activation/rollback sequence](../../MICROSOFT_SSO_STAGING.md) continue to apply.
