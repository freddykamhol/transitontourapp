import { db } from "./db.js";

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getSetting(key) {
  const row = db.prepare("SELECT valueJson FROM settings WHERE key = ?").get(key);
  if (!row) return null;
  return safeParseJson(row.valueJson);
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings(key, valueJson, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson, updatedAt = excluded.updatedAt`,
  ).run(key, JSON.stringify(value), nowIso());
}

export function getSmtpSettings() {
  return getSetting("smtp");
}

export function saveSmtpSettings(value) {
  setSetting("smtp", value);
}
