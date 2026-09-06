# Installation and deployment

[Documentation index](README.md) · [Integration guide](INTEGRATION.md) ·
[Troubleshooting](TROUBLESHOOTING.md)

OpenLegalCore Word Connector is a source-only beta. Choose the path that matches
what you want to evaluate:

| Path | Result | Word required | Live backend required |
| --- | --- | --- | --- |
| [A. Local UI preview](#path-a-local-ui-preview) | Synthetic task-pane states in a browser | no | no |
| [B. Word for the web sideload](#path-b-word-for-the-web-development-sideload) | The real add-in loaded from local HTTPS | yes | only for live search |
| [C. Connected deployment](#path-c-connected-self-hosted-deployment) | Live search through an operator gateway | yes | yes |

The repository does not include a one-click installer, AppSource listing,
hosted OpenLegalCore service, legal database, Open WebUI or OLC Engine instance.
A successful frontend build is only one part of a working deployment.

## Prerequisites

Paths A and B require:

- Git;
- Node.js **24.x**, matching the repository engine and CI configuration;
- npm from that Node.js installation; and
- a current browser.

Path B also requires a Microsoft account or Microsoft 365 tenant account that
can open Word for the web and permits developer sideloading. A tenant
administrator can disable sideloading.

Path C additionally requires:

- a compatible Open WebUI and/or OLC Engine deployment;
- the expected legal-research model and legal-source corpus;
- an HTTPS origin for the add-in;
- a same-origin gateway that implements the connector contract; and
- operator-controlled identity, secrets, logging and retention policies.

Yeoman and the Office Add-in generator are not required. The generated project
and its development dependencies are already locked in this repository.

## Get the source

```bash
git clone https://github.com/OpenLegalCore/olc-word-connector.git
cd olc-word-connector
node --version
npm --version
npm ci
```

`node --version` must report `v24.x`. Use `npm ci`, not `npm install`, so the
installed tree follows `package-lock.json` exactly.

## Verify the checkout

Run the deterministic gates before changing or deploying anything:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run validate
npm run validate:dev
npm run validate:stage
npm run validate:prod
npm run build:harness
npm run build:word-harness
npm run build:dev
npm run build:stage
npm run build
npm run verify:bundle
```

These checks do not call a protected backend. Deployable outputs are:

| Command | Output | Purpose |
| --- | --- | --- |
| `npm run build:dev` | `dist/dev/` | Local development build |
| `npm run build:stage` | `dist/stage/` | Staging build and staging manifest |
| `npm run build` | `dist/prod/` | Production-shaped build and reserved production manifest |

Do not commit `dist/`. A passing build does not prove that identity, the
gateway, a backend, legal-source coverage or the Word runtime works.

## Local HTTPS certificate

Office task panes must be served over HTTPS. The development tooling requests a
locally trusted certificate when the server first starts. To prepare it
explicitly, run:

```bash
npx --no-install office-addin-dev-certs install
```

Approve only the certificate generated for this local development workflow.
Never disable TLS validation or use plaintext HTTP for a non-loopback host.

## Path A: local UI preview

Use the browser harness to inspect the task-pane design and representative
states without Microsoft Word or a legal backend:

```bash
npm run start:harness
```

Open:

```text
https://localhost:3002/harness.html
```

The harness uses synthetic fixtures and a fake gateway. It verifies rendering,
not Office.js integration, backend availability, retrieval quality or Word
runtime acceptance. Stop it with `Ctrl+C`.

## Path B: Word for the web development sideload

The repository-root `manifest.xml` is the local development manifest. Its task
pane, commands and icons point to `https://localhost:3002`.

The development manifest requests `ReadWriteDocument` because the repository
retains an isolated replacement-safety test harness. The production search
composition does not expose or call document-writing operations. The staging
and reserved production manifests request `ReadDocument`; see
[Manifests and permissions](TECHNICAL_GUIDE.md#manifests-and-permissions).

### Preferred command-line flow

1. In Word for the web, create or open a disposable test document.
2. Select **Share → Copy link** and copy the document URL.
3. From the repository root, run:

   ```bash
   npm run start -- web --document "PASTE_THE_WORD_DOCUMENT_URL_HERE"
   ```

   Quote the URL for your shell so query-string characters are not interpreted.

4. On first use, Microsoft may ask you to enable developer mode and register
   the local manifest. Approve this only for the checkout you are testing.
5. In Word, open **Home** and select **Open OpenLegalCore**.

The command starts the local HTTPS server and registers the manifest. End the
session with:

```bash
npm stop
```

Closing only the terminal or browser is not a substitute for the stop command
when the debugging tool registered the add-in.

### Manual Word Web flow

If command-line sideloading is unavailable:

1. Start the local server and keep its terminal open:

   ```bash
   npm run dev-server
   ```

2. Open a disposable document in Word for the web.
3. Choose **Home → Add-ins → More Settings → Upload My Add-in**.
4. Upload the repository-root `manifest.xml`.
5. Confirm that **Open OpenLegalCore** appears on the Home ribbon and opens the
   task pane.

Microsoft stores a web sideload registration in browser-local state. Clearing
the browser cache or switching browsers can require another upload.

### What works without a gateway

The add-in can open and display its service chooser. Live connection checks and
searches do not work from the stock development server alone: the production
composition calls same-origin `/api/*` and `/v1/*`, while the development
server does not implement those routes.

Use Path A for a backend-free product tour. Continue with Path C for live
search.

## Path C: connected self-hosted deployment

This is an operator integration, not a turnkey deployment recipe. Read the
[integration guide](INTEGRATION.md) before configuring infrastructure. It is
the authoritative public contract for provider routes, request and response
shapes, identity separation, model selection and live contract tests.

### 1. Choose one browser-facing origin

Serve the static add-in and gateway from the same HTTPS origin. The browser
uses only relative same-origin routes:

| Provider | Connection check | Completion |
| --- | --- | --- |
| Open WebUI | `GET /api/models` | `POST /api/chat/completions` |
| OLC Engine | `GET /v1/models` | `POST /v1/chat/completions` |

The browser must not receive provider API keys, Cloudflare service-token
headers, private backend origins or arbitrary user-configurable backend URLs.

### 2. Configure the selected backend paths

The checked-in Cloudflare Worker is a generic fail-closed gateway example. It
expects both provider paths and all of its documented server-side values. An
operator who needs only one provider should implement and test a deliberately
reduced gateway instead of leaving dummy credentials or weakening validation.

If Cloudflare is not your platform, implement the same narrow contract on your
chosen server. The connector depends on the contract, not on Cloudflare.

### 3. Choose the model ID

The browser bundle defaults to `olc-engine`. Both configured provider paths
must expose that exact ID, or the operator must select another non-secret model
ID before building:

```bash
OLC_WORD_MODEL_ID=partner-model:latest npm run build:stage
```

The accepted value is 1–200 characters, starts with an alphanumeric character,
and otherwise uses only letters, numbers, `.`, `_`, `:`, `/`, `+` or `-`.
It is embedded in the browser bundle and must never contain a credential.

### 4. Configure a matching manifest

Choose exactly one manifest and deployment identity:

- `manifests/manifest.stage.xml` for an operator staging environment; or
- `manifests/manifest.prod.xml` for a deliberately prepared production
  environment.

Replace every `.example.invalid` or reserved hostname with the exact HTTPS
origin you control. Verify task-pane, command and icon URLs together. Do not
deploy the repository-root local-development manifest.

The package version (`0.1.0-beta.1`) and Office manifest version (`1.0.0.3`)
belong to different versioning systems; do not assume they must match.

### 5. Build and host one matching output

For staging:

```bash
npm run validate:stage
npm run build:stage
```

For a production candidate:

```bash
npm run validate:prod
npm run build
npm run verify:bundle
```

Host the complete matching `dist/stage/` or `dist/prod/` directory at the exact
URLs declared in its bundled `manifest.xml`. Preserve the generated security
headers and correct MIME types. Do not mix a manifest from one build with
assets from another.

### 6. Sideload and accept the connected build

Sideload the exact hosted manifest into an authorized Word for the web test
environment. A connected deployment is not accepted until a real walkthrough
confirms:

- both enabled provider choices connect to the intended backend;
- **No document context** sends no Word text;
- **Selected text** sends only the selection captured when Search begins;
- empty, oversized and unsupported selections fail before completion;
- answers render as text and only approved source links become clickable;
- Copy answer, Refine question and New search work as documented;
- Cancel and timeout suppress late results;
- Session expired requires secure sign-in and an explicit Retry search;
- questions, selections, answers and credentials do not appear in unintended
  logs or browser storage; and
- the Word document remains unchanged throughout the beta workflow.

Record the exact Word host, browser, manifest, build commit, gateway revision,
backend version, model and policy configuration used for acceptance.

## Common problems

| Symptom | First check |
| --- | --- |
| `npm ci` fails | Node is `v24.x`, `package-lock.json` exists and registry access works |
| Browser rejects localhost | Install the development certificate; never bypass a non-local TLS warning |
| Add-in command is missing | The intended manifest is sideloaded and every manifest URL is reachable |
| Provider fails immediately | The same origin exposes the exact route and configured model ID |
| Word Web lost the add-in | The browser profile or cache changed; sideload the manifest again |
| Session expired repeats | Complete sign-in in the opened tab, return to Word, then select Retry search |
| Result lacks reliable sources | Stop relying on it and verify the authoritative source directly |

See [Troubleshooting](TROUBLESHOOTING.md) for controlled recovery paths.

## Authoritative external references

- [Sideload Office Add-ins to Office on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing)
- [Test and debug Office Add-ins on a non-local server](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/test-debug-non-local-server)
- [Open WebUI API endpoints](https://docs.openwebui.com/reference/api-endpoints/)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

Microsoft's current interface and tenant policy remain authoritative if labels
or permissions differ from this guide.
