export type ReleaseNote = {
  id: string;
  title: string;
  date: string;
  highlights: string[];
};

export const latestRelease: ReleaseNote = {
  id: "2026-06-28-tarife-geraete-nummern",
  title: "Tarife, Gerätepreise & Nummern",
  date: "28.06.2026",
  highlights: [
    "Leistungen können jetzt als Tarife mit Vorschlagsregeln angelegt werden und greifen automatisch bei passenden Fahrzeugmieten.",
    "Geräte haben eigene Tagesmietpreise statt Katalogtarife; der Gerätepreis wird im Vermietungsformular automatisch pro Miettag berechnet.",
    "Interne Nummern werden automatisch vergeben: Fahrzeuge nach Kategorie-Präfix, Geräte mit GE-Präfix.",
    "Vertragsnummern sind einfacher lesbar und starten jetzt mit MV plus 9-stelliger Nummer.",
    "Das Changelog erscheint wieder einmalig pro Gerät/Browser je Release.",
    "Der Portalstart erkennt eine bereits laufende API auf dem Standardport und bricht dann nicht mehr fehlerhaft ab.",
  ],
};
