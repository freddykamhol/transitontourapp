import type { ReminderMailDb, ReminderMailSettings } from "../domain/reminder";

const STORAGE_KEY = "tot.reminderMailDb.v1";

export const reminderCategoryLabels = {
  fuel_guide: "Tankanleitung",
  rental_contract: "Mietvertrag",
  return_checklist: "Rückgabecheckliste",
  specific_documents: "Spezifische Dokumente",
} as const;

export const reminderCategories = Object.keys(reminderCategoryLabels) as Array<keyof typeof reminderCategoryLabels>;

const defaultSettings: ReminderMailSettings = {
  enabled: true,
  subject: "Erinnerung zur Rückgabe deiner Vermietung {id}",
  text: [
    "Hallo {name},",
    "",
    "wir erinnern dich an die geplante Rückgabe deiner Vermietung {id}.",
    "Rückgabe: {returnAt}",
    "Mietgegenstand: {item}",
    "",
    "Bitte beachte die angehängten Unterlagen.",
    "",
    "Viele Grüße",
    "Transit on Tour",
  ].join("\n"),
  daysBeforeReturn: 1,
  sendTime: "09:00",
  attachmentCategories: ["rental_contract", "return_checklist", "specific_documents"],
};

function safeParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDb(value: unknown): value is ReminderMailDb {
  if (!value || typeof value !== "object") return false;
  const db = value as Partial<ReminderMailDb>;
  return db.version === 1 && Boolean(db.settings);
}

export function getReminderMailSettings(): ReminderMailSettings {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (isDb(parsed)) return { ...defaultSettings, ...parsed.settings };
  return defaultSettings;
}

export function saveReminderMailSettings(settings: ReminderMailSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings } satisfies ReminderMailDb));
}
