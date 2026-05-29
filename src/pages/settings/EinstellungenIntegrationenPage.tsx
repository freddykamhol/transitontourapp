import { useMemo, useState } from "react";
import { portalApiBaseUrl, portalCalendarToken } from "../../api/portalApi";

type SmtpSettings = {
  host: string;
  port: string;
  user: string;
  password: string;
  fromEmail: string;
  secure: boolean;
};

const SMTP_KEY = "tot.settings.smtp.v1";

function loadSmtp(): SmtpSettings {
  try {
    const raw = localStorage.getItem(SMTP_KEY);
    if (!raw) throw new Error("missing");
    const parsed = JSON.parse(raw) as Partial<SmtpSettings>;
    return {
      host: parsed.host ?? "",
      port: parsed.port ?? "587",
      user: parsed.user ?? "",
      password: parsed.password ?? "",
      fromEmail: parsed.fromEmail ?? "",
      secure: Boolean(parsed.secure),
    };
  } catch {
    return { host: "", port: "587", user: "", password: "", fromEmail: "", secure: false };
  }
}

function saveSmtp(value: SmtpSettings) {
  localStorage.setItem(SMTP_KEY, JSON.stringify(value));
}

export default function EinstellungenIntegrationenPage() {
  const [smtp, setSmtp] = useState<SmtpSettings>(() => loadSmtp());
  const [savedAt, setSavedAt] = useState<string>("");

  const webcalHttpUrl = useMemo(() => {
    const token = portalCalendarToken();
    const base = portalApiBaseUrl();
    return `${base}/public/calendar.ics?token=${encodeURIComponent(token)}`;
  }, []);
  const webcalUrl = useMemo(() => webcalHttpUrl.replace(/^https?:\/\//, "webcal://"), [webcalHttpUrl]);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">SMTP (Mail)</h3>
        <p className="mt-1 text-xs text-slate-500">Platzhalter: Wird später für Versand/Benachrichtigungen genutzt.</p>

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
              value={smtp.password}
              onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              placeholder="••••••••"
            />
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">{savedAt ? `Gespeichert: ${savedAt}` : "Noch nicht gespeichert"}</div>
          <button
            type="button"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px"
            onClick={() => {
              saveSmtp(smtp);
              setSavedAt(new Date().toLocaleString());
            }}
          >
            Speichern
          </button>
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
