# OpenLegalCore Word Connector documentation

This documentation covers the source-only `v0.1.0-beta.1` OpenLegalCore Word
Connector beta: a Microsoft Word task-pane add-in for researching Slovenian
legislation and case law through an operator-configured Open WebUI or OLC Engine
backend.

The repository provides the connector, build and verification tooling, generic
gateway example and public documentation. It does not provide a hosted backend,
legal database, AppSource listing or access to private infrastructure.

## Find the right guide

| You are… | Start here | Then read… |
| --- | --- | --- |
| A legal professional or evaluator | [User guide](USER_GUIDE.md) or [slovenski priročnik](USER_GUIDE.sl-SI.md) | [Product gallery](SCREENSHOTS.md) and [compatibility](COMPATIBILITY_AND_LIMITATIONS.md) |
| Installing locally | [Installation and deployment](INSTALLATION.md) | [Troubleshooting](TROUBLESHOOTING.md) |
| Sideloading into Word for the web | [Word Web sideload](INSTALLATION.md#path-b-word-for-the-web-development-sideload) | [User guide](USER_GUIDE.md) |
| Integrating Open WebUI or OLC Engine | [Backend and gateway integration](INTEGRATION.md) | [Connected deployment](INSTALLATION.md#path-c-connected-self-hosted-deployment) |
| Reviewing architecture or security | [Technical guide](TECHNICAL_GUIDE.md) | [Security](../SECURITY.md), [privacy](../PRIVACY.md) and [upstream sources](UPSTREAM_SOURCES.md) |
| Diagnosing a failure | [Troubleshooting](TROUBLESHOOTING.md) | [Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md) |
| Contributing code or documentation | [Contributing](../CONTRIBUTING.md) | [Technical guide](TECHNICAL_GUIDE.md) and [release policy](RELEASE_POLICY.md) |
| Reviewing future direction | [Roadmap](../ROADMAP.md) | [Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md) and [release policy](RELEASE_POLICY.md) |
| Exploring collaboration | [Partnerships and services](../PARTNERSHIPS.md) | [Support](../SUPPORT.md) and [license](../LICENSE) |

## Product and implementation guides

| Document | What it answers |
| --- | --- |
| [User guide](USER_GUIDE.md) | How to use every workflow state, verify sources and protect document context |
| [Uporabniški priročnik](USER_GUIDE.sl-SI.md) | Celovit slovenski priročnik za uporabnike |
| [Product gallery](SCREENSHOTS.md) | What the bilingual Word interface looks like across six paired workflow states |
| [Installation and deployment](INSTALLATION.md) | How to run a local preview, sideload into Word and prepare a connected self-hosted deployment |
| [Backend and gateway integration](INTEGRATION.md) | Exact Open WebUI and OLC Engine routes, request contract, gateway boundary, identity separation and acceptance checklist |
| [Technical guide](TECHNICAL_GUIDE.md) | How the controller, Office boundary, adapters, prompt envelope, renderer, localization, manifests and builds fit together |
| [Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md) | Which environments and behaviors are verified, untested, excluded or planned |
| [Troubleshooting](TROUBLESHOOTING.md) | How to recover from setup, Word, session, gateway and backend failures without weakening controls |
| [Roadmap](../ROADMAP.md) | What is current, what still needs validation and which directions are exploratory rather than promised |
| [Release policy](RELEASE_POLICY.md) | How versions, source-only scope, release gates and artifacts are managed |
| [Upstream sources](UPSTREAM_SOURCES.md) | Where scaffold, assets and production dependencies came from |

## Repository policies and project information

- [Apache License 2.0](../LICENSE)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)
- [Trademark policy](../TRADEMARKS.md)
- [Privacy](../PRIVACY.md)
- [Security](../SECURITY.md)
- [Support](../SUPPORT.md)
- [Contributing](../CONTRIBUTING.md)
- [Changelog](../CHANGELOG.md)
- [Partnerships and services](../PARTNERSHIPS.md)

## Verified scope at a glance

Word for the web is the verified host for this beta. The accepted walkthrough
covers both provider paths, both document-context modes, safe answer and source
rendering, result actions, cancellation with late-response suppression, secure
session recovery with explicit retry, and an unchanged document. Word for
Windows and Mac remain untested and have no support claim.

The connector is a research interface, not an authoritative legal source or a
substitute for professional judgment. See
[Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md) for the exact
support boundary.
