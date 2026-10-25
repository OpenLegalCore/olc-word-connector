# Microsoft identity for Word — OLC-72

**IN REVIEW — independent code implemented, NOT ACTIVATED.** The primary goal is
to remove repeated **Cloudflare user sign-ins** and access interruptions after
idle time or reopening the pane. Microsoft authentication replaces the user
authentication boundary only. The existing outbound Cloudflare Tunnel,
cloudflared on Medo, DNS, private Engine route and Worker-to-Engine service
credentials stay unchanged. No inbound connection or port forwarding is needed.

The owner reported the delivered `aa5d369` flow showing **OLC Engine connected**
and a usable form after manual login. This is accepted owner evidence for that
flow. It does not prove that the new Microsoft candidate works in actual Word.
No new browser, sign-in, provider completion or Word write was used to qualify it.

## Runtime and trust boundary

After Office readiness, the pane checks `NestedAppAuth` **1.1** at runtime.
With support it creates MSAL's nestable public client. It requests only
`api://<API_APPLICATION_ID>/Word.Access`, first through `acquireTokenSilent`.
When no account is cached, `ssoSilent` uses the Office auth context login hint.
The hint helps account selection; it never authorizes API access. The authority
is fixed to `https://login.microsoftonline.com/common`, supporting personal
Microsoft and organizational work/school accounts.

MSAL's cache is **memoryStorage**, with no application token/draft persistence
and no token or identity logging. NAA can reacquire access from Word's existing
Microsoft session in a new pane. A new pane still loses its transient draft and
selection; this change does not implement persistent drafts or sign out Word.

The supported fallback for a host without NAA is a same-origin **Office dialog**
running standard MSAL with its own memory cache and explicit Microsoft popup.
Its popup and redirect bridge share a first-party partition, avoiding the
cross-site iframe BroadcastChannel mismatch in MSAL 5. A Continue button inside
that dialog preserves the popup's user gesture. A short-lived API access token
returns only over an exact-origin, random-state-bound Office message. No ID token
or refresh token crosses this application channel. The dedicated same-origin
redirect page uses Microsoft's bundled redirect bridge, no application bootstrap,
analytics, external script or API call. Auth return to `taskpane.html` also runs
only the bridge. Auth HTML has no-store/no-referrer and no COOP header.

No popup is opened by startup, a timer, a network error or token expiry alone.
Only an interaction-required result exposes the main **Sign in with Microsoft**
action. Network/configuration/timeouts remain separate errors. Browser or tenant
restrictions can still require Microsoft interaction, especially on unsupported
hosts; silent success is not promised when Microsoft requires consent/MFA/login.
Manual connection checking is in Settings; the duplicate access-check action is
removed from the sign-in screen. Internal error codes stay out of the main view.

Before required API access, silent acquisition runs again. Concurrent acquisition
and capability renewal share one promise; silent waits are bounded to 30 seconds,
interactive waits to five minutes. A Microsoft token is exchanged at
`POST /word-api/session/microsoft` for the existing memory-only capability, capped
at 15 minutes and the Microsoft token expiry. Expiry or a newly renewed Microsoft
token obtains a fresh capability silently. A rejected discovery GET can renew and
retry **once**; a completion body is never replayed. Before Send hands a selection
to the controller, auth preflight preserves the displayed attachment if login is
required. Explicit interactive recovery returns only to the form and safe GETs;
it never resumes or resends the question or writes Word. Draft, locale and removed
attachment state survive recovery in the same pane.

The API verifies a **v2 delegated access token for our distinct API registration**:

- fixed HTTPS Microsoft common discovery and the exact advertised common JWKS;
- RS256 signature through `jose`, `kid`, and the signing key's issuer scope;
- exact `iss` bound to GUID `tid`, API GUID `aud`, time claims and token version;
- exact authorized SPA `azp`, nonempty `sub`, immutable GUID `oid`, and delegated
  `scp` containing `Word.Access` (application roles alone are insufficient);
- explicit configured staging allowlist of `tid:oid`, never email or display name.

Graph audience, client-audience ID tokens, wrong issuer/key/scope/client, expired
tokens and other valid Microsoft accounts fail closed. Discovery/key cache is
bounded, coalesced, refreshed on rollover with a cooldown and fails closed on
unavailability. There is no token-directed metadata URL. The public
`GET /word-api/auth/config` exposes only the configured SPA ID and API scope.

Capabilities retain the verified principal/client/audience in the private
transactional store. Every protected API access, and completion admission again
immediately before upstream start, checks current staging authorization.
Removing an owner blocks even an otherwise-valid capability. Revoking a capability
blocks that token, but an authorized Microsoft identity can acquire a replacement.
Disabling a principal in the application allowlist is the immediate application
access-revocation mechanism. Offline JWT validation cannot promise instantaneous
Microsoft-wide revocation of already-issued access tokens; Microsoft lifetime,
MSAL renewal and conditional-access policies still apply. No CAE claim is made.

The existing API forwarding code constructs a fresh request: neither Microsoft
tokens, capability, cookies nor identity reaches Engine. Engine/service secrets
remain server-side. The legacy Cloudflare user-code exchange is disabled when
`MICROSOFT_AUTH_ENABLED=true`; there is no Cloudflare user-login fallback. Its
existing protected Worker/routes remain recoverable for rollback.

## Registration discovery and exact missing configuration

The current PR configuration, source, manifests, package/build configuration and
tracked documentation contain **no configured Microsoft client/API registration**.
The environment has no Entra management connector or Azure CLI session available
to verify registrations in the owner's directory. This is not a claim that none
exists externally. No tenant/client IDs, directory membership or owner object IDs
were invented, and no live Entra app, permission or auth setting was changed.

The operator must supply or prepare **two distinct app registrations** (reuse
existing matching registrations after inspection):

| Setting | SPA registration | API registration |
| --- | --- | --- |
| Supported account types | `AzureADandPersonalMicrosoftAccount` | `AzureADandPersonalMicrosoftAccount` |
| Authority | Microsoft `common` | v2 access tokens |
| Client secret | None | None needed for local signature validation |
| Application ID URI | Not used as API | `api://<API_APPLICATION_ID>` |
| Access-token version | Not an API | `api.requestedAccessTokenVersion: 2` |
| API permission | Delegated `Word.Access` on this API | Expose enabled delegated `Word.Access`, consent type `User` |
| Allowed clients | This SPA only | Preauthorize `<SPA_CLIENT_ID>` for that scope; server also checks exact `azp` |
| Implicit grant / public-client password flow | Disabled | Disabled |

For the approved existing staging hostname, configure these **SPA redirect URIs**:

```text
brk-multihub://word-staging.openlegalcore.org
https://word-staging.openlegalcore.org/taskpane.html
https://word-staging.openlegalcore.org/microsoft-redirect.html
```

The first URI contains origin only, no subpath. The second is the Word Web NAA
return page; the third is the standard MSAL popup/iframe fallback return page.
`microsoft-signin.html` is the Office dialog bootstrap, not a redirect URI.
Do not add production domains, wildcard redirects, Graph permissions, API client
secrets or broad Office client allowlists for this staging task. Tenant consent
policy can require administrator approval even when the scope permits user consent.

Required deployment values:

```text
MICROSOFT_AUTH_ENABLED=true
MICROSOFT_CLIENT_ID=<actual SPA application/client GUID>
MICROSOFT_API_AUDIENCE=<different actual API application/client GUID>
MICROSOFT_ALLOWED_IDENTITIES=["<verified tenant GUID>:<verified owner object GUID>"]
```

Also retain the actual delegated permission's generated scope GUID in the Entra
registration record for SPA `requiredResourceAccess` and API
`preAuthorizedApplications`. Neither registration configuration nor consent alone
grants paid Engine use: the nonempty server-side owner allowlist is mandatory.
For personal accounts, Microsoft uses consumer tenant
`9188040d-6c67-4c5b-b112-36a304b66dad`; obtain the owner's actual API-token `oid`,
not an email address or a guessed directory object.

If directory tooling cannot provide that verified pair, the operator-only tool
can verify a freshly acquired **our-API** token supplied through protected stdin:

```text
node scripts/verify-microsoft-owner.js <SPA_CLIENT_ID> <API_APPLICATION_ID> <new-private-output-file>
```

Do not place the token in shell arguments, an environment variable, command
history or this repository. The tool checks the same signature/issuer/audience/
scope/client requirements, writes only the verified principal and app IDs to a
new mode-0600 file, and grants no capability or Engine access. The proposed
principal derived from the input is used only inside that local verification;
the operator must explicitly configure the approved owner afterward. No token
or owner identity belongs in published evidence. This tool has not been run
against a real Microsoft account in this change.

## Host support and evidence limits

Microsoft documents NAA as GA for Word Web, Windows and Mac and for Word on iPad.
Word Web NAA requires a document opened from SharePoint Online or OneDrive.
Runtime support is checked, not inferred from `word.cloud.microsoft` or a welcome
page. This continuation did not inspect a host or claim a new actual Word PASS.
The fallback is implemented; its actual host/popup behavior still needs acceptance.

Activation requires the registrations, explicit owner principal, exact-head CI,
reviewed artifacts and the sequence in [Microsoft staging/rollback](MICROSOFT_SSO_STAGING.md).
See [candidate evidence](evidence/olc72-microsoft-sso-20261024/README.md).

## Primary references

- [Microsoft NAA setup and Office auth context](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/enable-nested-app-authentication-in-your-add-in)
- [NAA host/account requirements](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/common/nested-app-auth-requirement-sets)
- [Office dialog authentication](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/auth-with-office-dialog-api)
- [Microsoft API token and signing-key issuer validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Microsoft token claims](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference)
- [Pinned MSAL redirect-bridge design](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/16a4714f38ba2844f34d154dd59dd8f1402457c9/lib/msal-browser/docs/redirect-bridge.md)
