import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { InventoryKind } from "../../domain/vehicle";
import { listVehicles } from "../../storage/vehicleRepo";
import { formatStatus, inventoryKindLabel, statusPillClass, vehicleDisplayName } from "./vehiclesUi";

function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

function SegmentedButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-2xl px-4 py-2 text-xs font-semibold transition",
        props.active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

export default function FahrzeugeIndexPage() {
  const [kind, setKind] = useState<InventoryKind>("vehicle");
  const inventory = listVehicles();
  const vehicles = useMemo(() => inventory.filter((item) => (item.kind ?? "vehicle") === "vehicle"), [inventory]);
  const equipment = useMemo(() => inventory.filter((item) => (item.kind ?? "vehicle") === "equipment"), [inventory]);
  const items = kind === "vehicle" ? vehicles : equipment;
  const emptyLabel = kind === "vehicle" ? "Noch keine Fahrzeuge. Lege dein erstes Fahrzeug an." : "Noch keine Geräte. Lege dein erstes Gerät an.";

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Inventar</h2>
            <p className="mt-1 text-xs text-slate-500">Fahrzeuge und Geräte verwalten, Schäden dokumentieren und Zubehör für Fahrzeugmieten konfigurieren.</p>
          </div>
          <Link
            to="/fahrzeug/neu"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Inventar anlegen
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-3xl border border-slate-200 bg-slate-50 p-1">
            <SegmentedButton active={kind === "vehicle"} onClick={() => setKind("vehicle")}>Fahrzeuge ({vehicles.length})</SegmentedButton>
            <SegmentedButton active={kind === "equipment"} onClick={() => setKind("equipment")}>Geräte ({equipment.length})</SegmentedButton>
          </div>
          <div className="text-xs font-semibold text-slate-500">{items.length} {kind === "vehicle" ? "Fahrzeug(e)" : "Gerät(e)"}</div>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyLabel}</div>
          ) : (
            items.map((item) => (
              <Link key={item.id} to={`/fahrzeug/${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{vehicleDisplayName(item)}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {inventoryKindLabel(item.kind ?? "vehicle")}{item.internalNumber ? ` • Nr. ${item.internalNumber}` : ""}
                    </div>
                  </div>
                  <Pill text={formatStatus(item.status)} className={statusPillClass(item.status)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  {kind === "vehicle" ? <span>KM: {typeof item.currentKm === "number" ? `${item.currentKm}` : "—"}</span> : null}
                  <span>Schäden: {item.openDamages}</span>
                  {kind === "equipment" ? <span>Zubehör: {item.accessoryForVehicleRental ? `${(item.dailyRentalPriceEur ?? 0).toFixed(2)} €/Tag` : "Nein"}</span> : null}
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="mt-4 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[900px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Kategorie</th>
                <th className="px-4 py-3">Status</th>
                {kind === "vehicle" ? <th className="px-4 py-3">KM</th> : <th className="px-4 py-3">Zubehör Fahrzeugmiete</th>}
                <th className="px-4 py-3">Schäden</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.length === 0 ? (
                <tr><td className="px-4 py-6 text-sm text-slate-600" colSpan={6}>{emptyLabel}</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="text-sm text-slate-900">
                    <td className="px-4 py-3 font-semibold">
                      {vehicleDisplayName(item)}
                      {item.internalNumber ? <div className="text-xs text-slate-500">Nr. {item.internalNumber}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.category || inventoryKindLabel(item.kind ?? "vehicle")}</td>
                    <td className="px-4 py-3"><Pill text={formatStatus(item.status)} className={statusPillClass(item.status)} /></td>
                    <td className="px-4 py-3 text-slate-700">
                      {kind === "vehicle"
                        ? typeof item.currentKm === "number" ? `${item.currentKm} km` : "—"
                        : item.accessoryForVehicleRental ? `${(item.dailyRentalPriceEur ?? 0).toFixed(2)} €/Tag` : "Nein"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.openDamages}</td>
                    <td className="px-4 py-3 text-right"><Link to={`/fahrzeug/${item.id}`} className="text-xs font-semibold text-slate-900 hover:text-slate-700">Öffnen</Link></td>
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
