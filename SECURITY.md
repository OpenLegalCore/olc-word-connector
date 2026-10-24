# Security policy

OpenLegalCore Word Connector handles document context, provider credentials and
model output across several trust boundaries. This policy explains which
releases are supported, how to report a vulnerability and what responsible
testing means for this repository.

## Supported releases

`v0.1.0-beta.1` is the first public release line. A version in that line is
supported only when the repository contains its tag and corresponding GitHub
Release. Candidate commits and private builds remain unreleased.

| Release line                                              | Security support |
| --------------------------------------------------------- | ---------------- |
| Latest published `0.1.x` beta                             | Supported        |
| Earlier betas, development snapshots and unofficial forks | Not supported    |

A later release notice may replace this policy for a newer line. Operators of a
fork or modified deployment are responsible for the changes they introduce.

## Report a vulnerability privately

Do not open a public GitHub issue for a suspected vulnerability. Email
[security@openlegalcore.org](mailto:security@openlegalcore.org), preferably
with the subject `Security report: OLC Word Connector`.

Include only what is needed to reproduce and assess the issue:

- affected release, commit, manifest, route or component;
- expected and observed behavior;
- impact and required preconditions;
- minimal reproducible steps or a proof of concept using synthetic data;
- suggested mitigation, if available; and
- a safe way to contact you and whether you want public credit.

Do not send client documents, selected text, generated legal answers, personal
data, credentials, access tokens, cookies or private infrastructure details.
Redact captures and use synthetic content. If sensitive detail is essential,
first request an agreed secure channel.

Reports are reviewed privately, clarification is requested when needed and
disclosure is coordinated after a safe fix or mitigation is available. The
project does not promise a response time.

## Security boundary

| In this repository's scope                       | Outside this repository's scope                           |
| ------------------------------------------------ | --------------------------------------------------------- |
| Connector source and browser bundles             | A separately operated hosted service                      |
| Office manifests and build configuration         | Operator identity, DNS, logging and retention policy      |
| Generic same-origin gateway example              | Private staging or production infrastructure              |
| Maintained tests and release artifacts           | OLC Engine and legal-source databases                     |
| Documentation that changes the security boundary | Microsoft 365, Cloudflare and other third-party platforms |

Production browser code uses only same-origin routes. OLC Engine Bearer
credentials, private upstream origins and Cloudflare Access service
tokens belong only in the trusted gateway. The Engine Bearer is distinct from
the Access service-token pair and must never enter the task-pane bundle,
browser storage, manifest, URL or logs.

The new OLC-72 Word-session boundary verifies the human Access JWT at a separate
server authorization endpoint and uses S256 PKCE with atomically consumed codes.
A Word-scoped opaque capability (max 15 minutes) exists only in pane memory and
its server record supports revocation. It is never forwarded to Engine. The
same-origin API is reachable without an iframe cookie but every protected
operation requires this capability. No broad Access bypass or disabling of the
old protected gateway is part of the design. See [architecture](docs/WORD_SCOPED_SESSION.md)
and [prepared activation](docs/WORD_SESSION_STAGING.md). This is not a declaration
that the owner's individual Access incident is resolved or Word-qualified.

The local OLC-72 document proposal candidate treats proposals as untrusted plain
text, separate from the explanation. Only an explicit click after successful
completion may invoke its one-shot writer. Replacement checks the retained
original selection, text and OOXML; insertion requires an empty cursor. No HTML,
OOXML or whole-body writes are allowed. Unconfirmed Word writes must never be
retried automatically. Activation of the locally integrated Engine profile and native Word
qualification remain pending; see [the proposal contract](docs/WORD_DOCUMENT_PROPOSAL.md).

A report may cross more than one boundary. Send connector findings here; also
notify the responsible operator or upstream maintainer when their system is
independently affected. This policy does not authorize testing of private or
third-party infrastructure.

## Responsible testing

- Test only systems and data you own or are explicitly authorized to test.
- Do not bypass access controls, perform social engineering, persist in an
  environment, degrade availability or access another person's data.
- Use the smallest safe request volume and stop immediately if non-public data
  is exposed.
- Preserve evidence without copying more sensitive data than necessary.
- Give maintainers a reasonable opportunity to investigate and remediate
  before public disclosure.

## Handling and disclosure

We will validate the report, identify the affected boundary, coordinate a fix
or mitigation where the project is responsible, and communicate material
status changes to the reporter. Public disclosure and credit will be
coordinated where practical after users have a reasonable remediation path.

This project does not currently operate a bug-bounty program. This policy
does not grant access to private systems or waive applicable licenses, service
terms or law.

The project-wide reporting policy is published at
[openlegalcore.org/security](https://openlegalcore.org/security/).
