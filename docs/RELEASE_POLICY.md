# Release policy

This policy defines what constitutes an OpenLegalCore Word Connector release,
which artifacts and claims belong to it, and which evidence is required before
publication.

## Release identity

| Identity | Rule |
| --- | --- |
| Product and Git version | Semantic prerelease version; the first public release is `v0.1.0-beta.1` |
| npm package version | Matches the product version, but the package is marked `private` and is not an npm publication |
| Office manifest version | Independent four-part Office deployment version; it is not the Git release number |
| Source identity | Exact Git tag and commit SHA named in the GitHub Release |
| License | [Apache License 2.0](../LICENSE), subject to third-party notices and trademark policy |

A branch, build, screenshot, private preview, CI run or candidate commit is not
a public release. Publication requires the reviewed public repository state,
an exact version tag and a corresponding GitHub Release.

## Source-only distribution

The beta release contains:

- the Microsoft Word task-pane connector source;
- explicit Open WebUI and direct OLC Engine transport adapters;
- development, staging-template and reserved production Office manifests;
- a generic same-origin gateway example;
- deterministic tests and local development harnesses; and
- public product, installation, integration, technical, privacy, security,
  provenance, contribution and release documentation.

The current product scope is legal-source search over Slovenian legislation and
case law, optionally using only the exact Word selection explicitly submitted
by the user. The connector is a client, not a standalone legal-AI system.

## What a source release does not include

The beta does not include or imply:

- a publicly hosted OpenLegalCore service;
- OLC Engine source, Open WebUI, a model or legal databases;
- private staging, credentials, private origin names or operator configuration;
- Microsoft AppSource or Office Store distribution;
- an uptime or support service level;
- legal advice, warranty or guaranteed retrieval coverage; or
- document editing, redlining, tracked changes or other roadmap functionality.

Possible future work is described, without delivery promises, in the
[Roadmap](../ROADMAP.md).

## Required publication gates

Before creating a public tag or GitHub Release, the owner must confirm on the
exact candidate SHA that:

1. production dependency audit, tests, TypeScript, lint, formatting, manifest
   validation, every maintained build and production-bundle isolation pass;
2. the public tree contains no credential, private topology, internal project
   log, raw client material, generated build output or obsolete release file;
3. third-party licenses, notices, provenance and locked production dependency
   versions match the distributed source and browser bundle;
4. the supported Word-client walkthroughs pass, including cancellation with
   late-response suppression and secure session recovery with explicit retry;
5. the Word document remains unchanged throughout the accepted beta workflow;
6. README, guides, screenshots, repository metadata, release notes, support
   claims and version identities are mutually consistent; and
7. repository visibility, tag creation and GitHub Release publication are each
   explicitly authorized.

Protected live tests and manual Word-client acceptance are evidence gates, not
ordinary CI steps. A result from another commit or environment cannot substitute
for the required evidence.

## Release contents and notes

Each GitHub Release should identify:

- the exact tag, commit SHA, product version and Office manifest version;
- supported and explicitly untested Word clients;
- included provider and legal-source scope;
- security- or privacy-relevant changes;
- known limitations and migration requirements;
- verification results for the released SHA; and
- checksums for any separately downloadable release artifacts.

The Git tag is the source identity. Generated artifacts must be reproducible
from the committed lockfile with Node.js 24 and must not be committed to the
source tree unless a later policy explicitly changes that rule.

## Support and compatibility

The latest published `0.1.x` beta is the only supported public line unless a
later release says otherwise. Word for the web is the verified client for the
first beta. Word for Windows and Word for Mac remain untested and unsupported
until client-specific evidence exists.

Backend, retrieval and legal-source claims remain qualified by
[Compatibility and limitations](COMPATIBILITY_AND_LIMITATIONS.md). Security
handling follows [SECURITY.md](../SECURITY.md), and product support follows
[SUPPORT.md](../SUPPORT.md).
