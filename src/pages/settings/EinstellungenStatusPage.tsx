import { useCallback, useEffect, useMemo, useState } from "react";
import { portalApiBaseUrl, portalCalendarToken } from "../../api/portalApi";

type CheckResult = {
  ok: boolean;
  label: string;
  detail?: string;
  latencyMs?: number;
  checkedAt: string;
};

function StatusPill(props: { ok: boolean; text: string }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        props.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      ].join(" ")}
    >
      {props.text}
    </span>
  );
}

export default function EinstellungenStatusPage() {
  const apiBase = useMemo(() => portalApiBaseUrl(), []);
  const calendarUrl = useMemo(() => `${apiBase}/public/calendar.ics?token=${encodeURIComponent(portalCalendarToken())}`, [apiBase]);

  const [apiHealth, setApiHealth] = useState<CheckResult | null>(null);
  const [calendarHealth, setCalendarHealth] = useState<CheckResult | null>(null);

  const runChecks = useCallback(async () => {
    const now = new Date().toLocaleString();

    try {
      const t0 = performance.now();
      const res = await fetch(`${apiBase}/api/health`, { method: "GET" });
      const t1 = performance.now();
      setApiHealth({
        ok: res.ok,
        label: "Portal API",
        detail: res.ok ? "Antwortet" : `HTTP ${res.status}`,
        latencyMs: Math.round(t1 - t0),
        checkedAt: now,
      });
    } catch (e) {
      setApiHealth({ ok: false, label: "Portal API", detail: e instanceof Error ? e.message : "Fehler", checkedAt: now });
    }

    try {
      const t0 = performance.now();
      const res = await fetch(calendarUrl, { method: "GET" });
      const t1 = performance.now();
      const ct = res.headers.get("content-type") ?? "";
      setCalendarHealth({
        ok: res.ok,
        label: "WebCAL Feed",
        detail: res.ok ? `OK (${ct.split(";")[0] || "content-type"})` : `HTTP ${res.status}`,
        latencyMs: Math.round(t1 - t0),
        checkedAt: now,
      });
    } catch (e) {
      setCalendarHealth({ ok: false, label: "WebCAL Feed", detail: e instanceof Error ? e.message : "Fehler", checkedAt: now });
    }
  }, [apiBase, calendarUrl]);

  useEffect(() => {
    const id = window.setTimeout(() => void runChecks(), 0);
    return () => window.clearTimeout(id);
  }, [runChecks]);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Status</h3>
            <p className="mt-1 text-xs text-slate-500">Kurzcheck: Läuft Server/API? Erreicht der Browser den Feed?</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px"
            onClick={() => void runChecks()}
          >
            Neu prüfen
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Browser</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Online Status</div>
              <StatusPill ok={navigator.onLine} text={navigator.onLine ? "Online" : "Offline"} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Wenn „Offline“, können API/Feed nicht geprüft werden.</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Endpoints</div>
            <div className="mt-2 grid gap-2 text-xs font-semibold text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">API Base</span>
                <span className="truncate font-mono text-[11px] text-slate-600">{apiBase}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">WebCAL</span>
                <span className="truncate font-mono text-[11px] text-slate-600">{calendarUrl}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Checks</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[apiHealth, calendarHealth].map((c) => {
            if (!c) return null;
            return (
              <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{c.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{c.detail ?? ""}</div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {c.checkedAt}
                      {typeof c.latencyMs === "number" ? ` · ${c.latencyMs}ms` : ""}
                    </div>
                  </div>
                  <StatusPill ok={c.ok} text={c.ok ? "OK" : "Fehler"} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
