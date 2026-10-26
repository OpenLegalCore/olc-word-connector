# Word Connector repository instructions

Read [current status](docs/STATUS.md), [technical guide](docs/TECHNICAL_GUIDE.md),
[integration](docs/INTEGRATION.md), [proposal boundary](docs/WORD_DOCUMENT_PROPOSAL.md)
and [documentation map](docs/DOCUMENTATION-MAP.md) before planning a change.
The owner's current explicit instruction takes precedence. Legacy v0.1/P3 plans
from another checkout are historical; they are not present governing files in
this source tree. Do not silently import them or reinterpret an unresolved
product decision; name the conflict and seek the missing decision.

## Preserved boundaries

- Send only the exact explicit selection and instruction; never the whole document.
- Preview a separately validated proposal before any explicit Apply. Fail closed
  on changed selection/target; no fuzzy match or implicit occurrence selection.
- Cancellation, timeout, session/backend/validation failure and late results leave
  Word unchanged. No automatic completion replay or backend fallback.
- Keep OfficeWordAdapter independent of HTTP, controller independent of Office.js
  and provider transport, gateway independent of Word mutation, and view independent
  of credentials. Use strict TypeScript and the existing vanilla UI.
- Treat output as untrusted plain text. Do not post user text, generated legal
  answers, credentials, private origins or diagnostic contents to Git or trackers.
- Engine is the sole current backend. Credentials stay in the trusted backend;
  Microsoft identity, Word capabilities and Engine bearer are different authorities.
- Preserve accepted Word SSO and shared Engine behavior for Studio/LWS. Untouched
  client files alone are not proof of preservation after a shared Engine change.

## Scope and review

Inspect root/origin/branch/base/status before writing; preserve unrelated local
work. Use a dedicated branch, never reset/clean other work. Push/PR/merge/live
actions require the current owner's explicit authorization. Keep one coherent
goal and update the owning current section, not a series of competing turn logs.
Before and after the change, obtain an independent project review of actual
scope, client preservation and evidence. Tests/review are not owner acceptance.
Keep OLC-74 semantic/native failure open until attributable client acceptance.

For docs-only work verify links/anchors, exact changed paths, git diff --check,
privacy and unchanged source/Workers/manifests/packages/lockfiles. Do not rerun
model or product suites solely for prose. For product work use all gates in
[CONTRIBUTING.md](CONTRIBUTING.md) and exact-head CI before merge; do not weaken
tests or treat a preview deployment as CI. No permission or credential mechanism
is introduced here. Missing privileged evidence remains explicit, without a
password prompt or workaround in a documentation-only task.

Keep historical evidence byte-identical. Source, deployed configuration, manual
acceptance and future target are separate. Final handoff names exact commits,
verification and remaining owners; Done requires explicit owner acceptance.
