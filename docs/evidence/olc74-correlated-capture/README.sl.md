# OLC-74: neaktivna korelacijska priprava Word gatewaya

Osnova: PR3 `f894b409012356d25c1237965aed53982a9ef5d7`; dostavljeni produkt de34ecd
ima isto produktno kodo, razlika do te osnove je dokumentacijska. Trenutna dostava,
SSO, Office Apply in uporabniški podatki niso spremenjeni. To ni popravek
zgodovinskega `terminal_validation_failed` in ni predlog slepe aktivacije PR56.

Final gateway izračuna SHA-256 ter UTF8 bytecount iz telesa, ki ga dejansko pošlje
Engineu. Isti obstoječi `upstream_http` diagnostic event dobi zaprti `engineJoin`:
`bodySha256`, `bodyUtf8Bytes`, `completionId` ali null. ID prihaja iz Engineovega
ACK headerja, ne iz Word zahteve. Engine ga ustvari skupaj z dejanskim SSE ID in
ga shrani v private run; njegova druga neodvisna body hash vrednost mora biti ista.

Podatek je v že avtenticiranem obstoječem SQLite receiptu, največ 5 dogodkov in
10 minut. Stari receipti so združljivi. Receipt ne vsebuje question/selection/body,
output, promptov, poverilnic ali headerjev. Ni novega SSO toka ali looser Apply.
Tudi manjkajoč ACK ni funkcionalna napaka ali dovoljenje za retry; samo capture ne
more biti dokazan. Optional hashing failure ohrani originalni odgovor.

`test/fixtures/correlated-engine-capture.mjs` uporablja dejanski Word builder,
adapter, session/API/gateway in Miniflare SQLite. Edini dovoljen Engine cilj je
dinamični loopback fixture, ki ga zaganja povezana Engine regresija; ni provider
ali live okolje. Zasebno shrani samo sintetične actual-wire in SSE bajte ter receipt.
Engine partner uporablja dejanski workflow, Writer parent/child/SDK in validator,
z nadzorovanimi modelnimi transporti. Isti body pri dveh klicih ima različna server
ID-ja. Fiksni guard se prebere iz zasebnega runa; ACK/hash mismatch in manjkajoč
guard se zavrnejo. To je kvalifikacija prihodnje povezljivosti, ne zgodovinska
reprodukcija ali modelni sprejem.

Zgodovinski owner izvoz je 5/5 manifest PASS in ima enega kandidata, ki je dosegel
CONVERSATION_HISTORY ter Writer (69 delt, provider completed). Nima izvirnega
Writer outputa, konkretnega guarda, izvirnih Word final-wire bajtov ali skupnega
completion ID. Kandidat zato ostaja nepripisan Word operaciji.

Aktivacije, novih provider klicev ali ponavljanja stare operacije ni bilo. Pred
morebitnim prihodnjim zajemom sta potrebna pregled obeh partnerjev in ločeno
odobrena dostava; zasebni receipt je treba pravočasno izvoziti. Engine partner
ponuja ordinary-user `examples/word_capture_join.py` za manifest/ID/hash/guard
readback; ne opravlja sudo ali live branja. OLC-74 ostaja odprt.
