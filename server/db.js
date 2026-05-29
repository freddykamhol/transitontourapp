import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(config.dbPath);

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      customerEmail TEXT,
      customerName TEXT,
      subject TEXT,
      payloadJson TEXT NOT NULL,
      publicToken TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_requests_createdAt ON requests(createdAt);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      requestId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      direction TEXT NOT NULL, -- in/out
      channel TEXT NOT NULL,   -- email/web/forward/system
      fromEmail TEXT,
      toEmail TEXT,
      subject TEXT,
      body TEXT,
      metaJson TEXT,
      FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_requestId_createdAt ON messages(requestId, createdAt);

    CREATE TABLE IF NOT EXISTS blocked_ips (
      ip TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      startAt TEXT NOT NULL,
      endAt TEXT,
      vehicleId TEXT,
      metaJson TEXT,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_items_startAt ON calendar_items(startAt);
  `);
}
