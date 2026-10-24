# OLC-72 cookie-independent Word session

Status: **IN REVIEW — implemented locally; activation and actual Word acceptance pending**.
The owner approved this architecture after the evidence-only checkpoint
`d419b477c527f5437e5a32429c7b7f19319f0a20`. The cause of the owner's individual
Access required incident remains **unproven**. Removing the iframe-cookie
prerequisite is an architectural change, not a claim that the incident is fixed.

## Boundaries and protocol

The accepted SL/EN ready form, selection attachment, document writer, Engine
profile, strict stop → DONE SSE handling and actual usage/null are unchanged.
There are three distinct credentials, never interchangeable:

- human Cloudflare Access JWT: top-level authorization Worker only;
- opaque Word-scoped capability: pane memory and dedicated API boundary only;
- Engine bearer and Access service-token pair: trusted API Worker bindings only.

1. An explicit sign-in click opens the fixed same-origin `/signin.html` through
   Office Dialog (`displayInIframe:false`, `promptBeforeOpen:true`). A fresh
   256-bit PKCE verifier and correlation state are generated in the pane.
   The dialog opens synchronously from the gesture; S256 computation completes
   while the bootstrap loads. Verifier remains in pane memory.
2. Exact-origin Office messaging passes **only challenge/state** to the bootstrap.
   It accepts a closed message shape, navigates once to the fixed
   `/word-auth/authorize?challenge=…&state=…`, and accepts no caller-supplied return
   URL. The parent bounds the attempt to five minutes and ignores late messages.
3. The separate authorization Worker is a destination of the **existing human
   Access application/policy**. Additionally, `jose@6.2.13` verifies the assertion
   against the fixed issuer's HTTPS `/cdn-cgi/access/certs`: RS256 only, exact
   configured issuer and allowed audience, required `exp/iat/sub/type`, valid
   times, nonempty subject and `type=app`. Header presence/decoded claims alone
   issue no code. JWKS failure fails closed; trusted keys are cached, bounded
   by the library's expiry/reload behavior.
4. After verification, a 256-bit authorization code is stored hashed in a
   SQLite-backed Durable Object, bound to challenge, state, exact origin and
   verified identity expiry. Code expiry is **at most 60 seconds**. The no-store,
   no-referrer return HTML sends the code through Office messaging only, with
   exact `targetOrigin`, matching state and challenge. No identity/JWT is sent.
5. The pane checks exact origin/state/type/keys and exchanges the code plus
   verifier and state by HTTPS JSON POST, **credentials:omit**. The verifier is
   not in navigation, storage, logs or Word. Inside one storage transaction the
   DO validates S256/binding/expiry, consumes the code and creates a session.
   Concurrent exchange and replay cannot create two sessions. This is the RFC
   7636 S256 authorization-code pattern with opaque capabilities, not a custom
   JWT signing implementation or a general-purpose OAuth provider.
6. A fresh 256-bit Word token is retained only in pane memory. Server storage
   contains its SHA-256 lookup key, exact origin, scope and expiry, no document
   or human identity. TTL is **at most 15 minutes**, also capped by the verified
   Access identity expiry. There is no refresh token or silent login promise.
7. Every protected API request, including SSE start, checks the DO record.
   `/session/revoke` deletes it transactionally. Revocation/expiry blocks new
   requests; it does not recall a request already authorized and streaming.
   The API constructs a fresh upstream request; it never forwards the Word token,
   browser cookies, Access assertion or caller credentials to Engine.
8. Successful login runs only session GET then model-discovery GET. It never
   sends/replays the retained message or invokes a Word write.

## Exact public surface

All routes are on the pane's configured HTTPS origin; no cross-origin CORS
allowance or arbitrary endpoint selector exists.

| Boundary | Route | Method / result |
| --- | --- | --- |
| Human Access + verified JWT | `/word-auth/authorize` | GET with only `challenge,state`; no-store Office return HTML |
| PKCE + rate limit | `/word-api/session/exchange` | POST `{code,verifier,state}` → `{token,expiresAt,scope}` |
| Word capability | `/word-api/session` | GET → bounded session metadata |
| Word capability | `/word-api/session/revoke` | POST → revoke current capability |
| Word capability | `/word-api/v1/models` | GET → existing bounded JSON gateway |
| Word capability | `/word-api/v1/chat/completions` | POST → existing bounded SSE gateway |

Scope is fixed to `word:models word:complete`; the remaining session operations
only inspect/revoke the caller's own capability. No admin, file, arbitrary proxy
or refresh endpoint is exposed. POST requires exact Origin; all routes reject
foreign Origin, cross-site fetch metadata, wrong host, query (except fixed auth
parameters), method and unknown path. Exchange JSON is limited to 1 KiB and five
seconds. Completion JSON is limited to 64 KiB/five seconds and the fixed model, streaming
SL/EN request fields; the session is rechecked after body admission before SSE. JSON/SSE responses retain
1 MiB bounds and downstream cancellation. Expired/revoked/absent capabilities
fail before Engine access. Unexpected application responses fail closed.

Issue and exchange each have transactional limits of 12/minute per hashed edge
IP and 300/minute globally. Five wrong code-binding attempts invalidate that
code. Rate buckets expire after one minute. These conservative staging limits
are deliberate; NAT sharing may throttle legitimate sign-ins. Storage alarms
remove expired codes, sessions and buckets; expiry is checked on every use,
independently of alarm scheduling. There is one staging DO shard; scaling this
is a separate review. No eventual Workers KV or isolate-local authority is used.

## Recovery UX and limits

A destroyed pane loses the session and all transient form state, as before;
this adds no draft persistence. Reopening therefore requires an explicit Office
sign-in gesture. A still-valid top-level IdP/Access session may avoid credential
reentry, depending on the IdP. In an open pane, expiry/revocation retains the
multiline draft, locale and attached/removed selection. Recovery never recaptures
an intentionally removed attachment or automatically resends a request.

Office Ignore/close is **closed**, verified authorization denial/403 is
**denied**, missing/expired/revoked Word capability is **SESSION_EXPIRED**.
Network failure, timeout, 429, unavailable service and malformed response remain
separate. An Access edge policy-denial page can remain inside the dialog before
origin code runs: it is not proof of expiry and cannot be inferred as a parent
success. Closing that page is still a closed dialog, not authenticated access.
There is no iframe Storage Access action or cookie-reactivation dependency in
the new production composition. The old helper/tests are retained only as
legacy code/evidence and are not imported by the new composition.

The Office and native Word matrix is still **NOT_RUN** for this architecture.
Offline tests and the real-browser synthetic driver do not establish Access
IdP behavior, actual Word callbacks, idle recovery or document-write acceptance.

## Verification and operational preparation

- `test/gateway/wordSession.test.ts`: real local workerd + SQLite DO, concurrent
  one-time exchange, replay, binding, expiry, revocation, JWT rejection,
  unauthenticated route denial, server credential isolation and abuse limits.
- `test/taskpane/WordSessionClient.test.ts`: memory-only lifecycle, timeout,
  cancellation/late exchange, route restriction and precise failures.
- Office/bootstrap/runtime tests: exact native origin/state/shape and PKCE,
  canceled/denied outcomes, draft/locale/removal retention, no automatic send.
- `scripts/check-word-session-browser.js`: actual built task pane in isolated
  Firefox with all cookies blocked, intercepted synthetic HTTPS, synthetic
  Office/Access/model discovery and local SQLite DO. No provider completion.
  It needs an already available Playwright/Firefox and a private output path
  via `OLC72_BROWSER_OUTPUT`; optional `OLC72_PLAYWRIGHT_MODULE` and
  `OLC72_BROWSER_EXECUTABLE` select installed tooling. Browser traces are disabled.
- Run the full gates in [Contributing](../CONTRIBUTING.md), including the new
  local-only `npm run build:word-session`.

See [the reviewed staging sequence](WORD_SESSION_STAGING.md). Nothing in this
commit creates or changes live Workers, Access applications/policies, routes,
DNS, credentials or deployments. Old rollback artifacts remain preserved.

## Primary references

- [RFC 7636, S256 PKCE](https://www.rfc-editor.org/rfc/rfc7636)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [jose JWT verification](https://github.com/panva/jose/tree/316b7f2cb41b8377515d9cc2e81e03f8e50ee935)
- [Strongly consistent SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Office dialog authentication](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/auth-with-office-dialog-api)
