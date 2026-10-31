# OLC-74: observed one-time sideload attempt

The owner approved one new lease and observed attempt using server commit
`c86c57516fd2490086700fcbb5eb326384fae472`. The 28 candidate hashes, CA
fingerprint and localhost certificate chain were checked. The prior restored
journal was archived with an independently copied and verified matching hash.

With process-only CA trust, the control client received a complete HTTP 200
manifest with SHA-256
`c2ec4f5123d3b531142e9b87dbfe15a1a7d5637d9a3f180a131ccc75aea4ece3`.
Its connection ended before the observation boundary. After the watchdog started,
the approved CA was imported once and observation began. The separate synthetic
Word document was opened using the prepared sideload URL.

Before cleanup, the observation log recorded **one completed TLS handshake**,
but no HTTP request. The phase alone does not identify that connection's client.
Word displayed the test document but no registration confirmation, local
read-only pane or visible registration error. No Yes was clicked. Supported
console inspection yielded 21 warning/error entries, none matching the limited
manifest, TLS, network or CORS categories searched; this does not exclude an
unexposed error. The cause of the missing dialog and HTTP request is undetermined.
No manifest delivery or acceptance by Word was established. No XML capture,
XML comparison, product Apply or product fix occurred. This is separate from
the earlier owner-reported diagnostic and the historical failed Apply.

Guarded removal returned `restored`, with other NSS records unchanged and the
target CA certificate, nickname and trust object absent. The independent watchdog
confirmed restoration within 23.680 seconds of the 300-second limit. A fresh
Chrome `localhost:3002` navigation rejected the certificate with
`ERR_CERT_AUTHORITY_INVALID`, while a fresh `127.0.0.1:3002` navigation loaded
the test page; the reason remains undetermined. The later task-pane and asset
requests in the same server log came from that explicit post-cleanup IP test,
not an identified Word add-in. The local server was stopped and only test tabs
were closed. No repeated import, staging-button substitute, cache removal,
Engine, staging manifest or SSO change occurred. Development registration
status remains unverified; OLC-74 stays open.
