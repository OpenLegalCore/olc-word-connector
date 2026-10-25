# OLC-72 Microsoft staging delivery — actual evidence

Microsoft SSO staging is activated. **Owner Word Web acceptance for pane reopen
and post-idle access verification: MANUAL PASS (2026-10-25).** This completes
the observed Microsoft SSO access objective for those scenarios; it is neither
automated evidence nor proof of a particular internal recovery mechanism.
Acceptance of document proposals is a separate OLC-74 decision.

## Delivered versions and gates

[Source edfaf1d](https://github.com/OpenLegalCore/olc-word-connector/commit/edfaf1dc3367cdd76c24ee9e176efb6bff2cedf8)
passed [CI / validate, every step](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40161303969)
before Pages activation. [Delivery record](delivery.json) lists exact source/tree,
Pages and Worker versions. [Artifact hashes](artifacts.json) cover the reviewed
package; only `_headers` changed from the preceding Pages candidate. The manifest,
application JavaScript, icons and CSS were preserved during this final correction.

[Actual HTTP comparisons](http.json): **69/69 byte matches**, across the custom,
canonical and immutable Pages hosts. All three authentication documents have
`no-store`, the reviewed Microsoft CSP and no X-Frame-Options after `.html`
canonicalization. Public configuration matches the two real staging registrations.
Cloudflare's project readback confirmed Pages deployment
`7e4bcdfe-11ff-4d61-9789-80962046e5b1`, source `edfaf1d`, successful deployment.
Worker deployment readback confirmed both recorded versions at 100%.

The actual owner API-token probe passed issuance/session/models/revocation and
rejected missing/invalid/revoked credentials; see [real API statuses](../olc72-worker-runtime-20261025/successful-api.json).
The first activation's 503, actual rollback, deterministic Workers-runtime RED/GREEN
regression and successful corrected activation are [recorded separately](../olc72-worker-runtime-20261025/README.md).
Synthetic signature/claims/account-denial tests are not evidence of another real
account or actual Word NAA. No completion request or Word write was made.

## Owner Word Web acceptance — 2026-10-25

The owner reported the following observations in the existing Word Web session:

| Scenario | Result | Evidence and scope |
| --- | --- | --- |
| Repeatedly close the task pane with **X**, then reopen it with the Word ribbon button | **MANUAL PASS** | The connection returned and the form was usable. This records the observed result only; it does not establish the internal recovery path. |
| Leave the pane open through the agreed idle interval (over 16 minutes), then use **Settings → Check connection** without closing it | **MANUAL PASS** | The owner confirmed “deluje” (works). Screenshot `image(20261025-084628).png` shows the successful check and “Sporočilo ni bilo poslano” (message was not sent). This is manual access verification, not an automated test. |
| Preserve a nonempty draft, selected language and selection attachment during that post-idle check | **NOT_RUN** | The owner did not confirm preservation of these values in this check. No pass is inferred from the successful access result. |
| Repeat the idle check with the selection attachment removed | **NOT_RUN** | No owner result was provided for this second idle interval. |
| Whether Microsoft or Cloudflare showed an interactive sign-in during each reported scenario | **NOT_RUN** | The owner did not report this detail; no absence of an interactive prompt is inferred. |
| Actual `NestedAppAuth` support and loaded task-pane script/version | **NOT_RUN** | No runtime diagnostic was captured; no implementation mechanism is inferred. |
| Unsupported-host fallback/cancellation and denial of a second account | **NOT_RUN** | Not exercised in this acceptance. |

The manual pass is limited to pane reopen and post-idle access verification. It
does not accept proposal behavior, insertion/replacement, or any OLC-74 Engine
semantics. OLC-74 proposal acceptance remains separate. The task pane reported
that no message was sent; this acceptance involved no provider completion or
Word document write.

## Owner Word acceptance protocol

The manual observations above supersede only the reopen and one post-idle
access-check rows of this protocol. Remaining unperformed checks stay
`NOT_RUN`. Automation cannot access the owner's Chrome browser (`Browser is not
available: chrome`); the attempted IAB surface also failed. No replacement
browser, login or new chat is required. The existing signed-in Chrome Word tab
and approved installed manifest were used by the owner.

1. Reopen OLC and report Connecting → usable form, any Microsoft action/consent,
   and whether Cloudflare appeared. Interaction must start only after the owner's
   explicit Microsoft button. Do not click Send or Apply.
2. Record actual NAA requirement support and loaded taskpane script, if accessible
   in the add-in frame's DevTools console using only the read-only diagnostic below.
3. Enter a fictional multiline draft in the **add-in**, choose EN/SL, and retain an
   existing fictional selection attachment. Do not type into or modify Word.
   Leave the pane idle for over 16 minutes after the last access. In Settings use
   Check connection once. Report silent recovery and preserved draft/language/
   attachment, no automatic popup/send/write. If no existing fictional selection
   is available, mark the attached-selection case NOT_RUN.
4. Remove the attachment in the add-in, leave another over-16-minute idle interval,
   then repeat the safe Settings check. Report the selection remains removed.
5. Separately close and reopen the pane. Report silent usable form. A destroyed
   pane does not persist its draft; open-pane retention and reopening are distinct.

```js
JSON.stringify({
  naa: Office.context.requirements.isSetSupported("NestedAppAuth", "1.1"),
  host: Office.context.host,
  platform: Office.context.platform,
  scripts: [...document.scripts].map(s => s.src).filter(s => /taskpane\./.test(s))
})
```

This diagnostic reads no tokens, account identifiers or document content. Do not
copy storage, network authorization headers or tokens. Capture owner outcomes as
manual evidence, not automated PASS. Unsupported-host fallback, cancellation and
actual second-account denial remain NOT_RUN unless genuinely exercised.

## Recovery and scope

The aa5 rollback Pages/Worker versions and private recovery artifacts are retained;
the earlier failed activation already demonstrated restoration of both Workers.
Follow [coordinated rollback](../../MICROSOFT_SSO_STAGING.md#rollback-to-the-working-aa5-delivery).
No credentials, owner principal or private Engine origin are published. Tunnel,
cloudflared, DNS, local Engine, outbound-only connectivity and original checkout
edits remain unchanged. No merge or Engine content work is part of this delivery.
