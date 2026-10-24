# OLC-72 Word-session qualification — 2026-10-24

This is **new offline evidence**, separate from the retained historical
[Access incident records](../olc72-access-20261024/README.md). Base:
`d419b477c527f5437e5a32429c7b7f19319f0a20`. The implementation commit containing
this record supplies the immutable source identity; exact code/configuration
fingerprints are in [source-files.json](source-files.json).

- [Validation](validation.json): 608 passing tests, one opt-in protected live
  skip, all 16 local contribution gates, production audit zero vulnerabilities.
  New Miniflare-only overrides remove its new vulnerable transitive versions;
  existing Office development-tool findings remain outside this change.
- [Browser result](browser-results.json): real isolated headless Firefox 157,
  actual staging production bundles, **all cookies blocked**, intercepted
  synthetic HTTPS origins, synthetic Office/Access/model discovery and a real
  local workerd SQLite Durable Object. PKCE login, open-pane expiry recovery and
  new-pane login pass. Draft/locale/removed attachment survive recovery.
  First-party identity is synthetic; this does not qualify the real Access IdP.
- [Artifact SHA-256](artifact-sha256.json): prepared Pages/Worker artifacts only, no
  credential hashes. The public `example.invalid` source-template checksum is
  separate from the preserved real-domain deployed manifest in the package. Manifest, CSP and accepted CSS are unchanged. Production
  bundles contain no Storage Access recovery implementation.
- [280 px runtime capture](runtime-280px.png): synthetic draft only; no real Word
  document or personal content. It is qualification evidence, not a new owner
  visual acceptance.
- [Reproduction driver](../../../scripts/check-word-session-browser.js) and
  [staging sequence](../../WORD_SESSION_STAGING.md).

No actual Word surface was connected: **WORD: NOT_RUN**. No real identity login,
provider completion, Word write, deployment, Access mutation, DNS/routing change
or merge is represented by these results. The owner's individual failure cause
remains unproven. Previous functional/visual PASS is historical and unchanged.
Raw local diagnostics and private runtime/rollback mapping are not published.
