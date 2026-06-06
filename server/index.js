import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { corsMiddleware } from "./cors.js";
import { requireApiKey } from "./auth.js";
import { inboundRequestSchema, messageSchema } from "./validation.js";
import { listCalendarItems, replaceCalendarItems } from "./calendarRepo.js";
import { buildIcs } from "./ics.js";
import { describeMailError, sendMail, smtpConfigured, verifySmtp } from "./mailer.js";
import { getSmtpSettings, saveSmtpSettings } from "./settingsRepo.js";
import { getRentalSignaturePackage, saveRentalSignaturePackage, saveSignedContract } from "./signatureRepo.js";
import {
  addMessage,
  blockIp,
  createRequest,
  deleteRequest,
  getIpForRequest,
  getRequestById,
  getRequestByToken,
  isIpBlocked,
  listRequests,
  setPriority,
  setStatus,
} from "./repo.js";

migrate();

const app = express();
app.disable("x-powered-by");
app.use(corsMiddleware);
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Inbound: Kontaktformular / externes Projekt
app.post("/api/inbound/requests", requireApiKey, (req, res) => {
  const ipAddress = req.ip;
  if (ipAddress && isIpBlocked(ipAddress)) return res.status(403).json({ error: "ip_blocked" });

  const parsed = inboundRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const { id, token } = createRequest({ payload: parsed.data, ipAddress, userAgent: req.header("user-agent") });
  return res.status(201).json({
    id,
    ticketUrl: `/public/tickets/${token}`,
  });
});

// Admin API (Portal): Tickets/Anfragen
app.get("/api/requests", requireApiKey, (req, res) => {
  const querySchema = z.object({
    status: z.string().optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_query" });
  const rows = listRequests(parsed.data);
  return res.json({ items: rows });
});

app.get("/api/requests/:id", requireApiKey, (req, res) => {
  const result = getRequestById(req.params.id);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json(result);
});

// Antworten (nur speichern; Versand kann später via Mailer integriert werden)
app.post("/api/requests/:id/reply", requireApiKey, (req, res) => {
  const result = getRequestById(req.params.id);
  if (!result) return res.status(404).json({ error: "not_found" });

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  addMessage({
    requestId: req.params.id,
    direction: "out",
    channel: "email",
    fromEmail: null,
    toEmail: parsed.data.toEmail ?? result.request.customerEmail ?? null,
    subject: parsed.data.subject ?? `Re: ${result.request.subject ?? ""}`.trim(),
    body: parsed.data.body,
    meta: { kind: "reply" },
  });

  setStatus(req.params.id, "in_bearbeitung");
  return res.status(201).json({ ok: true });
});

// Weiterleiten (Modal mit Email)
app.post("/api/requests/:id/forward", requireApiKey, (req, res) => {
  const parsed = messageSchema.extend({ toEmail: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const result = getRequestById(req.params.id);
  if (!result) return res.status(404).json({ error: "not_found" });

  addMessage({
    requestId: req.params.id,
    direction: "out",
    channel: "forward",
    fromEmail: null,
    toEmail: parsed.data.toEmail,
    subject: parsed.data.subject ?? `[FW] ${result.request.subject ?? ""}`.trim(),
    body: parsed.data.body,
    meta: { kind: "forward" },
  });

  return res.status(201).json({ ok: true });
});

// Priorisieren
app.post("/api/requests/:id/priority", requireApiKey, (req, res) => {
  const parsed = z.object({ priority: z.number().int().min(0).max(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });
  setPriority(req.params.id, parsed.data.priority);
  return res.json({ ok: true });
});

// Absage - Keine Kapazitäten
app.post("/api/requests/:id/reject-no-capacity", requireApiKey, (req, res) => {
  const parsed = z.object({ note: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });
  setStatus(req.params.id, "abgesagt");
  addMessage({
    requestId: req.params.id,
    direction: "out",
    channel: "system",
    fromEmail: null,
    toEmail: null,
    subject: "Absage: Keine Kapazitäten",
    body: parsed.data.note ?? "",
    meta: { kind: "reject_no_capacity" },
  });
  return res.json({ ok: true });
});

// IP blockieren
app.post("/api/requests/:id/block-ip", requireApiKey, (req, res) => {
  const ip = getIpForRequest(req.params.id);
  if (!ip) return res.status(400).json({ error: "no_ip_for_request" });
  const parsed = z.object({ reason: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });
  blockIp(ip, parsed.data.reason ?? "manual");
  addMessage({
    requestId: req.params.id,
    direction: "out",
    channel: "system",
    fromEmail: null,
    toEmail: null,
    subject: "IP blockiert",
    body: `IP ${ip} blockiert`,
    meta: { kind: "block_ip", ip, reason: parsed.data.reason ?? null },
  });
  return res.json({ ok: true, ip });
});

// Löschen
app.delete("/api/requests/:id", requireApiKey, (req, res) => {
  deleteRequest(req.params.id);
  return res.json({ ok: true });
});

// Miete anlegen (Stub)
app.post("/api/requests/:id/create-rental", requireApiKey, (req, res) => {
  const parsed = z.object({ note: z.string().optional() }).passthrough().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });
  const result = getRequestById(req.params.id);
  if (!result) return res.status(404).json({ error: "not_found" });
  setStatus(req.params.id, "in_bearbeitung");
  addMessage({
    requestId: req.params.id,
    direction: "out",
    channel: "system",
    fromEmail: null,
    toEmail: null,
    subject: "Miete angelegt",
    body: parsed.data.note ?? "",
    meta: { kind: "create_rental_stub" },
  });
  return res.status(201).json({ ok: true });
});

// Kalender Sync (für Webcal Feed)
app.post("/api/calendar/sync", requireApiKey, (req, res) => {
  const itemSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(["rental", "maintenance"]),
    title: z.string().min(1),
    startAt: z.string().min(1),
    endAt: z.string().nullable().optional(),
    vehicleId: z.string().nullable().optional(),
    meta: z.record(z.any()).optional(),
  });
  const parsed = z.object({ items: z.array(itemSchema).max(50_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  replaceCalendarItems(parsed.data.items);
  return res.json({ ok: true });
});

// Einstellungen: SMTP
app.get("/api/settings/smtp", requireApiKey, (_req, res) => {
  const smtp = getSmtpSettings() ?? {};
  return res.json({
    host: smtp.host ?? "",
    port: String(smtp.port ?? "587"),
    user: smtp.user ?? "",
    fromEmail: smtp.fromEmail ?? "",
    secure: Boolean(smtp.secure),
    hasPassword: Boolean(smtp.password),
  });
});

app.put("/api/settings/smtp", requireApiKey, (req, res) => {
  const parsed = z
    .object({
      host: z.string().trim().min(1),
      port: z.coerce.number().int().min(1).max(65535).default(587),
      user: z.string().trim().optional().default(""),
      password: z.string().optional(),
      fromEmail: z.string().trim().email(),
      secure: z.boolean().optional().default(false),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const existing = getSmtpSettings() ?? {};
  saveSmtpSettings({
    host: parsed.data.host,
    port: String(parsed.data.port),
    user: parsed.data.user,
    password: parsed.data.password && parsed.data.password.length > 0 ? parsed.data.password : existing.password ?? "",
    fromEmail: parsed.data.fromEmail,
    secure: parsed.data.secure,
  });

  return res.json({ ok: true });
});

app.post("/api/settings/smtp/test", requireApiKey, async (req, res) => {
  if (!smtpConfigured()) return res.status(400).json({ error: "smtp_not_configured" });
  const parsed = z.object({ toEmail: z.string().trim().email().optional() }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const smtp = getSmtpSettings() ?? {};
  const toEmail = parsed.data.toEmail ?? smtp.fromEmail;
  if (!toEmail) return res.status(400).json({ error: "smtp_to_missing" });

  try {
    const result = await sendMail({
      to: [toEmail],
      subject: "Transit on Tour SMTP-Test",
      text: "SMTP ist eingerichtet. Diese Testmail wurde aus den Einstellungen versendet.",
    });
    return res.status(201).json({ ok: true, messageId: result.messageId });
  } catch (e) {
    return res.status(500).json({ error: "smtp_test_failed", message: describeMailError(e) });
  }
});

app.post("/api/settings/smtp/verify", requireApiKey, async (_req, res) => {
  if (!smtpConfigured()) return res.status(400).json({ error: "smtp_not_configured" });
  try {
    await verifySmtp();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "smtp_verify_failed", message: describeMailError(e) });
  }
});

// Digitale Signatur Mietvertrag
app.put("/api/rentals/:rentalId/signature-package", requireApiKey, (req, res) => {
  const parsed = z.object({ rental: z.object({ id: z.string().min(1) }).passthrough() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  if (parsed.data.rental.id !== req.params.rentalId) return res.status(400).json({ error: "rental_id_mismatch" });
  saveRentalSignaturePackage(req.params.rentalId, parsed.data.rental);
  return res.json({ ok: true });
});

app.get("/api/rentals/:rentalId/signature-package", requireApiKey, (req, res) => {
  const result = getRentalSignaturePackage(req.params.rentalId);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json({ rental: result.rental, signedContract: result.signedContract });
});

app.get("/public/rentals/:rentalId/signature-package", (req, res) => {
  const result = getRentalSignaturePackage(req.params.rentalId);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json({ rental: result.rental, signedContract: result.signedContract });
});

app.post("/public/rentals/:rentalId/signature-package/sign", (req, res) => {
  const digitalSignatureSchema = z.object({
    signer: z.enum(["tenant1", "tenant2"]),
    signerName: z.string(),
    signatureDataUrl: z.string().min(1),
    signedAt: z.string().min(1),
  });
  const signedContractSchema = z.object({
    filename: z.string().min(1),
    contentBase64: z.string().min(1),
    contentType: z.string().min(1),
    uploadedAt: z.string().min(1),
    signedAt: z.string().min(1),
    source: z.enum(["digital", "paper"]),
    digitalSignatures: z.array(digitalSignatureSchema).optional(),
  });
  const parsed = z.object({ signedContract: signedContractSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  const saved = saveSignedContract(req.params.rentalId, parsed.data.signedContract);
  if (!saved) return res.status(404).json({ error: "not_found" });
  return res.status(201).json({ ok: true });
});

// Mail Versand
app.post("/api/mail/send", requireApiKey, async (req, res) => {
  if (!smtpConfigured()) return res.status(400).json({ error: "smtp_not_configured" });
  const attachmentSchema = z.object({
    filename: z.string().min(1),
    contentBase64: z.string().min(1),
    contentType: z.string().optional(),
  });
  const parsed = z
    .object({
      to: z.array(z.string().email()).min(1),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      subject: z.string().optional(),
      text: z.string().optional(),
      html: z.string().optional(),
      attachments: z.array(attachmentSchema).max(20).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const result = await sendMail(parsed.data);
    return res.status(201).json({ ok: true, messageId: result.messageId });
  } catch (e) {
    return res.status(500).json({ error: "mail_send_failed", message: describeMailError(e) });
  }
});

// Public Webcal Feed: Token via Query (kein Header möglich)
app.get("/public/calendar.ics", (req, res) => {
  const token = String(req.query.token ?? "");
  const expected = config.calendarToken && config.calendarToken.trim().length > 0 ? config.calendarToken : config.apiKey;
  if (!token || token !== expected) return res.status(401).json({ error: "unauthorized" });

  const items = listCalendarItems();
  const events = items.map((it) => {
    const start = new Date(it.startAt);
    const endBase = it.endAt ? new Date(it.endAt) : start;
    const end = new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate() + 1, 0, 0, 0);
    return {
      uid: `tot-${it.kind}-${it.id}`,
      title: it.title,
      startAt: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString(),
      endAt: end.toISOString(),
      allDay: true,
      description: it.vehicleId ? `vehicleId=${it.vehicleId}` : undefined,
    };
  });

  const ics = buildIcs({ name: "Transit on Tour Kalender", prodId: "-//Transit on Tour//Kalender//DE", events });
  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  return res.status(200).send(ics);
});

// Public Ticket Link: Kunde kann Verlauf sehen & antworten
app.get("/public/tickets/:token", (req, res) => {
  const result = getRequestByToken(req.params.token);
  if (!result) return res.status(404).json({ error: "not_found" });

  // Schutz: keine internen Felder (ip, userAgent, apiKey, etc.)
  return res.json({
    request: {
      id: result.request.id,
      createdAt: result.request.createdAt,
      updatedAt: result.request.updatedAt,
      status: result.request.status,
      subject: result.request.subject,
      customerName: result.request.customerName,
      customerEmail: result.request.customerEmail,
    },
    messages: result.messages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      direction: m.direction,
      channel: m.channel,
      subject: m.subject,
      body: m.body,
    })),
  });
});

app.post("/public/tickets/:token/reply", (req, res) => {
  const result = getRequestByToken(req.params.token);
  if (!result) return res.status(404).json({ error: "not_found" });
  const parsed = z
    .object({
      fromEmail: z.string().email().optional(),
      body: z.string().min(1),
    })
    .passthrough()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });

  addMessage({
    requestId: result.request.id,
    direction: "in",
    channel: "web",
    fromEmail: parsed.data.fromEmail ?? result.request.customerEmail ?? null,
    toEmail: null,
    subject: `Re: ${result.request.subject ?? ""}`.trim(),
    body: parsed.data.body,
    meta: { kind: "public_reply" },
  });
  setStatus(result.request.id, "neu");
  return res.status(201).json({ ok: true });
});

// Frontend (SPA) aus dist/ ausliefern (Production)
const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "..", "dist");
const distIndex = path.join(distDir, "index.html");

// Debug helper (protected): hilft bei Whitescreen/Deployments
app.get("/api/debug/static", requireApiKey, (_req, res) => {
  let indexHead = null;
  try {
    if (fs.existsSync(distIndex)) {
      indexHead = fs.readFileSync(distIndex, "utf8").slice(0, 600);
    }
  } catch {
    indexHead = null;
  }
  return res.json({
    cwd: process.cwd(),
    serverDir: here,
    distDir,
    distIndex,
    distIndexExists: fs.existsSync(distIndex),
    distFiles: fs.existsSync(distDir) ? fs.readdirSync(distDir).slice(0, 50) : [],
    indexHead,
  });
});

// Debug helper (token via query, falls Header nicht gesetzt werden kann)
app.get("/public/debug/static", (req, res) => {
  const token = String(req.query.token ?? "");
  const expected = config.calendarToken && config.calendarToken.trim().length > 0 ? config.calendarToken : config.apiKey;
  if (!token || token !== expected) return res.status(401).json({ error: "unauthorized" });

  let indexHead = null;
  try {
    if (fs.existsSync(distIndex)) {
      indexHead = fs.readFileSync(distIndex, "utf8").slice(0, 600);
    }
  } catch {
    indexHead = null;
  }
  return res.json({
    cwd: process.cwd(),
    serverDir: here,
    distDir,
    distIndex,
    distIndexExists: fs.existsSync(distIndex),
    distFiles: fs.existsSync(distDir) ? fs.readdirSync(distDir).slice(0, 50) : [],
    indexHead,
  });
});

if (fs.existsSync(distIndex)) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) res.setHeader("cache-control", "no-store");
        // Some hosts/proxies mis-detect MIME types for module scripts. Force correct types for common assets.
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) res.setHeader("content-type", "application/javascript; charset=utf-8");
        if (filePath.endsWith(".css")) res.setHeader("content-type", "text/css; charset=utf-8");
        if (filePath.endsWith(".svg")) res.setHeader("content-type", "image/svg+xml");
      },
    }),
  );
  app.get(/^\/(?!api(?:\/|$)|public(?:\/|$)).*/, (req, res) => {
    res.setHeader("cache-control", "no-store");
    return res.sendFile(distIndex);
  });
}

app.use((err, _req, res, _next) => {
  if (String(err?.message || "").includes("CORS")) return res.status(403).json({ error: "cors_not_allowed" });
  return res.status(500).json({ error: "server_error" });
});

const server = app.listen(config.port, () => {
  console.log(`[portal-api] listening on http://localhost:${config.port}`);
});

server.on("error", (err) => {
  console.error("[portal-api] failed to start", err);
  process.exit(1);
});
