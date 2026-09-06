# Contributing

Thank you for helping improve OpenLegalCore Word Connector. The project welcomes
clear bug reports, documentation corrections, security-conscious review, and
focused technical contributions that preserve the beta's narrow trust boundary.

## Contribution license

The project is licensed under the [Apache License 2.0](LICENSE). Under section 5
of that license, a contribution intentionally submitted for inclusion in this
project is provided under Apache-2.0 unless you explicitly state otherwise.

Submit only work that you have the right to contribute. Identify copied or
adapted third-party material and preserve every required license and notice.
Submitting a contribution does not grant permission to use OpenLegalCore names
or marks beyond the descriptive use addressed in
[TRADEMARKS.md](TRADEMARKS.md).

## Start here

1. Read the [project README](README.md) for scope and current maturity.
2. Follow [Installation and deployment](docs/INSTALLATION.md) for a clean setup.
3. Read the [technical guide](docs/TECHNICAL_GUIDE.md).
4. Check [Compatibility and limitations](docs/COMPATIBILITY_AND_LIMITATIONS.md)
   before making a support or capability claim.
5. Use the [Roadmap](ROADMAP.md) to distinguish current scope from future
   directions.

## Non-negotiable product boundaries

- Send only the text explicitly selected by the user, never the whole document.
- Do not change Word in the current beta search flow.
- Keep Word access, orchestration, provider HTTP, and view rendering in their
  existing layers.
- Treat model output as untrusted text; never render it as model-provided HTML.
- Keep provider credentials and private-origin credentials out of frontend
  source, bundles, manifests, URLs, browser storage, Office settings, and logs.
- Keep provider selection explicit; do not add automatic fallback or credential
  sharing.
- Cancellation, timeout, validation failure, session expiry, backend failure,
  and late responses must fail closed.

Changes that weaken these boundaries will not be accepted.

## Development workflow

Use Node.js 24 and install the exact locked dependency tree:

```bash
npm ci
```

Before requesting review, run the production dependency audit and the same
deterministic gates as CI:

```bash
npm audit --omit=dev --audit-level=high
npm test -- --run
npm run typecheck
npm run lint
npx --no-install prettier --check \
  ".github/workflows/ci.yml" \
  "src/**/*.ts" "src/**/*.css" "src/taskpane/taskpane.html" \
  "test/**/*.ts" "test/**/*.css" "test/harness/harness.html" \
  "scripts/**/*.js" "*.{js,json,mts}"
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

These commands build local artifacts under ignored output paths. Do not commit
generated `dist/`, coverage or local certificate output.

Do not run protected live tests or make requests to private infrastructure
without explicit authorization from its operator.

## Keep changes reviewable

- Solve one bounded problem per change set.
- Do not mix unrelated refactors, dependency upgrades, generated output, or
  formatting changes into a functional change.
- Preserve strict TypeScript and the existing vanilla HTML/CSS approach unless
  an approved architecture decision says otherwise.
- Add tests for acceptance contracts and realistic regressions.
- Update documentation in the same change when behavior, configuration,
  compatibility, or support claims change.
- Do not commit `dist/`, development certificates, local settings, logs, test
  captures, credentials, or real legal/client content.

## Pull request checklist

A reviewable pull request should state:

- the problem and intentionally limited scope;
- user-visible and architecture impact;
- exact verification commands and results;
- changed manifests, permissions, routes, dependencies, or third-party code;
- security, privacy, and document-boundary considerations;
- runtime evidence when behavior depends on Word; and
- known limitations or follow-up work.

CI must pass on the exact pull-request head before merge. A preview deployment,
screenshot, older commit result, or local claim is not a substitute.

## Professional conduct

Keep technical discussion specific, respectful and focused on evidence. Do not
publish another person's private information, client material or credentials.
Maintainers may edit or remove content that is abusive, discriminatory,
threatening, unlawfully revealing or unrelated to the project. Repeated or
serious violations may result in participation restrictions.

## Third-party material

Record the exact upstream source, immutable version or commit, license, and
required notice for copied or materially adapted code and assets. Update
[Upstream sources](docs/UPSTREAM_SOURCES.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md) in the same change.

## Issues and security

Use synthetic examples. A useful issue contains a concise expected/actual
description, minimal reproduction, exact client and browser, manifest/build
identity, and a sanitized error code.

Never post client documents, selected text, generated legal answers, personal
data, API keys, access tokens, cookies, private host details, or screenshots
that expose them.

Report suspected vulnerabilities privately under [SECURITY.md](SECURITY.md),
not in a public issue.
