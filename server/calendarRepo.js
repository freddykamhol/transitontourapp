import { db } from "./db.js";

function nowIso() {
  return new Date().toISOString();
}

export function replaceCalendarItems(items) {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM calendar_items").run();
    const stmt = db.prepare(
      "INSERT INTO calendar_items(id, kind, title, startAt, endAt, vehicleId, metaJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const updatedAt = nowIso();
    for (const it of items) {
      stmt.run(
        it.id,
        it.kind,
        it.title,
        it.startAt,
        it.endAt ?? null,
        it.vehicleId ?? null,
        it.meta ? JSON.stringify(it.meta) : null,
        updatedAt,
      );
    }
  });
  tx();
}

export function listCalendarItems() {
  const rows = db.prepare("SELECT id, kind, title, startAt, endAt, vehicleId, metaJson FROM calendar_items ORDER BY startAt ASC").all();
  return rows.map((r) => ({ ...r, endAt: r.endAt ?? null, vehicleId: r.vehicleId ?? null, meta: r.metaJson ? JSON.parse(r.metaJson) : null }));
}

