import { Link } from "react-router-dom";
import { listVehicles } from "../../storage/vehicleRepo";
import { formatStatus, statusPillClass } from "./vehiclesUi";

function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

export default function FahrzeugeIndexPage() {
  const vehicles = listVehicles();

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Fahrzeuge</h2>
            <p className="mt-1 text-xs text-slate-500">Bestand verwalten, Kilometerstände und Schäden dokumentieren.</p>
          </div>
          <Link
            to="/fahrzeug/neu"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Fahrzeug anlegen
          </Link>
        </div>

        {/* Mobile cards */}
        <div className="mt-4 grid gap-3 md:hidden">
          {vehicles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Noch keine Fahrzeuge. Lege dein erstes Fahrzeug an.
            </div>
          ) : (
            vehicles.map((v) => (
              <Link
                key={v.id}
                to={`/fahrzeug/${v.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{v.licensePlate}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      {v.internalNumber ? ` • Nr. ${v.internalNumber}` : ""}
                    </div>
                  </div>
                  <Pill text={formatStatus(v.status)} className={statusPillClass(v.status)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>KM: {typeof v.currentKm === "number" ? `${v.currentKm}` : "—"}</span>
                  <span>Schäden: {v.openDamages}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-4 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[860px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Kennzeichen</th>
                <th className="px-4 py-3">Fahrzeug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Schäden</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {vehicles.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={6}>
                    Noch keine Fahrzeuge. Lege dein erstes Fahrzeug an.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="text-sm text-slate-900">
                    <td className="px-4 py-3 font-semibold">{v.licensePlate}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      {v.internalNumber ? <div className="text-xs text-slate-500">Nr. {v.internalNumber}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Pill text={formatStatus(v.status)} className={statusPillClass(v.status)} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {typeof v.currentKm === "number" ? `${v.currentKm} km` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{v.openDamages}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/fahrzeug/${v.id}`}
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
      </section>
    </div>
  );
}
