# OLC-72 concurrent 401 recovery — 2026-10-25

**IN REVIEW / NOT ACTIVATED.** Primary OLC-72 outcome remains removal of repeated
Cloudflare user sign-ins after idle time or pane reopen. This follow-up fixes a
client-side renewal race; it does not qualify real Microsoft/Word acceptance.

## Baseline and preserved state

- Branch: `codex/olc-72-word-native-sse`, existing draft [PR #2](https://github.com/OpenLegalCore/olc-word-connector/pull/2).
- Reviewed starting head: `e8e247e5f128e5d139b753920fdfc65573f28488`.
- Starting tree: `0610ae537c79c0990052e1b13cdb503596b4052f`.
- PR base: `603585a195180f535674126803cb570c086b4523`.
- Recovery ref: `recovery/olc72-before-concurrent-401-20261025` at the starting head.
- Original checkout's two documentation edits, other clones/recovery packages,
  working delivery `aa5d369`, rollback, windows/processes and live authentication
  are preserved. No Tunnel/cloudflared/DNS/local Engine changes, inbound
  connections or port forwarding.

## Deterministic RED then GREEN

Two original protected GETs are held using deferred responses. Both capture the
same synthetic capability A. The first 401 starts a forced **silent** renewal;
Microsoft acquisition is held. The second original 401 is then released. An
explicit event-loop turn drains its response handler before renewal is released.
The assertion requires only the two original requests to have been sent.
No wall-clock delay or external identity service controls this ordering.

Before changing production source, this command exited **1** with **2 failures**,
one for each original response order:

```sh
npm test -- --run test/taskpane/MicrosoftSessionRenewal.test.ts -t 'shares renewal when'
```

The observed third request had `Authorization: Bearer undefined`. The production
file was verified unchanged from the reviewed head with `git diff --exit-code --
src/taskpane/WordSessionClient.ts` (exit 0) before that RED run. All capability and
Microsoft-token values in these tests are synthetic.

After correction, this command exited **0**, **20 tests PASS** in two files:

```sh
npm test -- --run test/taskpane/MicrosoftSessionRenewal.test.ts test/taskpane/WordSessionClient.test.ts
```

Covered contracts:

| Scenario | Result |
| --- | --- |
| Both original 401 orders during deferred renewal | Both wait, one forced silent renewal, both retry with capability B |
| Delayed original 401 after renewal | Reuses B, no additional forced renewal |
| Microsoft acquisition rejected | Both receive the same failure; neither GET replays |
| Capability exchange rejected | Both receive ACCESS_DENIED; neither GET replays |
| Either waiter cancelled while renewal held | Prompt CANCELLED; other waiter still succeeds; cancelled request never replays |
| Delayed retry 401 after capability C installed | ACCESS_DENIED for that request; C remains usable without another exchange |
| Retry also returns 401 | At most one GET retry, bounded ACCESS_DENIED |
| Completion POST returns 401 | No completion replay |
| Interaction policy | Every acquisition above is noninteractive; no popup introduced |

The fix only changes `WordSessionClient`: join an existing renewal when the
rejected capability has already been removed, validate the retry capability, and
invalidate a failed retry only if its capability is still current. No auth
server, infrastructure, routes, dependencies, manifest or Word adapter changed.

## Required gates and review

[verification.json](verification.json) records exact commands, exit codes and
source hashes, including RED/GREEN and all 18 contribution commands. Full tests
run with `OLC_WORD_LIVE_OLC_ENGINE=0`; the opt-in live test remains skipped.
Exact-head GitHub CI must be checked after publishing; a previous head's success
is not evidence for this fix. The final PR/issue handoff records the resulting
head/tree and CI run, avoiding a self-referencing commit SHA in this file.

Review scope is limited to this client, its regression file, STATUS and this
evidence directory. The final diff is checked for unrelated files, secrets,
content logging, persistent credentials, document mutations and boundary changes.
Only those paths are explicitly selected for commit.

## Actual Entra access check

This is a fresh read-only availability check, not repeated registration setup:

- Available tool inventory contains no Entra/Microsoft Graph application or
  service-principal inventory operation.
- Plugin catalog searches for `Microsoft Entra` and `Microsoft Graph application
  registrations directory inventory` returned no directory-management connector.
  Uninstalled Teams/SharePoint/Outlook/Power BI connectors do not supply this
  capability. No plugin was installed or reconnected, and no sign-in was started.
- Local executable checks found no `az`, `mgc` or `pwsh`.
- Actual directory API query: **NOT_RUN — no supported authenticated connection**.
  Appropriate SPA/API registrations: **UNKNOWN**. Their absence is not asserted.

The concrete missing capability is an authenticated Microsoft Graph/Entra
connection to the relevant directory with permission to read application
registrations. Microsoft's [v1.0 List applications contract](https://learn.microsoft.com/en-us/graph/api/application-list?view=graph-rest-1.0)
lists `Application.Read.All` as the least privileged read permission; listing
apps owned by a personal account additionally requires `User.Read`. Appropriate
account/directory rights and consent must exist on that connection. This is an
operator inventory permission, **not** a new permission for the Word add-in.
No write permission is needed to inspect whether the two registrations exist.

No actual Word/NAA, Microsoft tenant consent, live activation, provider completion
or document write was performed or marked PASS. Existing accepted owner evidence
and all prior prepared registration/rollback documentation remain unchanged.
