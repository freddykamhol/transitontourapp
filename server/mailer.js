import nodemailer from "nodemailer";
import { config } from "./config.js";

export function smtpConfigured() {
  return Boolean(config.smtp?.host && config.smtp?.fromEmail);
}

export function getTransport() {
  if (!config.smtp?.host) throw new Error("smtp_not_configured");
  const port = Number(config.smtp.port ?? 587);
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: Number.isFinite(port) ? port : 587,
    secure: Boolean(config.smtp.secure),
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password ?? "" } : undefined,
  });
}

export async function sendMail(params) {
  const transport = getTransport();
  const fromEmail = config.smtp.fromEmail;
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
