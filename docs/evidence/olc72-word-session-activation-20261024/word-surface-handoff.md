# Actual Word acceptance continuation — 2026-10-24

**This continuation: BLOCKED at browser-surface connection. No new Word PASS.**

The reviewed [activation report](README.md) at documentation commit
`a09b41998dce8a27eba035fc83b65d15482208ff` was read. Delivered implementation
`aa5d369f3e99067e8059a50fdd99f22535ca9810` remains the expected candidate;
its identity inside Word was not observed in this continuation. Staging
activation, OAuth, Access login and infrastructure changes were not repeated.

## Direct observations in the replacement chat

- `cua.getState()` returned `apps: []` and two browser surfaces:
  **Codex In-app Browser** (`iab`) and **Codex MCP Apps** (`mcpapps`).
  Both returned `tabs: []`.
- Binding the owner's existing `https://word.cloud.microsoft` tab through
  `cua.getTab({url: "https://word.cloud.microsoft"}, {browser: "2"})`
  returned **Tab not found in browser 2**. No tab was created or navigated.
- Document Control `list_document_sessions({surface: "word"})` returned
  **No connected Codex document sessions were found**, with `executors: []`.
- A later `cua.getState()` again returned the same two surfaces with no tabs.

The owner reported an already signed-in Word welcome page in the visible right
browser panel of the earlier chat. That report is retained; this continuation
could not independently inspect that panel or its screenshot. Empty inventory
in this chat does not show that the existing tab is closed or signed out, and
does not establish a Microsoft, Access or add-in authentication failure.

## Requested acceptance matrix for this continuation

| Scenario | Result | Reason |
| --- | --- | --- |
| Create a blank test document in the existing signed-in tab | NOT_RUN | Existing tab is not exposed to this chat |
| Load/reuse the approved manifest and verify the loaded artifact | NOT_RUN | No observable Word document or pane |
| Native Office sign-in dialog and callback | NOT_RUN | No reachable Word host |
| Usable signed-in form with session/model discovery only | NOT_RUN | No reachable Word host |
| Known expiry/revocation and explicit access recovery | NOT_RUN | No Word session was created or observed |
| Retain synthetic multiline draft, locale and removed selection in the open pane | NOT_RUN | No reachable pane; no synthetic substitute run |
| Dialog cancellation | NOT_RUN | No reachable native Office dialog |
| Separate pane close/reopen and new explicit login | NOT_RUN | No reachable pane; the prior windows remain untouched |

The functional owner report already recorded in [draft PR #2](https://github.com/OpenLegalCore/olc-word-connector/pull/2)
and [OLC-72](https://linear.app/openlegalcore/issue/OLC-72/word-connector-native-sse-engine-priklop-in-varen-task-pane-prikaz)
is accepted as evidence of the owner's reported working flow. It is not
withdrawn or converted to NOT_RUN. It does not separately identify the loaded
artifact or qualify the exact edge cases above. The separate Engine content
issue remains tracked by OLC-74; no Engine investigation was performed here.

## Minimum next step and preserved boundaries

Expose or attach the **same existing signed-in Word tab** to this replacement
chat through a supported browser connection. If the UI permits moving its
existing browser panel here, use that existing panel. A new Microsoft login,
separate invisible browser or another staging activation is not requested.
The operator can then create the blank document and run the matrix above using
the existing approved manifest. A screenshot alone cannot operate the tab.

No Send action, completion request, document write, deployment, Cloudflare
change, OAuth consent, merge, process termination or window/tab closure was
performed. The original checkout and its two existing documentation edits were
left untouched. Documentation synchronization uses an isolated temporary clone
of the existing PR branch; prior checkouts and recovery packages are retained.

OLC-72 and PR #2 remain **IN REVIEW**. This is a tool-connection limitation,
not evidence that the deployed session/API fails; no rollback trigger was
observed.
