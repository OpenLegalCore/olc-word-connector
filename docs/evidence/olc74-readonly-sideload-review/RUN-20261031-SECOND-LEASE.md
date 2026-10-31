# OLC-74: second approved read-only sideload attempt

The owner approved a single new CA lease and the visible Microsoft registration
confirmation for the reviewed candidate at `964332edf44afeb622ee01931e63b165a5dd970c`.
The synthetic Word test document was open in the existing Chrome session. The
previous restored trust journal was archived only after verifying the target CA
was absent and an independently preserved copy had identical SHA-256. No prior
journal or evidence was overwritten.

Before import, the reviewed v2 scripts and candidate hashes were verified. The
reviewed HTTPS server served the manifest over `127.0.0.1:3002` using CA trust
limited to the curl process; the response SHA-256 was
`c2ec4f5123d3b531142e9b87dbfe15a1a7d5637d9a3f180a131ccc75aea4ece3`.
The independent watchdog was active before importing the approved CA fingerprint
`620f860685c263a16c2b5608804fb24c53fb274305137e481cfcb251fbe2000f` into the
specified per-user NSS store.

The Microsoft dialog identifying that local manifest was confirmed with Yes.
The Word ribbon then displayed one `Open OpenLegalCore` action; opening it showed
**OpenLegalCore for Word (Staging)**, not the reviewed localhost read-only
exporter. No diagnostic capture was made, no XML triple was acquired, and no XML
difference or product fix can be inferred. Confirmation alone does not prove
that the development add-in was registered or loaded. A remaining development
registration is possible and its status is unverified; no registration or cache
was removed. No screenshot of a diagnostic exporter exists for this run.

Guarded cleanup returned `restored`, with both preservation checks for other NSS
entries true. A read-only NSS check found no target certificate, nickname or CA
trust object; the pre-existing certificate count was one. The independent
watchdog reported confirmed removal in 26.149 seconds, within the 300-second
limit. During the remaining server lifetime Chrome rejected a fresh
`https://localhost:3002/taskpane.html` navigation with
`ERR_CERT_AUTHORITY_INVALID`. A fresh tab navigating to the `127.0.0.1` variant,
however, loaded the page after NSS removal; the reason is undetermined and
Chrome rejection for that address is **not verified**. The server was stopped,
and the test document and test TLS tabs were closed. The original Word document
and staging pane were not modified.

The earlier owner-reported new diagnostic capture had same location and text
but nonmatching OOXML; it is separate from both this unsuccessful attempt and
the historical Apply incident. No Send, model request, product Apply, product
delivery, Engine, staging manifest or SSO change occurred. OLC-74 remains open.
