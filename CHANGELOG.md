# Changelog

All notable public changes to OpenLegalCore Word Connector are recorded in this
file. The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

No changes have been accepted beyond the first beta release candidate.

## 0.1.0-beta.1

First public source-only beta of the OpenLegalCore Microsoft Word legal-source
connector.

### Added

- A bilingual English and Slovenian task pane for Word for the web.
- Explicit Open WebUI and direct OLC Engine provider selection, with no
  automatic fallback or credential sharing.
- No-document-context and exact-selected-text research modes.
- Slovenian legislation and case-law questions with safely rendered answers,
  constrained source links and copy, refine and new-search actions.
- Local UI and Word harnesses, development and deployable manifest templates,
  a generic same-origin gateway example and isolated build targets.
- Installation, user, integration, technical, compatibility, troubleshooting,
  privacy, security, provenance, contribution, support and roadmap
  documentation.

### Security and privacy

- Provider and private-origin credentials remain server-side; production
  browser bundles reject credential-bearing and development-only material.
- Only the document context explicitly selected by the user can be submitted.
  The search workflow does not change the Word document.
- Model output is treated as untrusted text, and only approved credential-free
  legal-source links can become clickable.
- Cancellation, timeout, validation failure, backend failure and session expiry
  fail closed. Late responses after cancellation are suppressed.

### Verified

- The complete documented Word for the web workflow was accepted against the
  release candidate, including cancellation with late-response suppression and
  session expiry followed by secure sign-in and an explicit retry.
- The Word document remained content-identical throughout the accepted runtime
  scenarios.
- Automated gates cover production dependencies, tests, TypeScript, lint,
  formatting, Office manifests, every maintained build and production-bundle
  isolation.

### Known limitations

- This is source code, not a hosted OpenLegalCore service, backend, legal
  database or Microsoft AppSource/Office Store package.
- Word for Windows and Word for Mac are untested and unsupported in this beta.
- Retrieval coverage, historical validity and answer quality depend on the
  configured backend and its legal data; authoritative sources and professional
  judgment remain necessary.
- Document editing, redlining, tracked changes and other future directions are
  outside this release. See [ROADMAP.md](ROADMAP.md).
