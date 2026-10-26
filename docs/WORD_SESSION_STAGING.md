# OLC-72 Word session staging preparation

> **Historical/source scope.** Current attribution is in [STATUS.md](STATUS.md).
> This retained milestone's setup, activation and rollback steps are not a
> current execution order. In particular, aa5 does not preserve later Microsoft
> SSO; old “not activated” and “login failure” labels do not override the dated
> manual access acceptance. OLC-74 proposal failure remains open. Follow the
> [documentation map](DOCUMENTATION-MAP.md) before reusing a procedure.


> Historical/deployed Cloudflare-user-login architecture. The owner-approved
> Microsoft NAA/SSO candidate supersedes this user authentication path but is
> not activated yet. See [Microsoft SSO](MICROSOFT_SSO.md) and its
> [coordinated staging/rollback](MICROSOFT_SSO_STAGING.md). The working aa5 delivery
> and this earlier evidence are retained.

Execution update 2026-10-24: the owner-authorized staging activation for
`aa5d369f3e99067e8059a50fdd99f22535ca9810` has passed live human Access/PKCE,
session/models/revocation and artifact delivery checks. Actual Word remains
NOT_RUN. See the [sanitized execution evidence](evidence/olc72-word-session-activation-20261024/README.md).
The procedure below remains the reviewed operator sequence, not general
authorization for future mutations.

**Prepared procedure, not activation authorization.** This change is not Pages-only.
It needs two new Workers, a SQLite Durable Object namespace and two narrow routes,
plus adding the authorization Worker destination to the existing human Access
application. No new API token, provider credential, IdP, DNS change or broad
Access bypass is required. Exact private account/resource mapping and archived
rollback bytes belong in the protected operator package, not this public guide.

## Artifacts and bindings

Build from the exact reviewed clean commit with `npm ci`, `npm run build:stage`
and `npm run build:word-session`. Preserve a manifest of SHA-256 for **artifact
files only**, never credentials. Outputs:

- `dist/stage/`: Pages frontend and the public source-only manifest template;
- the protected package copies the **existing approved deployed manifest bytes**
  over its Pages copy of that template, preserving the hostname/GUID/permissions/
  version exactly. Do not deploy the `example.invalid` source template. Keep the
  template and final artifact checksums distinct; CSP/icons/accepted CSS stay unchanged;
- `dist/word-session/auth-worker.mjs`, `auth.wrangler.toml`, `JOSE-LICENSE.txt`;
- `dist/word-session/api-worker.mjs`, `api.wrangler.toml`.

Source configs are inert placeholders and have no routes. Generated configs
point to `.mjs` bundles. Fill exact values only in the protected package:

| Resource | Binding | Source |
| --- | --- | --- |
| Auth Worker `olc-word-session-auth` | `PUBLIC_ORIGIN` | Exact existing staging HTTPS origin |
| Auth Worker | `ACCESS_ISSUER`, `ACCESS_AUDIENCE` | Existing human Access issuer/application audience |
| Auth Worker | `WORD_SESSIONS` | New SQLite DO class `WordSessionStore`, migration `word-session-v1` |
| API Worker `olc-word-session-api` | `PUBLIC_ORIGIN`, `ENGINE_ORIGIN` | Approved staging/origin mapping |
| API Worker | `WORD_SESSIONS` | Same auth Worker namespace, cross-script binding |
| API Worker | `ENGINE_API_KEY`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | Existing approved private originals, operator-side provision only |

No session signing secret is required: capabilities are random and hashed in
server storage. Do not export old deployed secrets; do not create replacements
without separate approval. Disable workers.dev, preview URLs and body/header
logging. The auth bundle includes the required jose MIT notice.

## Mandatory preflight

1. Verify exact branch/commit, successful exact-head CI, artifact checksums and
   that only the intended code/docs are being activated. Check the manifest,
   CSP, logo and ready-form CSS against the accepted predecessor.
2. Read exact current Pages canonical ID/source, active legacy Worker deployment
   and version, old custom routes and human Access app/policy/destinations.
   Compare the private baseline. Any drift stops activation; do not reuse old IDs
   blindly. Keep immutable Pages rollback bytes plus its static headers, and the
   usable legacy Worker/version and original protected routes.
3. Verify the existing human app's `destinations` supports adding the new auth
   Worker ID without removing/replacing its existing legacy destination. The
   Cloudflare schema allows multiple destinations and describes Worker
   destinations as protecting **all requests** routed to that Worker. Do not
   equate workers.dev settings with custom-route protection. Preserve the entire
   human policy, audience, session/cookie settings and all unrelated destinations.
4. Confirm the new API Worker is **not** the human Access destination. Verify
   exact bound-Worker metadata and, after the new narrow routes exist, request
   only their exact session/models URLs with cookies omitted: missing capability
   must return the Word API's marked JSON 401, not an Access redirect or denial.
   A valid capability must then pass the same safe GETs. This establishes actual
   reachability even when broader account-wide protection cannot be enumerated
   within the approved read scope. Do not run an unfiltered account application
   list. Do not remove protection from the old Worker or any existing path. If
   a broader rule intercepts the new boundary, stop for a narrow reviewed design;
   never add a blanket bypass. Empty domain queries alone are not proof.
5. Confirm the original private Engine/service credentials can be provisioned
   server-side and the approved Engine runtime still matches its independent
   handoff. This task does not reread credentials or requalify Engine content.

## Future activation, in order

1. Create the auth Worker/SQLite namespace with the reviewed migration and no
   public routes. Keep workers.dev/preview disabled. Create the API Worker with
   the same namespace binding and existing server-only credentials, also unrouted.
   Record new resource/version IDs and verify local checksums of uploaded modules.
2. Append **only the auth Worker destination** to the existing human Access
   application; leave policies and old destination untouched. Reread and compare
   exact state. If the platform cannot preserve this policy, stop before routing.
3. Add only `/word-auth/*` → auth Worker and `/word-api/*` → API Worker on the
   existing exact staging hostname. Preserve `/api/*` and `/v1/*` → legacy Worker,
   all other routes/DNS and the Engine origin. No global Access disabling.
4. With the old frontend still active, verify the new boundary: unauthenticated
   models/session GETs return marked JSON 401 before upstream; wrong method/path/body
   fail; auth route without valid human Access cannot issue a code; valid
   top-level login returns only a one-time code; PKCE exchange/replay/expiry and
   server revocation behave as tested. Completion denial is already qualified
   offline; do not issue a live completion POST for activation. Only provider-free session/models GETs
   may reach Engine under a separately approved runtime check.
5. **Workers/routes/protection first, Pages second.** Publish the exact prepared
   Pages files only after the new boundaries pass. Verify public bytes and active
   JavaScript identity, unchanged manifest/CSP/logo/CSS, no storage-cookie action
   and correct `/word-api/` requests. The new frontend never uses the legacy JSON
   or cookie-protected gateway. Failed authentication never falls back to it.
6. Record final Pages/new Worker versions, unchanged legacy version/routes and
   checks. Keep both pairs recoverable. Actual Word acceptance remains separate.

Partial completion: if Workers succeed and Pages fails, the old UI and legacy
protected routes keep serving. Remove only the new route attachments if needed;
retain private recovery state. If Pages activates but new session/API fails,
roll back Pages immediately. Do not expose an unauthenticated completion, change
Access policy or silently route the new client to the old gateway.

## Rollback, Pages before new routes/Workers

1. Restore the preserved previous Pages canonical deployment through the supported
   Pages API rollback, or re-upload the verified previous static bytes/headers if
   rollback is unavailable. Re-upload creates a new deployment ID: verify its
   source/bytes rather than claiming the old ID. Wrangler has no assumed Pages
   rollback subcommand. Confirm the old frontend and manifest are restored.
2. Verify the untouched old gateway's active version/deployment and protected
   `/api/*`, `/v1/*`; redeploy the preserved version only if it actually drifted.
3. Remove only newly added auth/API route attachments; preserve all old routes.
   Then remove only the new auth destination from the human app, retaining the
   original destination/policies/settings. Do not delete its app or the DO.
4. Keep new resources unrouted/private and retain the namespace until all
   sessions (max 15 minutes) expire; server-side revocation may be used if needed.
   Any later resource cleanup needs separate approval. Confirm old Pages/Worker
   pair, Access protection and DNS unchanged, and record actual new rollback IDs.

## Actual Word Web acceptance, no completion

Use a test document and the already approved manifest. After activation, open the
pane; use the explicit existing sign-in action and Office Allow if prompted.
Check the usable form and only session/model discovery GETs. Enter a synthetic
multiline draft, select SL/EN and remove the selection attachment. Check connection
while valid; after a **known** session expiry/revocation, restore access and
confirm the draft/locale/removal survive without Send. Close/reopen separately:
this destroys memory session/draft; copy any draft first and expect a new explicit
sign-in. Test canceled dialog and blocked cookies under operator-controlled
conditions. Do not promise silent reopen, persistent draft or native Word PASS
based on the isolated browser. No completion or document write is part of this
matrix. Native document-operation qualification remains separate.
