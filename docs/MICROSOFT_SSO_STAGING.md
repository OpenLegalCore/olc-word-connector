# Microsoft SSO staging and rollback

**Corrected API activated; final canonical-URL cache-header check in progress.**
The owner's actual Microsoft API token is cryptographically verified. The first
attempt was rolled back after 503; corrected API issuance/session/models/revoke
now pass. Pages canonicalizes `.html` to extensionless URLs, so no-store rules
cover both spellings. Actual Word acceptance remains pending.
See [runtime regression and rollback evidence](evidence/olc72-worker-runtime-20261025/README.md). The working delivered
baseline is `aa5d369f3e99067e8059a50fdd99f22535ca9810`, not the older pre-session
frontend. Its Pages bytes, both session Workers, SQLite namespace, original
private credentials, protected legacy gateway/routes and prior recovery bundles
remain retained. The new candidate is on the existing draft PR #2.

## Activation gates

1. Inspect/reuse or prepare the **two** registrations and consent configuration
   in [Microsoft SSO](MICROSOFT_SSO.md#registration-discovery-and-exact-missing-configuration).
   Verify personal and organizational account support, three exact staging SPA
   redirects, delegated `Word.Access`, API v2 audience and exact allowed SPA.
   Configure only the explicitly approved, verified owner `tid:oid`.
2. Require successful **CI / validate on the exact candidate PR head**, review
   the final diff and independently inspect its staged artifacts. No older CI
   or synthetic test is a real Word acceptance.
3. Freshly compare the current active Pages/Worker versions and existing bindings
   with the retained baseline. Stop on unexplained drift. This preparation did
   not reread or change live resources. Keep baseline Pages, both session Worker
   versions/configurations and the existing legacy gateway recoverable. The
   previous pre-aa5 rollback is a separate older recovery layer.
4. Preserve the approved real-host manifest bytes, GUID/version/permissions and
   accepted CSS/icons. The repository's `example.invalid` template is not the
   deployable manifest. New auth HTML and MSAL/JWKS configuration do require the
   reviewed package's CSP and no-store headers. Serve Microsoft auth assets from
   the same origin with no COOP/X-Frame-Options. Only Microsoft's exact auth
   origins are added to connect/frame policies; no Engine/private origin is added.
5. Fill **only** the four Microsoft variables from actual registration/verified
   owner evidence. `MICROSOFT_AUTH_ENABLED=false` is the inert source default;
   the new pane requires a correctly configured Microsoft boundary before use.
   Preserve `PUBLIC_ORIGIN`, private Engine origin, Word store binding and all
   original server-side Engine/service credentials. No new secret is needed.

## Coordinated candidate activation, after review

Deploy the updated existing auth Worker/store code first, preserving all its
bindings, policy, destinations and routes. Its store adds a Microsoft issuance
operation; legacy records/operations remain compatible for rollback. Deploy the
updated API Worker with the verified Microsoft variables and explicit owner
allowlist. The existing `/word-api/*` route handles new configuration and
Microsoft capability issuance. No new public Worker route, human Access
destination, Tunnel, DNS record, Engine service or inbound network listener is
needed. Keep workers.dev/previews/logging disabled as before.

Before publishing the new Pages candidate, check that an absent/invalid token
is rejected, the public configuration contains only the intended SPA/scope,
Graph/ID-token/wrong issuer/scope/client/signature are rejected, and a verified
owner API token obtains a short capability. Use only session/model discovery
GETs, verify revocation and unauthorized-account denial, never a completion.
Then publish the exact reviewed new Pages bytes and approved manifest. This is a
coordinated maintenance transition: while Microsoft-only API mode is active,
the old pane's Cloudflare code exchange is intentionally disabled. Complete the
Pages switch promptly or restore the baseline; do not add a mixed automatic
Cloudflare fallback to hide a failed transition.

In actual Word, first check the runtime `NestedAppAuth` requirement result and
document source. Check startup → Connecting → usable form without Cloudflare,
new-pane silent reacquisition, idle/capability renewal and simultaneous access.
Where Microsoft requires interaction, use one explicit Microsoft action; also
check consent, cancellation, and the Office-dialog fallback on a genuinely
unsupported host. Use a synthetic multiline draft, SL/EN and both retained and
removed attachment choices. Recovery must preserve those in the same pane and
must not submit a message or write Word. A destroyed pane still has no persistent
draft. Record actual outcomes separately from synthetic results. No completion
is necessary for these access checks.

## Rollback to the working aa5 delivery

On candidate authentication/API failure, restore the retained **aa5 Pages bytes**
and approved manifest first, then restore the saved API Worker version and its
previous configuration/flags, followed by the previous auth Worker/store version.
Verify the original Cloudflare capability exchange and safe session/models GETs
work again. These steps are coordinated: the old pane cannot sign in while the
API remains Microsoft-only. Existing API/legacy routes and protections remain
present throughout. Do not disable protection, expose Engine, rotate credentials
or forward browser tokens to Engine as a workaround.

Do not delete the SQLite namespace, migration history, prior Worker versions,
Pages artifacts or any recovery package. Capabilities expire within 15 minutes;
rolling back application authentication does not revoke a user's Microsoft
account or change their Word login. Microsoft registrations may remain inert.
No Tunnel/cloudflared/DNS/local Engine change or port forwarding is part of
activation or rollback.

The protected prepared package contains candidate Pages/Worker outputs, the
approved manifest, an aa5 rollback copy, artifact-only checksums and references
to retained private operator configuration. It contains no Microsoft client
secret, access token, provider credential export or invented registration ID.
Missing registrations/owner authorization are explicit activation blockers,
not deferred implementation work.
