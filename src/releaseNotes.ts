export type ReleaseNote = {
  id: string;
  title: string;
  date: string;
  highlights: string[];
};

export const latestRelease: ReleaseNote = {
  id: "2026-06-10-reminder-mail-name-fields",
  title: "Erinnerungsmails & Mietvertragsdaten",
  date: "10.06.2026",
  highlights: [
    "Neue Einstellungen-Seite für Erinnerungsmails mit Betreff, Text, Versandzeit und Anhang-Kategorien.",
    "Automatischer Erinnerungsmail-Versand vor Rückgabe inklusive Mietvertrag, Rückgabecheckliste und auswählbaren spezifischen Dokumenten.",
    "Dokument-Uploads an Fahrzeugen/Geräten für Erinnerungsmail-spezifische und allgemeine gerätespezifische Dokumente.",
    "Mietanlage: spezifische Dokumente je Mietobjekt und Zubehör auswählbar.",
    "Mietvertrag-Anlage: Mietername in Anrede, Titel, Vorname(n) und Nachname getrennt; Zusatzfahrer ebenfalls angepasst.",
    "Namensfelder im Formular zweispaltig angeordnet.",
  ],
};

