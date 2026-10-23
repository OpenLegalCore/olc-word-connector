# OLC-72 Word Web access recovery — reviewed plan

Status: IN REVIEW, callback review based on `8fdd6f3`, 2026-10-24. No live
Access, cookie, Worker, tunnel or Engine configuration is changed. The owner-confirmed visual PASS is
preserved. Word for Mac is backlog. Native Word document-write acceptance is
still pending; synthetic tests are not a Word PASS.

## Current read-only discovery

The owner authorized only account application discovery with a mandatory
server-side Word-domain filter. The Cloudflare OpenAPI confirms `domain`
(string) and `exact` (boolean) on `GET /accounts/{account_id}/access/apps`.
The executed request was account `82209a4cf04d77c6ca8cf2f9e6a81a40`,
`domain=word-staging.openlegalcore.org`, `exact=false`, `page=1`, `per_page=100`.
It succeeded with **count=0, total_count=0, total_pages=0**. No unfiltered
account list or client-side filtering was used. No application or policy was
read by guessing an ID.

Eighteen existing sanitized local records plus OLC-72 comments yielded no
frontend application ID. The known Engine-origin ID is a different boundary.
Retained delivery evidence records Access 302 to
`lexai-si.cloudflareaccess.com` on both `/api/session` and `/v1/models`.
That historical HTTP evidence does not establish today's effective policy,
cookie attributes or TTL. A zero result for the requested domain is not proof
that a wildcard, alternate-domain destination or legacy zone application cannot
cover it. The exact frontend app and effective policies remain a prerequisite
for production acceptance. A separately requested equally filtered zone read
can narrow the legacy-zone possibility without an account-wide list.

### Follow-up on 24 October: connection failure and Worker protection

The zone GET has **not run**. Even the read-only MCP spec lookup fails with
`OAuth token refresh failed: Server returned error response: invalid_client:
Client not found`. This is a broken MCP client registration/connection, not a
zone API 403 or an empty zone result. Reauthenticate the same configured
connection using the supported `codex mcp login cloudflare-api` command, without
scope overrides, then perform only the approved zone request with the mandatory
`domain=word-staging.openlegalcore.org`, `exact=false` filter. No token/keyring
extraction, alternate transport, User-Agent change or unfiltered list is used.

Cloudflare documents two distinct targeting models. A hostname/path application
uses a domain; Worker-level Access instead targets a `worker` destination and
covers that Worker's routes and domains. Account-wide protection can use
`all_workers`. Preview-only targets are different again. Therefore an empty
domain-filtered result cannot establish that a Worker is unprotected, nor does
it identify its policy, session or cookie settings. The actual targeting model
of this gateway remains **unverified** until the authorized control-plane read.
See [Workers Access documentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
and [the feature announcement](https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/).

| Frontend fact | Current conclusion |
| --- | --- |
| `/api/*` and `/v1/*` Worker routes | Both retained routes target the gateway; this is routing, not Access-policy proof |
| Browser Access coverage of those paths | Historical 302 on both representative GETs; current effective app/policies unverified |
| Browser application/policy session duration | Unknown; Engine-origin 24h must not be substituted |
| SameSite, Secure, HttpOnly, cookie Path, binding cookie | Frontend settings and actual browser attributes unknown |
| Owner's idle failure root cause | Unresolved; do not conflate expiry, denial, iframe cookies and diagnostic-client 1010 |

## Implemented local recovery candidate

Production composition now uses `OfficeSignInDialog`, not `window.open`.
Its same-origin public `signin.html` bootstrap opens as a top-level Office
dialog (`displayInIframe=false`), then navigates to the existing `/api/session`
landing. A random 128-bit correlation nonce travels only through the Office
parent/child messaging channel, never the URL, a credential or document text.
The repository Worker example's landing replies to that challenge; its script has an exact CSP
hash, no unsafe-inline, and retains `frame-ancestors 'none'`. The API/Engine
protection and task-pane hosting CSP are not loosened.

Only exact same-origin, closed-shape, nonce-matching dialog messages are
accepted. Duplicate opens, close, failure, a five-minute deadline, disposal and
late-created dialogs are bounded/cleaned up. The return message means only
**landing reached**, not authenticated identity or usable pane cookies. It
never submits a message or automatically checks the connection.

The 8fdd6f3 review reproduced a lost callback in both parent-first and child-first
readiness when the URL fragment is absent: both regressions fail on the old
source. The parent now registers its listeners before challenging the child;
an exact-origin challenge is repeated every 500 ms within the existing five-minute
deadline, until the landing registers and acknowledges it. This retries only
native messages, never navigation, HTTP, login or a completion. The child rejects
wrong/missing origins, malformed shapes and nonces; it does not rely on fragment
preservation. Close/disposal/deadline clears the challenge timer. Runtime checks
require DialogApi 1.2 and DialogOrigin 1.1, with no popup/storage fallback.
The fixed bootstrap ignores arbitrary query/fragment return inputs. This is
synthetic protocol evidence, not a Word Web PASS.

On startup and explicit **Check connection**, the actual pane separately GETs
`/api/session` then `/v1/models`, with same-origin credentials, no-store and
manual redirects. The landing must be HTTP 200 HTML with the existing gateway
marker; its body is canceled without reading/logging it. A marked public
landing is still not identity proof: effective Access policies must be checked.
The model preflight still requires the exact model. A rejected landing stops
before model discovery; neither request is a completion. The landing read has
a 15-second timeout and suppresses even transport responses arriving after abort.

If the dialog landing was reached but the pane still sees a login challenge,
the pane exposes **Allow app cookies in this pane / Dovoli piškotke aplikacije
v podoknu**. Only that explicit user gesture invokes
`document.requestStorageAccess()` without options; it does not request other
storage types, read cookie values or persist application data. A subsequent
`hasStorageAccess()` must confirm the permission. A grant still requires an
explicit connection check; there is no automatic request/replay.

This is a real cookie-boundary mechanism, not a claim that Office Dialog fixes
third-party cookies. Word's iframe sandbox/Permissions Policy, browser support,
first-party login interaction and actual cookie attributes may prevent it.
Unsupported API, denial or a missing grant gives an actionable failure while
retaining the draft. Production qualification must verify the actual host
permits `allow-storage-access-by-user-activation`, scripts and same-origin
access where sandboxed. No parent-frame policy or browser setting is changed
by this code. A narrow managed app/team-domain exception remains the documented
fallback; a third-party-cookie-independent application session is still a
separate architecture decision, not implemented here.

The multiline draft, locale and removed-selection choice survive dialog,
failed checks and granted/denied/unsupported cookie requests. Late events and
pending callbacks after disposal cannot check or submit. Ready form layout,
CSS, logo, selection/Send/Stop and Engine SSE/document behavior are unchanged.
There are no browser Engine keys, service tokens, stored conversation or new
authentication credentials.

### Delivery boundary and actual Word checks still required

This local candidate changes the Worker **example** landing as well as adding
the frontend bootstrap. It is not the prior frontend-only 8d96dbf artifact and
must not reuse that packet's checksums or no-Worker-change activation recipe.
A future separately approved delivery must prepare/verify the backward-compatible
landing callback Worker first, then its matching Pages artifact; preserve the
current Pages/Worker rollback pair. Old frontends with no nonce keep the manual
landing flow. If only the frontend changes against the old landing, the dialog
cannot signal nonce completion; it must not be called successful. No live
deployment or settings change is performed here.

Still NOT_RUN: actual Word Web parent/child messaging through Access and host API
support; idle/expiry and denied-policy cases; Storage Access grant,
denial and Word sandbox behavior; real cookie send/blocked reasons on both API
prefixes; preservation of a real draft and selected-text attachment throughout.
Use provider-free GET checks only. No synthetic result is a Word PASS.

### Callback review qualification — 24 October

The full local Contributing gates exit 0 on the reviewed source: **564 tests
passed / 1 protected live skipped**, 33 passing files; audit 0 vulnerabilities,
typecheck, lint, formatting, four manifest validations, five builds and production
isolation. The CI formatting gate now includes the new bootstrap HTML and the
shipped Worker JavaScript. Two lost-callback/readiness regressions first fail
against 8fdd6f3, then pass against this matched frontend/Worker callback.
No provider or identity request is needed for these protocol tests.

The coordinated package must contain this head's Pages build and exact Worker
source together, while preserving the retained production manifest and hosting
CSP. Its primary rollback is last observed Pages
`5e4e601b-364d-41d9-afe3-14819d09733b` / 390590d and Worker version
`d6ef17bc-bd07-4cd9-a219-d36bfcda1738`. These pins require a fresh read before
activation; the broken MCP connection prevents that attestation today. The
package is prepared offline, not authorization to deploy or evidence of a new
Worker version/deployment. The old JSON Worker is not a compatible rollback.

Future activation is Worker-first, Pages-second; rollback is old Pages first,
then old Worker. Inherit existing bindings only after checking the active and
latest-uploaded versions match, and use the upload API's strict inheritance
mode; its legacy script-version endpoint defaults to latest, not deployed.
Never replace active secrets or assume a supplied version ID is accepted by
that endpoint. See the [official version-upload semantics](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/).
The packet records exact head/tree, final CI, checksums, both rollback pins,
the required fresh preflight and the remaining Access/Word/Engine gates.

### Historical local qualification — 8fdd6f3

Node 24.21.0, base `8d96dbfd86909f65c6b072e428937dc1d885a11c`, same dedicated
`codex/olc-72-word-native-sse` branch. The full local Contributing command set
passed: deterministic tests, typecheck, lint, exact CI formatting command,
production audit (0 vulnerabilities), four official manifest validations,
five builds and production bundle isolation. After distinguishing a closed or
disconnected dialog from a successful landing, final full regression is
**559 PASS / 1 protected live SKIP**, 32 passing files; typecheck, lint,
production build/isolation and affected formatting also passed. The new
bootstrap HTML was explicitly formatted/checked in addition to the existing
CI pattern. There was no new dependency installation or remote CI run; the
earlier CI success on 8d96dbf must not be claimed for this local successor.

Tests cover same-origin/nonce/shape checks, duplicate dialog opens, close/error,
deadline and late creation, dual-prefix read gating, canceled/late HTTP bodies,
grant/denial/unsupported cookie APIs, and retained multiline draft/locale/removed
selection with no automatic completion or Word write. Gateway tests execute the
actual fixed landing script in isolation and verify its exact CSP hash; they do
not contact identity or Engine. Accepted task-pane HTML/CSS, manifests, hosting
CSP, icons, Engine transport, Word operations and dependency files are unchanged.
`git diff --check` and changed local Markdown file links passed. Exact commands,
exit codes, final Git identities and the sanitized API result are retained in
the local handoff. The original user's checkout and both edits are preserved.

## Historical findings — baseline 8d96dbf

The current runtime opens `/api/session` with `window.open`, then requires the
user to return and select **Check connection**. That check only reads
`/v1/models`; it does not submit the retained message. It can succeed only when
the protected request is accepted in the actual task-pane browsing context.
A successful login in another tab does not establish that condition.

The previous client classified every same-origin `403` as expired session.
This was a proven diagnostic defect, corrected in this candidate. Non-HTML
`403` is now access denial. Redirects, HTML and `401` still fail closed with
the legacy `SESSION_EXPIRED` code, but the UI says **Access required / Potreben
je dostop**, not a claim that expiry has been established. Neither branch
accepts the body as an answer. The form's layout, assets, copper border and
focus, automatic removable selection and Send behavior are unchanged.

Deterministic runtime regression covers a multiline draft and explicitly
removed selection across failed and successful manual connection checks. The
draft and removal survive, no second completion is sent, and Word has no write.
The existing cancellation, late-response, frozen selection/language and
one-attempt document-action guards continue to apply. This is code evidence,
not an observation of the owner's browser cookies.

Fresh read-only control-plane evidence:

- Pages production remains `5e4e601b-364d-41d9-afe3-14819d09733b`, commit
  `390590db71742b2682fe80cb57a0484f40ca76e6`. DNS is the proxied CNAME to
  `olc-word-staging.pages.dev`; both `/api/*` and `/v1/*` route to the gateway.
- Gateway deployment `75852f7a-9f1a-4db1-9bde-6ea027cfcd7b` uses version
  `d6ef17bc-bd07-4cd9-a219-d36bfcda1738` at 100%. Its credentials stay
  server-only. This review read binding names, never secret values.
- The Engine-origin Access application
  `1b874995-dac6-4da6-86f3-0c0d80f1794d` has a 24-hour application session and
  HttpOnly enabled. Its service-auth policy
  `9af1cc91-b18c-4805-8018-bd20ed791c65` includes the dedicated Word token as
  well as the retained older token. That is the Worker-to-Engine boundary;
  its session duration is not the browser Word login duration.
- The zone-scoped application list contains the Engine and historical OWUI
  origins, not a frontend application record. Account-level frontend discovery,
  including the official server-side Word-domain filter, was rejected by the
  automatic approval review because account listing could expose unrelated
  private metadata. Consequently the frontend app ID, effective policies,
  session duration and cookie attributes remain unverified. An exact frontend
  app ID permits a narrower direct read; owner approval for the filtered read
  is the alternative. No alternate transport or User-Agent workaround is used.
- Today's anonymous diagnostic client received HTTP 403 with Cloudflare
  `error code: 1010` even on static `/taskpane`, and likewise on `/api/session`
  and `/v1/models`. The static response had `X-Frame-Options: SAMEORIGIN` and
  no application CSP. This is a Cloudflare client-signature rejection, not
  proof about the owner's Word iframe or the Engine bearer. Error-page headers
  must not be mistaken for the deployed task-pane headers.

The owner's recurring failure after idle therefore has **no established single
root cause yet**. Expiry, denied policy and iframe cookie blocking must remain
separate hypotheses. Neither the 24-hour Engine application nor one `403`
justifies extending sessions, changing policies or rotating credentials.

## Minimal production implementation sequence

1. Read the exact frontend Access app and policies; record host/path coverage,
   effective policy/application session duration, SameSite, Secure, HttpOnly,
   path and any binding-cookie setting. Do not record cookie/token values.
   Correlate the actual Word request's status, redirect destination origin/path,
   Cloudflare Ray ID and browser blocked-cookie reason after idle. No completion
   is needed: use `/api/session` and `/v1/models`. Verify both route prefixes;
   a cookie scoped only to one cannot authorize the other.
2. Replace only the runtime sign-in launcher with Office Dialog API
   `displayDialogAsync`, starting on a same-origin static page. Keep its default
   top-level dialog behavior; do not request an iframe for identity pages.
   Use a fixed allowed return page, origin-checked `messageParent` handshake,
   per-attempt nonce, close/cancel/error handling and one dialog at a time.
   Never put an Engine bearer, Access service secret or document text in the
   dialog, URL or storage. A dialog success message only allows a subsequent
   explicit model-discovery check; it never submits the draft.
3. Preserve the existing in-memory draft, locale and selection-removal choice
   through recovery. Dispose stale operations, ignore their late events and
   revalidate the displayed selection before the user's next Send. Show an
   actionable denial separately from a recoverable login challenge. No history,
   automatic retry or document write is introduced.
4. Qualify the cookie boundary in the actual Word Web host. Office Dialog alone
   does **not** fix blocked third-party cookies or storage partitioning. For a
   managed browser deployment, document narrow, approved exceptions for the app
   and Access team domains, together with their supported browser policies;
   do not recommend disabling privacy protection globally. If the product must
   work while those cookies are blocked, a separate application-session design
   and owner approval are required before implementation (below).
5. Acceptance matrix: normal and expired login, denied user, blocked popup,
   canceled dialog, third-party cookies allowed and blocked, reload after idle,
   multiline draft, removed/changed selection, locale change and cancellation
   during a request. Prove no automatic completion/replay and no Word write.
   Record real browser/Word build and actual network evidence. Until these
   checks pass, production login remains blocked.

The local follow-up above implements the bounded launcher, landing callback,
dual-prefix checks and explicit cookie-permission branch of this plan. It still
requires a separately reviewed staging delivery and real Word qualification.
Changing the application session duration alone is not this plan.

### If third-party-cookie-independent access is required

The minimum alternative is a separately approved Word application session:
server-verified Access identity, a nonce/PKCE-bound single-use authorization
code delivered to the Office dialog, exchanged for a short-lived Word-scoped
capability retained only in task-pane memory. Validate issuer/audience/expiry
and signature of the Access assertion server-side; never trust an unverified
browser claim. Require origin/nonce/replay checks and revocation/expiry behavior.
No Engine or Access service credential enters the browser.

This also needs an explicit narrow Access/routing design for the Word API entry
so cookie rejection does not occur before gateway application authentication.
Adding an Authorization header cannot bypass the existing Access edge. There
must be no unauthenticated completion route and no broad bypass rule. It is
additional auth architecture, not permission granted by this review. The
managed-browser option above is the smaller deployment scope when acceptable.

## Primary references

- [Microsoft: authenticate with Office Dialog API](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/auth-with-office-dialog-api)
- [Microsoft: Office Dialog API, including why window.open is unsuitable for authentication](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/dialog-api-in-office-add-ins)
- [Cloudflare: Access cookies, durations and third-party cookie behavior](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)
- [Cloudflare: validate the Access JWT at the origin](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare: error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/)
- [Storage Access API specification: cookie permission and sandbox constraints](https://privacycg.github.io/storage-access/)
