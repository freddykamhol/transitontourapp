import { useEffect, useMemo, useState } from "react";
import { getSmtpSettings, portalApiBaseUrl, portalCalendarToken, saveSmtpSettings, testSmtpSettings, verifySmtpSettings } from "../../api/portalApi";

type SmtpSettings = {
  host: string;
  port: string;
  user: string;
  password: string;
  fromEmail: string;
  testEmail: string;
  secure: boolean;
  hasPassword: boolean;
};

function emptySmtp(): SmtpSettings {
  return { host: "", port: "587", user: "", password: "", fromEmail: "", testEmail: "", secure: false, hasPassword: false };
}

function validateSmtp(value: SmtpSettings): string {
  if (!value.host.trim()) return "Bitte SMTP-Host eintragen.";
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "Bitte einen gültigen SMTP-Port eintragen.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.fromEmail.trim())) return "Bitte eine gültige Absender-E-Mail eintragen.";
  return "";
}

function normalizeSmtpForSave(value: SmtpSettings, testEmail: string): SmtpSettings {
  const password = /^[•●*]+$/.test(value.password.trim()) ? "" : value.password;
  return { ...value, password, testEmail };
}

export default function EinstellungenIntegrationenPage() {
  const [smtp, setSmtp] = useState<SmtpSettings>(() => emptySmtp());
  const [savedAt, setSavedAt] = useState<string>("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"load" | "save" | "verify" | "test" | "">("load");
  const [testEmail, setTestEmail] = useState("");

  const webcalHttpUrl = useMemo(() => {
    const token = portalCalendarToken();
    const base = portalApiBaseUrl();
    return `${base}/public/calendar.ics?token=${encodeURIComponent(token)}`;
  }, []);
  const webcalUrl = useMemo(() => webcalHttpUrl.replace(/^https?:\/\//, "webcal://"), [webcalHttpUrl]);

  useEffect(() => {
    let cancelled = false;
    getSmtpSettings()
      .then((value) => {
        if (cancelled) return;
        setSmtp({ ...value, password: "" });
        setTestEmail(value.testEmail || value.fromEmail);
        setStatus(value.host ? "SMTP-Konfiguration geladen." : "Noch keine SMTP-Konfiguration gespeichert.");
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "SMTP-Konfiguration konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setBusy("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">SMTP (Mail)</h3>
        <p className="mt-1 text-xs text-slate-500">Diese Daten nutzt der Server für Mietunterlagen, Antworten und Benachrichtigungen.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Host</span>
            <input
              value={smtp.host}
              onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="smtp.example.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Port</span>
            <input
              value={smtp.port}
              onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="587"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Benutzer</span>
            <input
              value={smtp.user}
              onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="user@example.com"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Passwort</span>
            <input
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={smtp.password}
              onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder={smtp.hasPassword ? "gespeichert - leer lassen zum Beibehalten" : "••••••••"}
            />
            {smtp.hasPassword ? (
              <span className="text-xs text-slate-500">
                Ein Passwort ist gespeichert. Nur ein echtes Mailbox-/App-Passwort ersetzt es.
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Absender (From)</span>
            <input
              value={smtp.fromEmail}
              onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="noreply@deine-domain.de"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp((s) => ({ ...s, secure: e.target.checked }))} />
            TLS/SSL (secure)
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Testmail an</span>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => {
                setTestEmail(e.target.value);
                setSmtp((s) => ({ ...s, testEmail: e.target.value }));
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="test@example.com"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">
            {status || (savedAt ? `Gespeichert: ${savedAt}` : "Noch nicht gespeichert")}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy === "load" || busy === "save"}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                const validationError = validateSmtp(smtp);
                if (validationError) {
                  setStatus(validationError);
                  return;
                }
                setBusy("save");
                setStatus("");
                try {
                  await saveSmtpSettings(normalizeSmtpForSave(smtp, testEmail));
                  setSmtp((s) => ({ ...s, password: "", hasPassword: s.hasPassword || Boolean(s.password) }));
                  setSavedAt(new Date().toLocaleString());
                  setStatus("SMTP gespeichert.");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
                } finally {
                  setBusy("");
                }
              }}
            >
              Speichern {busy === "save" ? "…" : ""}
            </button>
            <button
              type="button"
              disabled={busy === "load" || busy === "verify"}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                const validationError = validateSmtp(smtp);
                if (validationError) {
                  setStatus(validationError);
                  return;
                }
                setBusy("verify");
                setStatus("");
                try {
                  await saveSmtpSettings(normalizeSmtpForSave(smtp, testEmail));
                  setSmtp((s) => ({ ...s, password: "", hasPassword: s.hasPassword || Boolean(s.password) }));
                  setSavedAt(new Date().toLocaleString());
                  await verifySmtpSettings();
                  setStatus("SMTP-Verbindung erfolgreich geprüft.");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "SMTP-Verbindung fehlgeschlagen.");
                } finally {
                  setBusy("");
                }
              }}
            >
              Verbindung prüfen {busy === "verify" ? "…" : ""}
            </button>
            <button
              type="button"
              disabled={busy === "load" || busy === "test"}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                const validationError = validateSmtp(smtp);
                if (validationError) {
                  setStatus(validationError);
                  return;
                }
                setBusy("test");
                setStatus("");
                try {
                  await saveSmtpSettings(normalizeSmtpForSave(smtp, testEmail));
                  setSmtp((s) => ({ ...s, password: "", hasPassword: s.hasPassword || Boolean(s.password) }));
                  setSavedAt(new Date().toLocaleString());
                  await testSmtpSettings(testEmail || undefined);
                  setStatus("SMTP gespeichert und Testmail versendet.");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Testmail fehlgeschlagen.");
                } finally {
                  setBusy("");
                }
              }}
            >
              Testmail senden {busy === "test" ? "…" : ""}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">WebCAL</h3>
        <p className="mt-1 text-xs text-slate-500">Kalender-Abo für Apple/Google/Outlook (wird live aktualisiert).</p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Abo-Link</div>
          <div className="mt-2 truncate font-mono text-xs text-slate-700">{webcalUrl}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
              onClick={async () => {
                await navigator.clipboard.writeText(webcalUrl);
              }}
            >
              Link kopieren
            </button>
            <a
              className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px"
              href={webcalUrl}
            >
              Öffnen
            </a>
            <a
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
              href={webcalHttpUrl}
              target="_blank"
              rel="noreferrer"
            >
              ICS anzeigen
            </a>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Tipp: Falls der Kalender leer ist, zuerst im Kalender auf „Sofort einrichten“ klicken (sync).
          </div>
        </div>
      </section>
    </div>
  );
}
