import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRequests, type RequestListItem } from "../../api/portalApi";
import { Card, StatusPill } from "./UiParts";
import { formatDateTime } from "./uiUtils";

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
    </label>
  );
}

export default function AnfragenIndexPage() {
  const [items, setItems] = useState<RequestListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listRequests({ status: status || undefined, q: q || undefined, limit: 200 });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const neu = items.filter((i) => i.status === "neu").length;
    const inBearbeitung = items.filter((i) => i.status === "in_bearbeitung").length;
    return { total, neu, inBearbeitung };
  }, [items]);

  return (
    <div className="grid gap-6">
      <Card
        title="Anfragen"
        subtitle="Übersicht aller eingehenden Tickets. API-Key kommt aus `VITE_PORTAL_API_KEY`."
        right={
          <button
            type="button"
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => void load()}
          >
            Aktualisieren
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gesamt</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Neu</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{stats.neu}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">In Bearbeitung</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{stats.inBearbeitung}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            >
              <option value="">Alle</option>
              <option value="neu">Neu</option>
              <option value="in_bearbeitung">In Bearbeitung</option>
              <option value="abgesagt">Abgesagt</option>
            </select>
          </Field>
          <Field label="Suche">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="Name, Email, Betreff, ID…"
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={() => void load()}
            >
              Filtern
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => {
                setStatus("");
                setQ("");
                void load();
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

        {/* Mobile cards */}
        <div className="mt-4 grid gap-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Lädt…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Keine Anfragen gefunden.
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                to={`/anfragen/${item.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{item.subject ?? "—"}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.id}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold text-slate-700">Prio {item.priority}</div>
                    <div className="mt-1">
                      <StatusPill status={item.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-700">
                  <div className="truncate">{item.customerName ?? "—"}</div>
                  <div className="truncate text-xs text-slate-500">{item.customerEmail ?? "—"}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500">Update: {formatDateTime(item.updatedAt)}</div>
              </Link>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-4 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[860px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Priorität</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Betreff</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Letztes Update</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={6}>
                    Lädt…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={6}>
                    Keine Anfragen gefunden.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-900">
                    <td className="px-4 py-3 font-semibold">{item.priority}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.subject ?? "—"}</div>
                      <div className="text-xs text-slate-500">{item.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{item.customerName ?? "—"}</div>
                      <div className="text-xs text-slate-500">{item.customerEmail ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/anfragen/${item.id}`}
                        className="text-xs font-semibold text-slate-900 hover:text-slate-700"
                      >
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
