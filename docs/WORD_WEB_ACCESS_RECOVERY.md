# OLC-72 Word Web access recovery — reviewed plan

Status: IN REVIEW, 2026-10-23. No Access, cookie, Worker, tunnel or Engine
configuration is changed by this review. The owner-confirmed visual PASS is
preserved. Word for Mac is backlog. Native Word document-write acceptance is
still pending; synthetic tests are not a Word PASS.

## Findings and evidence boundaries

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

Implementation would affect the sign-in dependency in
`ProductionTaskPaneRuntime`, its production Office composition, a minimal
same-origin dialog start/return page and associated tests/docs. It requires a
separately reviewed staging delivery; none is implemented or deployed here.
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
