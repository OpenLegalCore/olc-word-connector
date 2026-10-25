import type { MessageCatalog } from "./messages.en-US";

export const slSIMessages = {
  diagnostics: {
    copy: "Kopiraj diagnostiko",
    copied: "Diagnostika kopirana",
    failed: "Kopiranje diagnostike ni uspelo. Poskusite znova.",
  },
  chrome: {
    documentTitle: "Dodatek OpenLegalCore za Microsoft Word",
    brandName: "OpenLegalCore za Word",
    brandImageAlt: "OpenLegalCore",
    availableActions: "Razpoložljiva dejanja",
    answerAriaLabel: "Odgovor",
    sourcesHeading: "Viri",
  },
  settings: {
    title: "Nastavitve",
    open: "Nastavitve",
    close: "Zapri nastavitve",
    language: "Jezik",
    slovenian: "Slovenščina",
    english: "English",
    languageChanged: (language: string): string => `Izbrani jezik: ${language}.`,
    checkConnection: "Preveri povezavo",
    checkingConnection: "Preverjam povezavo …",
    connectionUnchecked: "Preverite dostop iz tega podokna brez oddaje sporočila.",
    connectionPassed: "Povezava je vzpostavljena. Sporočilo ni bilo poslano.",
    connectionFailed: "Preverjanje dostopa ni uspelo. Vaš vnos je ohranjen.",
    checkedAt: (time: string): string => `Zadnje preverjanje: ${time}`,
  },
  initializing: {
    statusLabel: "Vzpostavljanje povezave z Wordom",
    statusDetail: "INICIALIZACIJA",
    eyebrow: "ZAGON DODATKA",
    heading: "Odpiranje dodatka OpenLegalCore …",
    description: "Preverjanje Wordovega okolja in priprava varnostne meje dokumenta.",
    footerEyebrow: "OKOLJE WORD",
    footerMessage: "ČAKANJE NA PRIPRAVLJENOST",
  },
  unsupported: {
    statusLabel: "Potreben je Word",
    statusDetail: "NEPODPRTO OKOLJE",
    eyebrow: "MEJA OKOLJA",
    heading: "Odprite ta dodatek v programu Microsoft Word",
    description:
      "Meja dostopa do dokumenta je na voljo samo v podprtem okolju programa Microsoft Word.",
    noticeTitle: "Ni povezave z dokumentom",
    noticeMessage: "Vsebina dokumenta ni bila prebrana ali spremenjena.",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "NEAKTIVNO",
  },
  connecting: {
    statusLabel: (provider: string): string => `Povezovanje s storitvijo ${provider}`,
    statusDetail: "POVEZOVANJE",
    eyebrow: "POVEZAVA S STORITVIJO",
    heading: "Povezovanje …",
    description: "To preverjanje ne pošlje besedila dokumenta in dokumenta ne more spremeniti.",
    footerEyebrow: "MEJA STORITVE",
    footerMessage: "PREVERJANJE POTEKA",
    cancel: "Prekliči",
  },
  ready: {
    connectedStatus: (provider: string): string => `${provider} je povezan`,
    statusDetail: "POVEZANO",
    heading: "Vprašajte OpenLegalCore",
    description: "Zastavite vprašanje ali napišite navodilo.",
    selectedText: "Izbrano besedilo",
    removeSelectedText: "Odstrani",
    questionLabel: "Sporočilo",
    questionPlaceholder: "Vprašajte ali napišite navodilo …",
    sendAction: "Pošlji",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    selectedTextBoundary: "S sporočilom bo poslano samo pripeto izbrano besedilo.",
    noDocumentBoundary: "Vsebina dokumenta ne bo prebrana ali poslana.",
    validationTitle: "Vnesite sporočilo",
    validationMessage:
      "Vnesite sporočilo, dolgo od 1 do 4.000 znakov. Vsebina dokumenta ni bila poslana.",
    selectionUnavailableTitle: "Izbor ni pripet",
    selectionUnavailableMessage:
      "Izberite podprto besedilo v enem delu Wordovega dokumenta ali eni celici oziroma izbor pred pošiljanjem počistite.",
  },
  searching: {
    statusLabel: "Pripravljanje odgovora",
    eyebrow: "POMOČNIK",
    heading: "Pripravljam odgovor …",
    streamingHeading: "Odgovor prihaja …",
    description: "Dokument ni bil spremenjen.",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "SAMO ANALIZA",
    cancel: "Ustavi",
  },
  result: {
    statusLabel: "Odgovor je pripravljen",
    eyebrow: "POMOČNIK",
    heading: "Odgovor",
    usage: (input: number, output: number, total: number): string =>
      `Poraba: ${input} vhodnih · ${output} izhodnih · ${total} žetonov skupaj`,
    usageUnavailable: "Poraba: storitev je ni sporočila",
    copiedTitle: "Kopirano",
    copiedMessage: "Celoten odgovor je bil kopiran kot navadno besedilo.",
    copyFailedTitle: "Kopiranje ni uspelo",
    copyFailedMessage: "Kopiranje ni na voljo. Izberite besedilo odgovora in ga kopirajte ročno.",
    copyAction: "Kopiraj odgovor",
    copiedAction: "Kopirano",
    refineQuestion: "Uredi sporočilo",
    newSearch: "Novo sporočilo",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "SAMO ANALIZA · DOKUMENT NI SPREMENJEN",
  },
  proposal: {
    heading: "Predlog besedila za dokument",
    replaceSelection: "Zamenjaj označeno besedilo",
    insertAtCursor: "Vstavi na mesto kazalca",
    ready: "Preglejte natančen predlog. Word se spremeni samo ob vašem kliku.",
    applying: "Vnašam predlog …",
    applied: "Predlog je vnesen enkrat. Za pregled ali povrnitev uporabite Wordov Undo/Redo.",
    selectionChanged:
      "Prvotni izbor je spremenjen ali ni več označen. Nič ni zapisano. Začnite novo zahtevo.",
    cursorRequired:
      "Postavite kazalec brez označenega besedila. Nič ni zapisano. Začnite novo zahtevo.",
    writeUnconfirmed:
      "Zapisa ni bilo mogoče potrditi. Preverite Word in po potrebi uporabite Undo. Dejanja ne ponavljajte.",
  },
  error: {
    statusLabel: "Zahteva se je varno ustavila",
    eyebrow: "OBNOVITEV",
    heading: "Dokument je nespremenjen",
    description: "Ponovni poskus se izvede samo na vašo zahtevo. Samodejnega pošiljanja ni.",
    noticeTitle: "Dokument ni bil spremenjen",
    noticeMessage: "Preverite storitev in sporočilo, nato poskusite znova.",
    retrySearch: "Poskusi znova",
    refineQuestion: "Uredi sporočilo",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "NESPREMENJENO",
  },
  session: {
    expiredTitle: "Prijava ni več veljavna",
    expiredMessage:
      "Prijavna koda ali Word seja ni več veljavna. Vnos je ohranjen; znova odprite prijavo, ko želite.",
    statusLabel: "Potreben je dostop",
    eyebrow: "ZAŠČITENA SEJA",
    heading: "Potreben je dostop",
    description:
      "Microsoft zahteva prijavo ali soglasje. Vnos je ohranjen in ne bo samodejno poslan.",
    signInOpenedTitle: "Microsoftova prijava",
    signInOpenedMessage:
      "Office lahko pred odprtjem okna vpraša Allow / Ignore. Allow odpre varno prijavo; Ignore dostopa ne spremeni. Po vrnitvi se preveri samo povezava, vaše sporočilo se ne pošlje.",
    signInFailedTitle: "Microsoftove prijave ni bilo mogoče dokončati",
    signInFailedMessage:
      "Prijave ali varne izmenjave kode ni bilo mogoče dokončati. Vnos je ohranjen; prijavo znova odprite, ko želite.",
    retrySearch: "Preveri povezavo",
    openSecureSignIn: "Prijava z Microsoftom",
    completedTitle: "Word seja je ustvarjena",
    closedTitle: "Prijava ni bila dokončana",
    closedMessage:
      "Okno je bilo odklonjeno, zaprto ali prekinjeno. To ni zavrnitev pravilnika dostopa. Vnos je ohranjen; prijavo odprite, ko želite.",
    completedMessage: "Preverjam Word sejo in povezavo. Vaše sporočilo ne bo poslano.",
    paneRejectedTitle: "Dostop iz Word podokna je še zavrnjen",
    paneRejectedMessage:
      "Word seja ni več veljavna. Vnos je ohranjen; znova se prijavite, ko želite.",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "NESPREMENJENO",
  },
  connectionError: {
    deniedHeading: "Dostop je zavrnjen",
    descriptionFor: (code: string): string => {
      if (code === "INVALID_CONFIGURATION")
        return "Microsoftov dostop še ni konfiguriran. Obrnite se na upravljavca; vnos je ohranjen.";
      if (code === "ACCESS_DENIED")
        return "Ta Microsoftov račun nima dovoljenja za uporabo OpenLegalCore. Vnos je ohranjen; obrnite se na upravljavca.";
      if (code === "NETWORK_ERROR")
        return "Zahteva ni dosegla storitve. Preverite omrežje; ponovna prijava morda ne bo pomagala. Vnos je ohranjen.";
      if (code === "SERVICE_UNAVAILABLE")
        return "Strežnik je vrnil odziv o nedosegljivi storitvi. Povezavo preverite pozneje; vnos je ohranjen.";
      if (code === "TIMEOUT")
        return "Preverjanje povezave je trajalo predolgo. Vnos je ohranjen; sporočilo ni bilo oddano.";
      if (code === "INVALID_RESPONSE")
        return "Storitev je vrnila nepričakovan odziv. Ni bil sprejet kot seja ali odgovor. Vnos je ohranjen.";
      return "Preverjanje povezave ni uspelo. Vnos je ohranjen; ponovite ga, ko želite.";
    },
    statusLabel: (provider: string): string => `Storitev ${provider} ni na voljo`,
    eyebrow: "POVEZAVA S STORITVIJO",
    heading: "Preverjanje povezave ni uspelo",
    description: "Vsebina dokumenta ni bila prebrana. Povezavo z OLC Engine morate ponoviti sami.",
    tryAgain: "Poskusi znova",
    footerEyebrow: "MEJA DOSTOPA DO DOKUMENTA",
    footerMessage: "NESPREMENJENO",
  },
} satisfies MessageCatalog;
