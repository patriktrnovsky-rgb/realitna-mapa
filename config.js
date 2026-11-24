// ============================================================
//  KONFIGURÁCIA WIZARDOV – tu ladíme otázky, kroky a ceny
// ============================================================

window.APP_CONFIG = {
  // Kam posielať leady (POST JSON). Prázdne = len uloží do localStorage + vypíše do konzoly.
  // Napr. Make/Zapier webhook, Formspree, vlastný backend...
  leadEndpoint: "",

  // Orientačné ceny za m² podľa kraja (EUR) – PLACEHOLDER, treba doladiť reálnymi dátami
  pricePerM2: {
    byt: { BA: 4100, TT: 2400, NR: 1950, TN: 2000, ZA: 2350, BB: 1850, PO: 1900, KE: 2300 },
    dom: { BA: 3300, TT: 1900, NR: 1450, TN: 1500, ZA: 1750, BB: 1300, PO: 1350, KE: 1600 },
    pozemok: { BA: 260, TT: 95, NR: 60, TN: 60, ZA: 80, BB: 45, PO: 40, KE: 70 },
  },

  // Šírka zobrazeného rozpätia (±)
  rangeSpread: 0.08,
};

const KRAJE = [
  { value: "BA", label: "Bratislavský", city: "Bratislava" },
  { value: "TT", label: "Trnavský", city: "Trnava" },
  { value: "NR", label: "Nitriansky", city: "Nitra" },
  { value: "TN", label: "Trenčiansky", city: "Trenčín" },
  { value: "ZA", label: "Žilinský", city: "Žilina" },
  { value: "BB", label: "Banskobystrický", city: "Banská Bystrica" },
  { value: "PO", label: "Prešovský", city: "Prešov" },
  { value: "KE", label: "Košický", city: "Košice" },
];

const LOKALITA_STEP = {
  id: "lokalita",
  title: "Kde sa nehnuteľnosť nachádza?",
  fields: [
    { name: "kraj", type: "select", label: "Kraj", options: KRAJE, required: true },
    { name: "obec", type: "text", label: "Obec / mesto", placeholder: "napr. Bratislava", placeholderFrom: "kraj", required: true },
    { name: "ulica", type: "text", label: "Ulica", placeholder: "napr. Hlavná 12", required: true },
  ],
};

const ZAMER_STEP = {
  id: "zamer",
  title: "Kedy plánujete predávať?",
  subtitle: "Podľa toho vám odporučíme makléra s tým správnym prístupom.",
  fields: [
    {
      name: "zamer", type: "choice", required: true, autoNext: true,
      // "hot" označuje horúci lead (prioritný telefonát)
      options: [
        { value: "predaj_hned", label: "Čo najskôr", icon: "timer", hot: true },
        { value: "predaj_3m", label: "Do 3 mesiacov", icon: "calendar", hot: true },
        { value: "predaj_6m", label: "Do pol roka", icon: "hourglass" },
        { value: "predaj_rok", label: "Do roka", icon: "clock" },
      ],
    },
  ],
};

window.WIZARDS = {
  byt: {
    label: "Byt",
    icon: "byt",
    steps: [
      LOKALITA_STEP,
      {
        id: "dispozicia",
        title: "Aká je dispozícia bytu?",
        fields: [
          {
            name: "izby", type: "choice", required: true, autoNext: true,
            options: [
              { value: "garsonka", label: "Garsónka", multiplier: 1.1 },
              { value: "1", label: "1-izbový", multiplier: 1.08 },
              { value: "2", label: "2-izbový", multiplier: 1.03 },
              { value: "3", label: "3-izbový", multiplier: 1.0 },
              { value: "4", label: "4-izbový", multiplier: 0.98 },
              { value: "5", label: "5+ izbový", multiplier: 0.96 },
            ],
          },
        ],
      },
      {
        id: "parametre",
        title: "Rozloha a poschodie",
        fields: [
          { name: "plocha", type: "number", label: "Úžitková plocha (m²)", min: 10, max: 500, required: true, area: true },
          { name: "poschodie", type: "number", label: "Číslo poschodia bytu", placeholder: "napr. 3", hint: "Prízemie = 0", min: -1, max: 60, required: true, half: true,
            maxFrom: "poschodiaBudova", maxFromError: "Poschodie nemôže byť vyššie ako počet poschodí" },
          { name: "poschodiaBudova", type: "number", label: "Počet poschodí v budove", placeholder: "napr. 8", min: 1, max: 60, required: true, half: true },
          { name: "vytah", type: "toggle", label: "Výťah v budove", sub: "Budova má funkčný výťah", icon: "elevator", multiplier: 1.02 },
        ],
      },
      {
        id: "stav",
        title: "V akom stave je byt?",
        fields: [
          {
            name: "stav", type: "choice", required: true, autoNext: true,
            options: [
              { value: "novostavba", label: "Novostavba", icon: "houseNew", multiplier: 1.15 },
              { value: "rekonstrukcia", label: "Po kompletnej rekonštrukcii", icon: "roller", multiplier: 1.07 },
              { value: "dobry", label: "Dobrý, udržiavaný", icon: "houseCheck", multiplier: 1.0 },
              { value: "povodny", label: "Pôvodný stav", icon: "history", multiplier: 0.85 },
            ],
          },
        ],
      },
      {
        id: "doplnky",
        title: "Čo k bytu patrí?",
        subtitle: "Označte všetko, čo platí.",
        fields: [
          {
            name: "doplnky", type: "multi",
            options: [
              {
                value: "balkon", label: "Balkón", icon: "balcony", multiplier: 1.03,
                // po označení sa v dlaždici zobrazí pole na výmeru; areaWeight = koľko % plochy sa započíta do ceny
                detail: { name: "balkonM2", label: "Výmera balkóna (m²)", placeholder: "Výmera, napr. 5", min: 1, max: 100, required: true, areaWeight: 0.25 },
              },
              {
                value: "lodzia", label: "Lodžia", icon: "loggia", multiplier: 1.03,
                detail: { name: "lodziaM2", label: "Výmera lodžie (m²)", placeholder: "Výmera, napr. 6", min: 1, max: 100, required: true, areaWeight: 0.5 },
              },
              {
                value: "terasa", label: "Terasa", icon: "terrace", multiplier: 1.05,
                detail: { name: "terasaM2", label: "Výmera terasy (m²)", placeholder: "Výmera, napr. 15", min: 1, max: 500, required: true, areaWeight: 0.25 },
              },
              { value: "pivnica", label: "Pivnica", icon: "cellar", multiplier: 1.01 },
              { value: "parking", label: "Parkovacie státie", icon: "parking", multiplier: 1.03 },
              { value: "garaz", label: "Garáž", icon: "garage", multiplier: 1.05 },
            ],
          },
        ],
      },
      {
        id: "vlastnictvo",
        title: "Vlastníctvo a plán predaja",
        fields: [
          {
            name: "vlastnictvo", type: "choice", label: "Typ vlastníctva", required: true,
            options: [
              { value: "osobne", label: "Osobné", icon: "key" },
              { value: "spoluvlastnictvo", label: "Spoluvlastníctvo", icon: "users" },
              { value: "druzstevne", label: "Družstevné", icon: "building", multiplier: 0.95 },
            ],
          },
          { ...ZAMER_STEP.fields[0], label: "Kedy plánujete predávať?", autoNext: false },
        ],
      },
    ],
  },

  dom: {
    label: "Dom",
    icon: "dom",
    steps: [
      LOKALITA_STEP,
      {
        id: "typ",
        title: "O aký typ domu ide?",
        fields: [
          {
            name: "typDomu", type: "choice", required: true, autoNext: true,
            options: [
              { value: "samostatny", label: "Samostatne stojaci", icon: "dom", multiplier: 1.0 },
              { value: "radovy", label: "Radový / dvojdom", icon: "building", multiplier: 0.95 },
              { value: "chata", label: "Chata / chalupa", icon: "pine", multiplier: 0.8 },
            ],
          },
        ],
      },
      {
        id: "parametre",
        title: "Rozloha domu a pozemku",
        fields: [
          { name: "plocha", type: "number", label: "Úžitková plocha domu (m²)", min: 20, max: 1500, required: true, area: true },
          { name: "pozemok", type: "number", label: "Plocha pozemku (m²)", min: 0, max: 50000, required: true, landArea: true },
        ],
      },
      {
        id: "stav",
        title: "V akom stave je dom?",
        fields: [
          {
            name: "stav", type: "choice", required: true, autoNext: true,
            options: [
              { value: "novostavba", label: "Novostavba", icon: "houseNew", multiplier: 1.15 },
              { value: "rekonstrukcia", label: "Po rekonštrukcii", icon: "roller", multiplier: 1.05 },
              { value: "dobry", label: "Dobrý, udržiavaný", icon: "houseCheck", multiplier: 1.0 },
              { value: "povodny", label: "Na rekonštrukciu", icon: "hammer", multiplier: 0.75 },
            ],
          },
        ],
      },
      {
        id: "doplnky",
        title: "Vybavenie a doplnky",
        subtitle: "Označte všetko, čo platí.",
        fields: [
          {
            name: "doplnky", type: "multi",
            options: [
              { value: "garaz", label: "Garáž", multiplier: 1.04 },
              { value: "bazen", label: "Bazén", multiplier: 1.03 },
              { value: "tc", label: "Tepelné čerpadlo", multiplier: 1.03 },
              { value: "fve", label: "Fotovoltika", multiplier: 1.02 },
            ],
          },
        ],
      },
      ZAMER_STEP,
    ],
  },

  pozemok: {
    label: "Pozemok",
    icon: "pozemok",
    steps: [
      LOKALITA_STEP,
      {
        id: "druh",
        title: "O aký pozemok ide?",
        fields: [
          {
            name: "druh", type: "choice", required: true, autoNext: true,
            options: [
              { value: "stavebny", label: "Stavebný", icon: "shovel", multiplier: 1.0 },
              { value: "zahrada", label: "Záhrada", icon: "sprout", multiplier: 0.45 },
              { value: "orna", label: "Orná pôda / lúka", icon: "sun", multiplier: 0.08 },
              { value: "les", label: "Les", icon: "trees", multiplier: 0.05 },
            ],
          },
        ],
      },
      {
        id: "parametre",
        title: "Rozloha a siete",
        fields: [
          { name: "plocha", type: "number", label: "Plocha pozemku (m²)", min: 50, max: 1000000, required: true, area: true },
          {
            name: "siete", type: "multi", label: "Dostupné inžinierske siete",
            options: [
              { value: "elektrina", label: "Elektrina", multiplier: 1.03 },
              { value: "voda", label: "Voda", multiplier: 1.03 },
              { value: "kanalizacia", label: "Kanalizácia", multiplier: 1.03 },
              { value: "plyn", label: "Plyn", multiplier: 1.02 },
            ],
          },
        ],
      },
      ZAMER_STEP,
    ],
  },
};
