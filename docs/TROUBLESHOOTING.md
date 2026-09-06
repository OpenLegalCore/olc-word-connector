# Troubleshooting

[Documentation index](README.md) · [Installation](INSTALLATION.md) ·
[Integration guide](INTEGRATION.md) ·
[Compatibility](COMPATIBILITY_AND_LIMITATIONS.md)

This guide diagnoses the `v0.1.0-beta.1` source-only connector without weakening
its security or document-safety boundaries.

> [!IMPORTANT]
> Do not disable TLS or access controls, enable wildcard CORS, place credentials
> in frontend code, publish secrets in an issue, or silently switch providers as
> a workaround.

## Start with the failing layer

| Symptom | Most likely layer | First check |
| --- | --- | --- |
| Add-in or ribbon command is missing | Word registration / manifest | Correct XML manifest and permitted sideload method |
| Task pane opens but never reaches the service chooser | Static hosting / JavaScript | Task-pane URL, HTTPS trust, browser console without sensitive data |
| Connection check fails | Gateway / session / model discovery | Explicit provider, same-origin route, session and exact model ID |
| Search starts but fails | Completion route / backend contract | Status code, content type, provider availability and response limits |
| **Session expired** appears | Browser-facing identity | Complete secure sign-in, return to Word, select **Retry search** |
| No useful source is returned | Backend corpus / retrieval | Refine the question and verify backend coverage |
| Source text is visible but not clickable | Renderer URL policy | Exact HTTPS PISRS or sodnapraksa hostname |
| **Selected text** is rejected | Word selection policy | Non-empty supported selection within one body or table cell |
| Answer is visible but cannot be copied | Browser / host clipboard | Task-pane focus and clipboard permission |

A successful static build proves none of the gateway, identity, model, corpus or
Word-runtime layers.

## The add-in or task pane does not open

1. Confirm that the intended XML manifest was installed or sideloaded.
2. Confirm that the manifest is being opened in Microsoft Word.
3. Check that every manifest URL is reachable over trusted HTTPS.
4. Use the exact build output that matches the manifest; do not mix development,
   staging and production artifacts.
5. For the verified development path, follow
   [Word for the web sideload](INSTALLATION.md#path-b-word-for-the-web-development-sideload).

The root `manifest.xml` expects the development task pane at
`https://localhost:3002`. Start that server with:

```bash
npm start
```

If the ribbon command is absent after correcting the manifest or host, remove
only the add-in registration you control and sideload the intended manifest
again. Do not bypass certificate warnings or replace HTTPS with plaintext on a
non-loopback host.

## The task pane loads but live search does not work

The stock development server serves the frontend but does not implement the
same-origin `/api/*` or `/v1/*` provider routes. It can validate loading, Office
integration and UI behavior without providing a legal backend.

For live search, confirm that the operator deployment includes:

- the same HTTPS origin for task-pane assets and gateway routes;
- `GET /api/models` and `POST /api/chat/completions` for Open WebUI, when
  enabled;
- `GET /v1/models` and `POST /v1/chat/completions` for OLC Engine, when
  enabled;
- the exact configured model ID; and
- a valid browser-facing identity session.

See [Backend and gateway integration](INTEGRATION.md) for the complete contract.

## Provider choice or connection check fails

A connection check sends no Word document text. It verifies only the selected
provider's model-list route and exact model ID.

Check, in order:

1. the provider selected in the task pane;
2. whether the browser session is valid;
3. whether the corresponding same-origin route exists;
4. whether the route returns HTTP 200 with the expected JSON content type and
   shape; and
5. whether the configured model ID appears exactly in `data[].id`.

Select **Try again** only after correcting the cause. The connector never falls
back from Open WebUI to OLC Engine or in the opposite direction.

## Session expired

A same-origin redirect, HTML login response, `401` or `403` is treated as
**Session expired**, not as a model answer.

1. Select **Open secure sign-in**.
2. Complete the operator-provided browser login.
3. Confirm that the sign-in landing reports completion.
4. Return to Word.
5. Select **Retry search** explicitly.

Sign-in completion does not automatically send the question again. The
connector preserves the selected provider, exact question and context mode. If
**Selected text** is active, Retry captures the then-current selection again.

If the identity page reports an invalid redirect URL, the operator must correct
the identity application's allowed redirect/return configuration for the exact
public origin and `/api/session` flow. Do not add a wildcard redirect.

## Open WebUI is unavailable or rejects the request

Verify the exact Open WebUI adapter profile:

- `GET /api/models` returns JSON and includes the configured model;
- `POST /api/chat/completions` accepts one user message, a fresh
  `local:<UUIDv4>` chat ID and `stream: true`;
- the completion response is `text/event-stream`;
- the stream contains textual `choices[].delta.content` events; and
- it ends with the required completion boundary.

The browser must not hold the Open WebUI API key. In the reference topology,
the gateway adds the Bearer credential server-side. A mismatched content type,
malformed stream, missing completion boundary or oversized response fails
closed.

Compatibility is verified against the exact documented profile, not every Open
WebUI version. Check release-specific behavior before upgrading an upstream
deployment.

## OLC Engine is unavailable or rejects the request

Verify the direct engine contract:

- `GET /v1/models` returns an OpenAI-compatible list object containing the exact
  configured model ID;
- `POST /v1/chat/completions` accepts `stream: false` and one user message; and
- the response is HTTP 200 `application/json` with non-empty text at
  `choices[0].message.content`.

A server that is generally described as “OpenAI-compatible” is not necessarily
compatible with this exact contract. Redirects, HTML, malformed UTF-8, invalid
JSON, missing content and oversized responses are rejected.

## Model not available

`MODEL_NOT_AVAILABLE` means that the configured model ID was not present in the
selected provider's model list, or the selected route returned `404`.

The default build-time ID is `olc-engine`. If the operator uses another ID,
rebuild with an exact public identifier:

```bash
OLC_WORD_MODEL_ID=partner-model:latest npm run build:stage
```

Verify the resulting artifact and both enabled provider model lists. Never use a
credential as a model ID.

## Search returns no useful result

Refine the legal question with:

- the relevant act, article, legal issue, court or proceeding;
- the exact date when historical law matters;
- the requested source type: legislation, case law or both; and
- an explicit request to state when reliable sources are unavailable.

A missing semantic result does not prove that no relevant source exists.
Ingestion, indexing, temporal coverage, model configuration and upstream tools
determine what can be retrieved.

## The answer has no reliable sources

Do not rely on unsupported output. Use **Refine question** to request exact
source identities and links. Verify the act, provision, court, file number,
date, validity period and relevant reasoning directly in the authoritative
source.

If the problem repeats, stop using that result and report a content-free product
or backend issue to the responsible maintainer. Do not include confidential
documents, selected text, questions or generated answers in a public report.

## A citation is not clickable

This is often the intended security result. A URL is activated only when it:

- uses HTTPS;
- contains no username, password or explicit port; and
- has the exact hostname `pisrs.si`, `www.pisrs.si`,
  `sodnapraksa.si` or `www.sodnapraksa.si`.

HTTP, executable schemes, malformed links, arbitrary or lookalike hosts,
nonstandard ports, credentials and model-provided HTML remain inert text. Do
not weaken the allowlist. Locate the cited source directly on the authoritative
site when necessary.

## Selected text is empty, too large or unsupported

For **Selected text**:

1. select at least one visible non-whitespace character;
2. keep the selection at or below 20,000 characters;
3. avoid inline pictures, embedded structures and selections that contain a
   table; and
4. inside a table, select text within one cell only.

Selection is captured only when Search or an explicit Retry starts. A rejected
selection causes no provider completion and no document mutation.

If the selection changed while the sign-in tab was open, review it before
Retry. The retry intentionally captures the current selection rather than
reusing hidden document text.

## The question is rejected

The legal question must contain 1–4,000 characters. Remove accidental blank
input or reduce an oversized question without moving confidential material to
another field.

Question validation happens before selection capture or a provider request.

## Cancel or timeout

**Cancel** aborts the active request and returns the task pane to its ready
state. The adapter timeout is 120 seconds. Both leave the document unchanged.

Use one explicit Search or Retry action after resolving the cause. The
connector does not issue automatic retries.

## A late result appears after Cancel

The controller invalidates cancelled, timed-out and superseded operations. A
late resolve or reject must not become the visible result. This behavior passed
the Word for the web release acceptance with a controlled delayed response.

If a result nevertheless appears after cancellation, treat it as a defect.
Record only:

- connector version or commit;
- selected provider;
- visible state or content-free error code; and
- non-sensitive timing information.

Do not attach request/response bodies or document content.

## Copy answer fails

Clipboard behavior depends on the browser and Office host. Confirm that the
task pane has focus and clipboard access has not been denied. The answer should
remain visible while the permission issue is resolved.

Copy failure does not change Word. Do not add document insertion as a fallback.

## Manifest validation fails

Run the validator for the exact manifest:

```bash
npm run validate
npm run validate:dev
npm run validate:stage
npm run validate:prod
```

The Microsoft validator uses an external validation service. Record a DNS or
service outage separately; do not edit the manifest merely to hide an unrelated
network failure.

Key distinctions:

| Manifest | Expected role |
| --- | --- |
| `manifest.xml` / `manifests/manifest.dev.xml` | Local development; `ReadWriteDocument` for the isolated development harness |
| `manifests/manifest.stage.xml` | Inert example staging manifest; replace every `.example.invalid` URL before use |
| `manifests/manifest.prod.xml` | Reserved production identity; this repository does not operate the referenced service |

Staging and production manifests use `ReadDocument`. The active legal-source
workflow does not mutate Word.

## The hosted manifest and build do not match

Webpack copies the selected source manifest to `dist/<target>/manifest.xml`.
Confirm that:

1. the correct target was built;
2. the deployed `manifest.xml` contains the expected public origin;
3. `taskpane.html`, `commands.html` and all icon URLs resolve on that origin;
4. the deployed JavaScript and CSS files referenced by the HTML exist; and
5. stale CDN or browser content is not masking the current artifact.

Do not assume that a 200 response from one file proves the whole add-in
artifact is coherent. Compare the deployed manifest and assets with the exact
build output before changing DNS, identity or provider configuration.

## Development certificate problems

Prepare the repository's localhost certificate with:

```bash
npx --no-install office-addin-dev-certs install
```

Then start the development flow with `npm start`. Approve only the certificate
created for this local workflow.

Do not use an insecure browser flag, ignore TLS errors, or expose the
development server as plaintext on a non-loopback host.

## Local development server problems

The configured port is `3002`. Check whether another process you control already
uses it, stop only that process, and rerun `npm start`.

For browser-only state inspection:

```bash
npm run start:harness
```

For the historical development Word harness:

```bash
npm run dev:word-harness
```

Harnesses are development artifacts and are excluded from deployable
production composition. Do not change frameworks or dependency versions as an
ad hoc server repair.

## Error-code reference

The task pane exposes a content-free status code for controlled failures.

| Code | Meaning | Safe next step |
| --- | --- | --- |
| `SESSION_EXPIRED` | Browser-facing protected session is no longer accepted | Secure sign-in, return to Word, explicit Retry |
| `AUTH_REQUIRED` / `ACCESS_DENIED` | Direct credential or upstream authorization failed | Operator checks server-side identity; do not place keys in the browser |
| `MODEL_NOT_AVAILABLE` | Exact model ID is absent or model route returned `404` | Compare build-time ID with `data[].id` |
| `RATE_LIMITED` | Provider returned `429` | Wait according to operator policy; retry once explicitly |
| `SERVICE_UNAVAILABLE` | Provider returned a server error | Check provider health; do not switch providers silently |
| `NETWORK_ERROR` | Fetch failed before a valid response | Check HTTPS, DNS, route and gateway availability |
| `TIMEOUT` | Bounded request expired | Check backend latency; retry explicitly after diagnosis |
| `INVALID_RESPONSE` | Status, content type, structure, encoding or size violated the contract | Compare the response with the integration guide |
| `EMPTY_RESPONSE` | Completion text was empty | Check model/backend behavior |
| `NO_SELECTION` | Selected-text mode found no visible text | Select text and retry |
| `SELECTION_TOO_LARGE` | Selection exceeded 20,000 characters | Reduce the selection |
| `UNSUPPORTED_SELECTION` | Selection crossed an unsupported structure | Use plain body text or one table cell |
| `WORD_READ_FAILED` | Word selection capture failed | Retry with a simple synthetic selection; report if repeatable |
| `COMPLETION_FAILED` / `CONNECTION_FAILED` | Unexpected completion or connection failure | Capture only non-sensitive state and inspect the responsible layer |

`CANCELLED` is normally an intentional transition back to ready state rather
than a user-facing error.

## Report an ordinary bug

Use the repository issue tracker only for non-sensitive defects. Include:

- version or commit;
- Word client, browser and operating system;
- reproducible steps using synthetic data;
- expected and observed controlled state; and
- content-free error code, response status and content type when available.

Never publish confidential documents, selected text, legal questions, generated
answers, credentials, cookies, private URLs or raw network captures.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability. Follow
[`SECURITY.md`](../SECURITY.md) and email
[security@openlegalcore.org](mailto:security@openlegalcore.org) with a minimal,
redacted, synthetic report.

## More information

- [Installation and deployment](INSTALLATION.md)
- [User guide](USER_GUIDE.md)
- [Backend and gateway integration](INTEGRATION.md)
- [Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md)
- [Technical guide](TECHNICAL_GUIDE.md)
- [Privacy](../PRIVACY.md)
