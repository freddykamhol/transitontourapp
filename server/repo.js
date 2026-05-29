import { db } from "./db.js";
import { createId, createToken } from "./id.js";

function nowIso() {
  return new Date().toISOString();
}

export function isIpBlocked(ip) {
  const row = db.prepare("SELECT ip FROM blocked_ips WHERE ip = ?").get(ip);
  return Boolean(row);
}

export function blockIp(ip, reason) {
  db.prepare("INSERT OR REPLACE INTO blocked_ips(ip, createdAt, reason) VALUES (?, ?, ?)").run(ip, nowIso(), reason ?? null);
}

export function createRequest({ payload, ipAddress, userAgent }) {
  const id = createId("req");
  const token = createToken();
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const customerName = payload?.customer?.name ?? null;
  const customerEmail = payload?.customer?.email ?? null;
  const subject = payload?.subject ?? "Kontaktanfrage";
  const source = payload?.source ?? "transitontourpublic";

  db.prepare(
    `INSERT INTO requests(
      id, createdAt, updatedAt, status, priority, source, customerEmail, customerName, subject, payloadJson, publicToken, ipAddress, userAgent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    createdAt,
    updatedAt,
    "neu",
    0,
    source,
    customerEmail,
    customerName,
    subject,
    JSON.stringify(payload ?? {}),
    token,
    ipAddress ?? null,
    userAgent ?? null,
  );

  if (payload?.message) {
    addMessage({
      requestId: id,
      direction: "in",
      channel: "web",
      fromEmail: customerEmail ?? null,
      toEmail: null,
      subject,
      body: payload.message,
      meta: { kind: "initial" },
    });
  }

  return { id, token };
}

export function addMessage({ requestId, direction, channel, fromEmail, toEmail, subject, body, meta }) {
  const id = createId("msg");
  db.prepare(
    `INSERT INTO messages(id, requestId, createdAt, direction, channel, fromEmail, toEmail, subject, body, metaJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, requestId, nowIso(), direction, channel, fromEmail ?? null, toEmail ?? null, subject ?? null, body ?? null, meta ? JSON.stringify(meta) : null);
  db.prepare("UPDATE requests SET updatedAt = ? WHERE id = ?").run(nowIso(), requestId);
  return id;
}

export function listRequests({ status, q, limit }) {
  const where = [];
  const params = {};

  if (status) {
    where.push("status = @status");
    params.status = status;
  }

  if (q) {
    where.push("(customerName LIKE @q OR customerEmail LIKE @q OR subject LIKE @q OR id LIKE @q)");
    params.q = `%${q}%`;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT id, createdAt, updatedAt, status, priority, source, customerEmail, customerName, subject, ipAddress
       FROM requests
       ${whereSql}
       ORDER BY priority DESC, updatedAt DESC
       LIMIT @limit`,
    )
    .all({ ...params, limit: limit ?? 100 });

  return rows;
}

export function getRequestById(id) {
  const req = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
  if (!req) return null;
  const messages = db.prepare("SELECT * FROM messages WHERE requestId = ? ORDER BY createdAt ASC").all(id);
  return { request: { ...req, payload: JSON.parse(req.payloadJson) }, messages };
}

export function getRequestByToken(token) {
  const req = db.prepare("SELECT * FROM requests WHERE publicToken = ?").get(token);
  if (!req) return null;
  const messages = db.prepare("SELECT * FROM messages WHERE requestId = ? ORDER BY createdAt ASC").all(req.id);
  return { request: { ...req, payload: JSON.parse(req.payloadJson) }, messages };
}

export function setPriority(id, priority) {
  db.prepare("UPDATE requests SET priority = ?, updatedAt = ? WHERE id = ?").run(priority, nowIso(), id);
}

export function setStatus(id, status) {
  db.prepare("UPDATE requests SET status = ?, updatedAt = ? WHERE id = ?").run(status, nowIso(), id);
}

export function deleteRequest(id) {
  db.prepare("DELETE FROM requests WHERE id = ?").run(id);
}

export function getIpForRequest(id) {
  const row = db.prepare("SELECT ipAddress FROM requests WHERE id = ?").get(id);
  return row?.ipAddress ?? null;
}

