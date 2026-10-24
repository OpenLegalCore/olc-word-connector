# OLC-72 — sinhronizacija kode in očiščenih dokazov

Pregled: 24. oktober 2026; lokalni inventar ob **12:03:04 UTC**.
Stanje: **IN REVIEW**, [draft PR #2](https://github.com/OpenLegalCore/olc-word-connector/pull/2).
To je dokumentacijska objava obstoječih dokazov, brez popravka ali novega preverjanja storitev.
Težava **Access required ni označena kot odpravljena**.

## Tri ločene identitete

| Meja ob začetku sinhronizacije | Preverjena identiteta |
| --- | --- |
| Lokalni OLC-72 HEAD | `ded891c22b735ca323bfede552e5219683d24841` |
| Objavljeni remote / PR #2 HEAD | `ded891c22b735ca323bfede552e5219683d24841` |
| Tree teh dveh HEAD-ov | `f35f7497ff4999fecc36a6a70fff3b35b1651e18` |
| Aktualni GitHub main | `603585a195180f535674126803cb570c086b4523` |
| Zadnja dokazljivo dostavljena koda | `ded891c22b735ca323bfede552e5219683d24841` |
| Zadnji zabeleženi Pages deployment | `e1f2788f-5a48-4a00-ae8b-665f6ecadd3d` |

Remote je preverjen z GitHub API, `ls-remote` in ciljnim fetchom. Namenska veja
`codex/olc-72-word-native-sse` sledi `origin/codex/olc-72-word-native-sse`:
**0 ahead / 0 behind**, brez neobjavljenih commitov na tej veji. Proti main ima
14 commitov naprej in 0 nazaj. Index, worktree in seznam nesledenih datotek so
bili pred to dokumentacijsko spremembo prazni.

Commit s tem poročilom je dokumentacijski potomec navedenega HEAD-a. Njegov SHA
je v GitHub zgodovini oziroma PR-ju; **novi review HEAD ni nova dostavljena koda**.
Vsebina kode je že objavljena v [ded891c](https://github.com/OpenLegalCore/olc-word-connector/commit/ded891c22b735ca323bfede552e5219683d24841).

## Lokalni checkouti in ohranjeno delo

Imena spodaj so lokacijski vzdevki; absolutne zasebne poti niso objavljene.
Vsak pregledani Git repozitorij navaja samo svoj worktree; dodatnih povezanih
worktreejev ni. Starejši OLC-72 checkouti so ločeni kloni, ne povezani worktreeji.

| Checkout | Lokalni HEAD | Upstream / stanje |
| --- | --- | --- |
| `callback-review` — izbrani aktualni checkout | `ded891c22b735ca323bfede552e5219683d24841` | origin/namenska veja; čist |
| `access-recovery` | `8fdd6f3c35d95735085398c97fb15474e779f638` | brez upstreama; čist; ancestor ded891c |
| `review` | `8d96dbfd86909f65c6b072e428937dc1d885a11c` | brez upstreama; čist; ancestor ded891c |
| `document-review` | `1d86fd7c21695730c64d8de91118c49e2a324eb6` | brez upstreama; čist; ancestor ded891c |
| `proposal` | `607752891de593f9350d9e103870fe8b640cd453` | brez upstreama; čist; ancestor ded891c |
| prvotni OLC-72 checkout | `390590db71742b2682fe80cb57a0484f40ca76e6` | brez upstreama; čist; ancestor ded891c |
| prvotni zgodovinski checkout, veja main | `227ee1e63fcbf52884b1e74a113729210d5084ad` | origin/main; dve nestageani datoteki |

Vsi indexi so prazni, nesledenih datotek ni. V prvotnem zgodovinskem checkoutu
ostajata `docs/IMPLEMENTATION_PLAN.md` (+21/−3) in `docs/STATUS.md` (+15/−3).
Spremembi opisujeta prihodnji backlog za obnovo runtime stanja in preference;
ne vsebujeta nove implementacije. Ohranita se nedotaknjeni in nista objavljeni
kot aktualna javna dokumentacija. Ta checkout ima starejšo ločeno zgodovino in
ni osnova trenutne javne veje; njegovih zasebnih zgodovinskih dokumentov ne
združujemo z javno zgodovino. Pregled ostalih klonov ni našel novejše neobjavljene
OLC-72 kode.

Za delo veljajo ownerjeva trenutna navodila in prebrani lokalni AGENTS.md iz
prvotnega checkouta ter javna CONTRIBUTING.md in SECURITY.md. V izbranem javnem
checkoutu AGENTS.md in zasebnih zgodovinskih faznih dokumentov ni; teh ne kopiramo
v javni repo. Objava vsebuje samo izbrano poročilo, popravek trenutnega statusnega
zapisa in očiščene dokazne projekcije. Produkcijska koda, manifesti, package/lock,
infrastrukturna koda ter uporabnikovo delo niso spremenjeni.

## Zadnja dokumentirana dostava

Ohranjeni bralni zapis po dostavi z dne **2026-10-24T03:56:50.495Z** potrjuje
deployment `e1f2788f-5a48-4a00-ae8b-665f6ecadd3d`, status success in kodo ded891c.
Referenca zapisa je [immutable Pages URL](https://e1f2788f.olc-word-staging.pages.dev).
Rollback zapis je `a9527b86-69d8-4633-9aba-002993305d3b`, koda
`a7562740902ee230bf754e8a993fb75dc439e295`.

Ob **03:56:53.445196 UTC** je zabeleženih 45 GET200 in bajtnih ujemanj za
15 datotek na treh vrstah domen. Aktivni taskpane je
`taskpane.2d8e00eab4af17d0b8f6.js`, SHA-256
`32263527a6fe6cb7cfd48f0a6e3c014ae749abeb687f35356d403e65cad43f1b`.
Manifest, CSP in videz so po teh zapisih ohranjeni; Worker, Access, DNS in routes
so v primerjavi pred/po nespremenjeni.

To je **zadnje dokumentirano stanje, ne svež control-plane ali HTTP pregled**.
V tej sinhronizaciji Cloudflare oziroma delujoče storitve niso bili uporabljeni.
Čas opažanja po dostavi ni izmišljen natančen čas začetka ali konca deploymenta.

## Dokazi in njihove meje

Popis s časom, izvorom, različico in omejitvami je v
[kazalu očiščenih dokazov](evidence/olc72-access-20261024/README.md).

- **Dejanski Word, ownerjev opis:** po ponovnem odprtju a756274 se prikaže
  Access required; Open secure sign-in pokaže Office Allow/Ignore. Točen čas,
  Word/browser build in povezljivi omrežni zahtevek niso ohranjeni. Vezava na
  a756274 izhaja iz ownerjevega opisa/faze, ne iz zajetega requesta.
- **Dejanski Word, ownerjev opis:** po približno 30 minutah je osnutek ohranjen.
  Zapis je povezan s prejšnjo fazo c062b372; to ni potrditev novega GET-a ali
  obnove avtentikacije. Točen čas dogodka ni znan.
- **Ohranjeni živi anonimni GET-i:** oba API prefixa zahtevata Access. To ne
  dokazuje avtenticiranega dostopa, cookie prenosa ali vzroka ownerjeve napake.
- **Sintetični brskalnik:** dostavljene produkcijske datoteke so bile lokalno
  predvajane v Firefoxu s sintetičnim Office/identity. Zabeleženi so reopen,
  sintetični expiry, ohranitev vnosa/jezika/odstranjene priponke ter varna zavrnitev
  prepovedanega Storage Access. To ni dejanski Word ali prava Access prijava.
- **Obstoječa kvalifikacija kode:** [CI 40059714847](https://github.com/OpenLegalCore/olc-word-connector/actions/runs/40059714847)
  je success na ded891c; lokalni zapis ima 592 PASS / 1 protected-live SKIP in
  15 uspešnih gates. To ni Word sprejem. Nobenega testa nismo ponovno izvedli.

**Odprte vrzeli:** v pregledanih zapisih ni actual-Word Console/Network/HAR zajema napake, celotne
verige nadrejenih originov, cookie blocked-reason zapisa, povezanega request ID-ja
ali potrjene obnove dejansko potekle seje. Za najnovejši kandidat je dejanski
Word sprejem **NOT_RUN**. Sintetični rezultati ne določijo vzroka v ownerjevem
brskalniku. Tudi ohranitev osnutka in uspešen dialog sama ne dokazujeta dostopa.

## Javna objava in izključitve

Javno so objavljene samo projekcije po dovoljenih poljih in pregledan sintetični
PNG. To niso surovi logi ali testni artefakti, pripisani resničnemu Wordu.
Zasebni izvirniki ostanejo v obstoječih zaščitenih operativnih paketih; dodatni
zasebni inventar povezuje vzdevke z lokacijami. Dejanski Word posnetek vsebuje
vsebino dokumenta in ni dokaz prijavne napake; ni objavljen. Posnetek MCP OAuth
napake je drug problem, ni dokaz Word prijave in prav tako ni objavljen.

Popis je omejen na sedem navedenih checkoutov, tri zadnje delivery zapise,
zadnji pripravljalni paket, idle-check zapis ter povezane zasebne evidence
access/document-review dela. Starejši gate/build dnevniki ostanejo zasebni in ne
nadomeščajo kvalifikacije ded891c. Poverilnih shramb ne preiskujemo. Odsotnost
dokaza v tem popisu ne pomeni dokaza, da nikjer drugje ne obstaja.

Izključeni so poverilnice, cookie vrednosti, identitete, redirect parametri,
zasebni izvori/poti, account/zone/Access/Worker identifikatorji, surovi operativni
logi, deployment ukazi in celotni zasebni aktivacijski paketi. Objavljeni javni
deployment ID in hashi javnih datotek so reference dostave, ne poverilnice.

Ta sprememba ne potrjuje odprave Access required in ne posega v storitve.
