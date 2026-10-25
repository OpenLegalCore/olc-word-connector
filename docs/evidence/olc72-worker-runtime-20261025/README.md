# OLC-72 actual activation failure, rollback and runtime correction

Starting PR head: `58504bbdb94daf0f14d371baed94c4882d7e7a4f`, tree
`d825bfcacb83804ab0df56084fe7f17dfc4f42b6`. Same PR #2 branch.

## Actual evidence before this correction

The owner confirmed API account types include both organizational and personal
accounts and completed the delivered explicit Microsoft sign-in. The local
receiver independently verified the **real** API token signature/key issuer,
issuer, audience, lifetime, SPA and Word.Access. Only the verified owner identity
and app IDs were saved in a new mode-0600 file; the token stayed in process memory.
No private identity/token is included in these proofs.

After successful exact-head CI, the existing auth/API Workers were uploaded and
activated with preserved old bindings and only four additional Microsoft API
settings. New versions were auth `0ea8304d-3a08-4a4c-af7e-83aa2e2f6dff` and
API `0f76a96d-ce4c-4500-8576-6220bf745aa7`. Their metadata was independently read
and checked against the previous bindings, compatibility date and DO migration tag.

The [actual safe-route probe](first-activation.json) got 401 for missing/invalid
tokens, then **503** for the verified Microsoft token. Models and completions
were not called. The new task pane was **not published**. Both Workers were
immediately rolled back and their active versions reread:

- auth: `cef30f73-3f81-41aa-9782-bad6360fb1a0`;
- API: `3f5511b5-cd03-494f-853c-211b8d22a81e`.

Pages still serves aa5 application bytes plus the isolated enrollment helper.
No Tunnel/cloudflared/DNS/Engine or Word change occurred. The Cloudflare connector
lacked Worker write scope; existing authorized Wrangler versions upload/deploy
was used, without another login and without route/DNS deployment.

## Deterministic cause and correction

A direct local workerd fetch reproduced the exact runtime exception:
`Invalid redirect value, must be one of "follow" or "manual"`.
The same public Microsoft metadata GET with `manual` returned 200. No token was
used in that diagnostic. Node accepts `error`, so the prior Node-level verifier
and mocked-HTTP tests did not exercise this runtime contract.

The new regression bundles the **production** API/verifier/store into real local
workerd, supplies only synthetic signed identity and trusted-discovery fixtures,
and issues a capability through SQLite. Before the correction both tests failed:
503 instead of 200 and no outbound metadata call ([RED](red.txt)). The production
change is only `redirect: "manual"` in trusted metadata fetch. Existing non-OK
and redirected-response checks still reject redirects; no token-directed URL or
redirect destination can be followed. Both runtime cases and eight existing
signature/claims tests now pass ([GREEN](green.txt)). The redirect test verifies
that only the fixed metadata URL was contacted and no capability was issued.

This corrects an actual staging blocker; local workerd results are still
synthetic acceptance. Full gates, exact-new-head CI and actual reactivation/probe
must succeed before publishing the Microsoft task pane. Actual Word startup,
reopen and expiry acceptance remain unperformed at this commit.

All 18 local project gates now exit 0 ([commands](checks.json)); full suite:
**644 passed / one protected-live skip**, 41 passing files. A missing request
parameter annotation in the new test was corrected after the first typecheck;
typecheck and all remaining gates then passed. No dependency or manifest change.
The CI for the new final commit is required before reactivation.
