import nodemailer from "nodemailer";
import { getSmtpSettings } from "./settingsRepo.js";

function currentSmtpConfig() {
  const stored = getSmtpSettings();
  if (stored?.host && stored?.fromEmail) return stored;
  return null;
}

export function smtpConfigured() {
  const smtp = currentSmtpConfig();
  return Boolean(smtp?.host && smtp?.fromEmail);
}

export function getTransport() {
  const smtp = currentSmtpConfig();
  if (!smtp?.host) throw new Error("smtp_not_configured");
  const port = Number(smtp.port ?? 587);
  return nodemailer.createTransport({
    host: smtp.host,
    port: Number.isFinite(port) ? port : 587,
    secure: Boolean(smtp.secure),
    auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? "" } : undefined,
  });
}

export async function verifySmtp() {
  const transport = getTransport();
  await transport.verify();
}

export function describeMailError(error) {
  const code = error?.code ? String(error.code) : "";
  const command = error?.command ? String(error.command) : "";
  const responseCode = error?.responseCode ? String(error.responseCode) : "";
  const response = error?.response ? String(error.response) : "";
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (code === "ECONNREFUSED" || rawMessage.includes("ECONNREFUSED")) {
    return "SMTP-Verbindung abgelehnt. Bitte Host, Port und TLS/SSL prüfen. Für Port 587 TLS/SSL meist ausschalten, für Port 465 einschalten.";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET") {
    return `SMTP-Verbindung fehlgeschlagen${command ? ` (${command})` : ""}: ${rawMessage}`;
  }
  if (code === "EAUTH" || responseCode === "535") {
    return "SMTP-Anmeldung fehlgeschlagen. Bitte Benutzername, Passwort/App-Passwort und Absenderadresse prüfen.";
  }
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID" || rawMessage.includes("cert's altnames")) {
    return "SMTP-TLS-Zertifikat passt nicht zum Host. Bitte den SMTP-Servernamen des Providers verwenden, nicht die eigene Domain.";
  }
  if (responseCode === "530" || responseCode === "550" || responseCode === "553") {
    return `SMTP-Server lehnt die Mail ab${response ? `: ${response}` : "."}`;
  }
  return rawMessage;
}

export async function sendMail(params) {
  const transport = getTransport();
  const smtp = currentSmtpConfig();
  const fromEmail = smtp?.fromEmail;
  if (!fromEmail) throw new Error("smtp_from_missing");

  const info = await transport.sendMail({
    from: fromEmail,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject ?? "",
    text: params.text ?? "",
    html: params.html,
    attachments: (params.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, "base64"),
      contentType: a.contentType ?? "application/octet-stream",
    })),
  });

  return { messageId: info.messageId ?? null };
}
