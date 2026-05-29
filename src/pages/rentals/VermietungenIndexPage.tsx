import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Rental } from "../../domain/rental";
import { getRentalStatus, listRentals, type RentalStatus } from "../../storage/rentalRepo";
import { formatDateTime, formatEur, rentalPillClass, statusLabel } from "./rentalUi";

function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function matchesQuery(r: Rental, q: string): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return true;
  const hay = [
    r.id,
    r.tenant?.name,
    r.tenant?.email,
    r.vehicle?.label,
    r.vehicle?.licensePlate,
    ...r.additionalDrivers.map((d) => d.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qq);
}

export default function VermietungenIndexPage() {
  const [tab, setTab] = useState<RentalStatus>("laufend");
  const [q, setQ] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("");

  const rentals = listRentals();

  const computed = useMemo(() => {
    const now = new Date();
    const items = rentals.map((r) => ({ r, meta: getRentalStatus(r, now) }));
    const counts = {
      laufend: items.filter((x) => x.meta.status === "laufend").length,
      geplant: items.filter((x) => x.meta.status === "geplant").length,
      archiv: items.filter((x) => x.meta.status === "archiv").length,
      overdue: items.filter((x) => x.meta.overdue).length,
    };

    const filtered = items
      .filter((x) => x.meta.status === tab)
      .filter((x) => matchesQuery(x.r, q))
      .filter((x) => (vehicleId ? x.r.vehicle.vehicleId === vehicleId : true))
      .sort((a, b) => b.r.startAt.localeCompare(a.r.startAt));

    return { filtered, counts };
  }, [rentals, tab, q, vehicleId]);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Vermietungen</h2>
            <p className="mt-1 text-xs text-slate-500">Laufende, geplante und archivierte Mieten – mit Fokus auf schnelle Bearbeitung.</p>
          </div>
          <Link
            to="/vermietungen/neu"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Neue Vermietung
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex flex-wrap gap-2">
            {(["laufend", "geplant", "archiv"] as const).map((t) => {
              const active = tab === t;
              const label = statusLabel(t);
              const count = computed.counts[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition",
                    active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>{label}</span>
                  <span className={classNames("inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold", active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700")}>
                    {count}
                  </span>
                </button>
              );
            })}
            {computed.counts.overdue > 0 ? (
              <span className="inline-flex items-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Überfällig: {computed.counts.overdue}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2 md:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              placeholder="Suche: Mieter, Kennzeichen, ID…"
            />
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="">Alle Fahrzeuge</option>
              {Array.from(new Map(rentals.map((r) => [r.vehicle.vehicleId, r.vehicle.label])).entries()).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {computed.filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Keine Vermietungen in dieser Ansicht.</div>
        ) : (
          computed.filtered.map(({ r, meta }) => (
            <Link
              key={r.id}
              to={`/vermietungen/${encodeURIComponent(r.id)}`}
              className={classNames(
                "rounded-2xl border bg-white p-4 shadow-sm transition hover:bg-slate-50",
                meta.overdue ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.tenant.name || "Ohne Name"}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{r.vehicle.label}</div>
                </div>
                <Pill text={meta.overdue ? "Überfällig" : statusLabel(meta.status)} className={rentalPillClass(r)} />
              </div>
              <div className="mt-3 text-xs text-slate-600">
                {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Zahlung: {r.payment.status} • {formatEur(r.payment.totalEur)}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop table */}
      <section className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Mieter</th>
                <th className="px-5 py-3">Fahrzeug</th>
                <th className="px-5 py-3">Zeitraum</th>
                <th className="px-5 py-3">Zahlung</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computed.filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-sm text-slate-600">
                    Keine Vermietungen in dieser Ansicht.
                  </td>
                </tr>
              ) : (
                computed.filtered.map(({ r, meta }) => (
                  <tr key={r.id} className={meta.overdue ? "bg-rose-50/40" : ""}>
                    <td className="px-5 py-4">
                      <Link to={`/vermietungen/${encodeURIComponent(r.id)}`} className="font-semibold text-slate-900 hover:underline">
                        {r.tenant.name || "Ohne Name"}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">{r.tenant.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{r.vehicle.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{r.vehicle.licensePlate}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div>{formatDateTime(r.startAt)}</div>
                      <div>→ {formatDateTime(r.endAt)}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="font-semibold text-slate-900">{formatEur(r.payment.totalEur)}</div>
                      <div className="mt-1">Status: {r.payment.status}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Pill text={meta.overdue ? "Überfällig" : statusLabel(meta.status)} className={rentalPillClass(r)} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/vermietungen/${encodeURIComponent(r.id)}`}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Öffnen
                        </Link>
                        <Link
                          to={`/vermietungen/${encodeURIComponent(r.id)}?edit=1`}
                          className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                        >
                          Bearbeiten
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
