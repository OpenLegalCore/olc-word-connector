# Roadmap

OpenLegalCore Word Connector begins with a deliberately narrow promise:
verifiable Slovenian legal-source research beside a document, with explicit
control over document context and no document mutation.

This roadmap shows intended directions, not delivery dates or contractual
commitments. A capability becomes supported only after it is implemented,
documented and accepted with evidence. The current support boundary remains
authoritative in
[Compatibility and limitations](docs/COMPATIBILITY_AND_LIMITATIONS.md).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Current beta** | Implemented in `v0.1.0-beta.1` and subject to its documented limitations |
| **Validation priority** | Existing or proposed work that still needs bounded implementation or client-specific evidence |
| **Exploration** | A product direction under consideration; no release or support commitment |
| **Separate initiative** | Related OpenLegalCore work with its own architecture, evidence and release decision |

## Current beta

The first source-only beta is centered on:

- Microsoft Word for the web;
- Slovenian legislation and case-law research through an explicitly selected
  Open WebUI or OLC Engine backend;
- **No document context** or only the exact **Selected text**;
- safely rendered answers and restricted legal-source links;
- English and Slovenian task-pane interfaces; and
- cancellation, timeout and secure session-recovery paths that leave Word
  unchanged.

The beta is a connector, not a hosted legal-research service, legal database or
document-editing system.

## Validation priorities

| Direction | Current boundary |
| --- | --- |
| Word for Windows | Not tested and not supported until a client-specific acceptance run passes |
| Word for Mac | Not tested and not supported until a client-specific acceptance run passes |
| Persistent interface-language preference | The current language choice is runtime-only; persistence needs an explicit privacy and storage design |

These items do not block the source-only Word Web beta unless a later release
decision explicitly changes that boundary.

## Distribution and operated-service exploration

Possible future delivery work includes:

- a separately governed hosted service with explicit identity, security,
  privacy, retention, logging and operational ownership; and
- Microsoft AppSource or Office Store distribution after client compatibility,
  packaging, support and policy requirements are independently satisfied.

Neither is included in `v0.1.0-beta.1`. Source availability does not imply a
hosted endpoint, service level or marketplace listing.

## Legal-workspace exploration

Longer-term product directions include:

- distinct **Analyze** and **Draft & edit** workspaces;
- explicit jurisdiction, time and represented-party controls;
- legal literature and operator-authorized internal sources;
- drafting, redlining and tracked changes;
- playbooks and reusable templates;
- whole-document and multi-document workflows; and
- anonymization, translation and structured table work.

Each direction requires its own document-access contract, privacy boundary,
failure behavior, backend capability and cross-client evidence. None is an
implemented or supported beta feature.

## Related OpenLegalCore initiatives

The following are adjacent explorations, not commitments of this Word
Connector repository:

- a contextual legal-reference assistant;
- a separately designed LibreOffice connector; and
- optional voice or Whisper-based transcription.

They may share principles or integration contracts, but each needs independent
scope, implementation, security review and release evidence.

## Decision principles

Roadmap work must preserve five project rules:

1. document access is explicit, minimal and visible to the user;
2. provider and operator boundaries remain explicit;
3. legal-source, temporal and provenance claims are verifiable;
4. failures are controlled and do not silently mutate the document; and
5. public capability claims follow evidence rather than plans.

See the [release policy](docs/RELEASE_POLICY.md) for publication gates. Focused
technical contributions are welcome under
[CONTRIBUTING.md](CONTRIBUTING.md); integration and research collaboration is
described in [PARTNERSHIPS.md](PARTNERSHIPS.md).
