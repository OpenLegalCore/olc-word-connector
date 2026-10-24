# OLC-72 — očiščeni obstoječi dokazi

Glej [poročilo o sinhronizaciji](../../OLC72_SYNC_REPORT_20261024.md).
Datoteke so projekcije ohranjenih zapisov. Nobeno funkcionalno preverjanje ni
bilo izvedeno zaradi te objave. Zasebni izvirniki niso premaknjeni ali prepisani.

## Javno pregledljive datoteke

- [Zabeležena dostava in anonimni GET-i](recorded-checks.json): SHA, javni Pages
  deployment in rollback, statusi, javni asset hashi, nespremenjene kategorije.
- [Zabeleženi sintetični brskalniški rezultati](recorded-browser-results.json):
  izrecna razlika med generic cookie fixture in dejanskim produkcijskim JS z
  Office/identity stubi; nobena postavka ni Word PASS.
- [Obstoječi CI in lokalni gates](recorded-validation.json): rezultati na ded891c,
  točni zgodovinski ukazi in exit codes; brez novega testnega teka.
- [Sintetični posnetek 280 px](synthetic-runtime-280px.png): samo izmišljeni izbor,
  lokalni DEVELOPMENT prikaz; ni Word, ni live prijava in ne dokazuje odprave.

## Čas, izvor in povezljivost

| ID / izvor | Čas UTC in njegova vrsta | Povezana različica | Kaj dokazuje / česa ne |
| --- | --- | --- | --- |
| W1 — ownerjev opis Worda, ohranjen v zasebni predaji | Dogodek: ni znan; predaja pripravljena 2026-10-24 | a7562740902ee230bf754e8a993fb75dc439e295, povezava po opisu/fazi | Access required po reopen in Allow/Ignore; brez request/browser korelacije |
| W2 — ownerjev opis osnutka, zasebni idle-check zapis | Dogodek: ni znan; mtime zapisa 2026-10-24T01:52:37.224908Z | c062b3721b132e2263278f6043f862c161ca6ab2 po fazi, ne po requestu | Ohranjen osnutek po približno 30 min; ne avtentikacija |
| W3 — zasebni Word posnetek iz prejšnje predaje | Točen zajem/SHA ni potrjen | Nepovezljivo | Prikazuje sideload readiness in dokument; ni posnetek Access required, ostane zaseben |
| D1 — starejši ohranjeni delivery record | API opažanje 2026-10-24T00:50:39.158Z; asset check 00:48:44.208496Z | c062b3721b132e2263278f6043f862c161ca6ab2 | Zgodovinska dostava/callback priprava; ni današnji Word rezultat |
| D2 — ohranjeni settings delivery record | API opažanje 2026-10-24T03:18:00.394Z | a7562740902ee230bf754e8a993fb75dc439e295 | Zgodovinska dostava settings gumba; ni Word recovery PASS |
| D3 — ohranjeni zadnji delivery record, after.json | API opažanje 2026-10-24T03:56:50.495Z | ded891c22b735ca323bfede552e5219683d24841 | Deployment success in ohranjen rollback; ni svež pregled ob objavi |
| D3 — http-static-verification.json | Check 2026-10-24T03:56:53.445196Z | ded891c22b735ca323bfede552e5219683d24841 | 45 GET200/bajtnih ujemanj; ne prijava |
| D3 — access-verification.json | Check 2026-10-24T03:56:53.621457Z | ded891c22b735ca323bfede552e5219683d24841 | Anonimna 302 na obeh poteh; ne avtenticiran Word |
| B1 — ohranjeni runtime-browser.json in PNG iz delivery recorda | Izvedba: ni točnega timestampa; retained copy mtime 2026-10-24T03:58:52Z | ded891c22b735ca323bfede552e5219683d24841 prek dostavljenih JS bajtov in predaje | Firefox157, sintetični Office/identity; ne Word PASS. PNG sam nima vgrajenega commit dokaza |
| B2 — pripravljalni Firefox cookie fixture | Mtime 2026-10-24T03:43:04.392334Z; ni potrjen execution timestamp | Zbran med ded891c pregledom; fixture ne izvaja add-in kode | Realna lokalna browser cookie mehanika s sintetično sejo; ne ownerjev vzrok |
| B3 — pripravljalni Chromium comparison | Mtime 2026-10-24T03:38:52.448818Z; ni potrjen execution timestamp | Zbran med ded891c pregledom; generic fixture | Te postavitve ne smemo pripisati ownerjevemu brskalniku |
| V1 — obstoječi GitHub CI | Job 2026-10-24T03:47:09Z–03:48:55Z | ded891c22b735ca323bfede552e5219683d24841 | Completed/success, 19 uspešnih job korakov; ne Word sprejem |
| V1 — ohranjeni local-gates/results.json in test.log | Results mtime 2026-10-24T03:45:09.324068Z; ni točen čas vseh ukazov | ded891c22b735ca323bfede552e5219683d24841 po predaji | 15 gate ukazov exit0, 592 PASS / 1 protected-live SKIP |

Mtime je metapodatek datoteke oziroma njene zadržane kopije, ne dokaz natančnega
časa dogodka. Imena izvornih zapisov in vzdevki so namenjeni povezavi z zasebnim
inventarjem; zasebne poti, identitete in konfiguracija se ne izvažajo.

## Izključeno in manjkajoče

Dejanski Word screenshot vsebuje dokument in ostaja zaseben; nepovezani MCP
OAuth screenshot ni dokaz tega incidenta. V pregledanih zapisih ni actual-Word HAR,
Console/Network/error chain zajema ali dokaza cookie blocked reason. Točen Word
in browser build ownerjevega dogodka ter per-request commit/runtime korelacija
nista potrjena. Svežih podatkov nismo izdelali namesto teh vrzeli.

**ACTUAL_WORD: NOT_RUN. ROOT_CAUSE: UNDETERMINED. ISSUE_RESOLVED: NOT_CONFIRMED.**
