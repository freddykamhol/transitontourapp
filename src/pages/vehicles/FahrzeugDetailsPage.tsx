import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { DamagePosition, DamageType, SketchMarker, VehicleStatus } from "../../domain/vehicle";
import {
  addDamage,
  addMaintenance,
  addOdometerEntry,
  deleteMaintenance,
  deleteVehicle,
  getVehicle,
  updateMaintenance,
  updateVehicle,
} from "../../storage/vehicleRepo";
import { damageTypeLabel, formatStatus, positionLabel, statusPillClass } from "./vehiclesUi";
import DamageSketch from "./components/DamageSketch";
import { suggestDamagePosition } from "./damagePositionSuggest";
import { downloadDamagePdf, downloadSketchPng } from "./exportDamageSketch";

function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

type DamageForm = {
  position: DamagePosition;
  positionMode: "auto" | "manual";
  type: DamageType;
  severity: "leicht" | "mittel" | "stark";
  details: string;
  marker?: SketchMarker;
  photos: string[];
};

export default function FahrzeugDetailsPage() {
  const navigate = useNavigate();
  const { vehicleId } = useParams();

  const data = useMemo(() => (vehicleId ? getVehicle(vehicleId) : null), [vehicleId]);
  const [edit, setEdit] = useState<{
    internalNumber: string;
    licensePlate: string;
    brand: string;
    model: string;
    vin: string;
    status: VehicleStatus;
    notes: string;
  } | null>(
    data
      ? {
          internalNumber: data.vehicle.internalNumber ?? "",
          licensePlate: data.vehicle.licensePlate,
          brand: data.vehicle.brand ?? "",
          model: data.vehicle.model ?? "",
          vin: data.vehicle.vin ?? "",
          status: data.vehicle.status,
          notes: data.vehicle.notes ?? "",
        }
      : null,
  );

  const [kmForm, setKmForm] = useState<{ at: string; km: string; note: string }>({
    at: new Date().toISOString().slice(0, 16),
    km: "",
    note: "",
  });

  const [syncForm, setSyncForm] = useState<{ rentalId: string; at: string; km: string; setAvailable: boolean }>({
    rentalId: "",
    at: new Date().toISOString().slice(0, 16),
    km: "",
    setAvailable: true,
  });

  const [damageForm, setDamageForm] = useState<DamageForm>({
    position: "unknown",
    positionMode: "auto",
    type: "kratzer",
    severity: "leicht",
    details: "",
    photos: [],
  });
  const positionSuggestion = useMemo(() => suggestDamagePosition(damageForm.marker), [damageForm.marker]);

  const [maintenanceForm, setMaintenanceForm] = useState<{
    startAt: string;
    endAt: string;
    title: string;
    status: "geplant" | "in_arbeit" | "erledigt";
    notes: string;
  }>({
    startAt: new Date().toISOString().slice(0, 16),
    endAt: "",
    title: "",
    status: "geplant",
    notes: "",
  });

  if (!vehicleId || !data || !edit) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Fahrzeug nicht gefunden</h2>
        <p className="mt-2 text-sm text-slate-600">Dieses Fahrzeug existiert nicht (mehr).</p>
        <div className="mt-4">
          <Link to="/fahrzeug" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Zur Fahrzeugliste
          </Link>
        </div>
      </div>
    );
  }

  const currentKm = data.odometer[0]?.km;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">{data.vehicle.licensePlate}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill text={formatStatus(data.vehicle.status)} className={statusPillClass(data.vehicle.status)} />
              <span className="text-xs text-slate-500">{data.vehicle.id}</span>
              {typeof currentKm === "number" ? <span className="text-xs text-slate-500">{currentKm} km</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/fahrzeug"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Zurück
            </Link>
            <button
              type="button"
              className="inline-flex items-center rounded-2xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
              onClick={() => {
                const ok = confirm("Fahrzeug wirklich löschen? Alle KM- und Schaden-Daten werden entfernt.");
                if (!ok) return;
                deleteVehicle(vehicleId);
                navigate("/fahrzeug");
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Stammdaten</h3>
            <p className="mt-1 text-xs text-slate-500">Änderungen werden direkt gespeichert.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Kennzeichen">
            <input
              value={edit.licensePlate}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setEdit((s) => (s ? { ...s, licensePlate: next } : s));
                updateVehicle(vehicleId, { licensePlate: next });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Interne Nummer" hint="Optional">
            <input
              value={edit.internalNumber}
              onChange={(e) => {
                const next = e.target.value;
                setEdit((s) => (s ? { ...s, internalNumber: next } : s));
                updateVehicle(vehicleId, { internalNumber: next.trim() || undefined });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Marke" hint="Optional">
            <input
              value={edit.brand}
              onChange={(e) => {
                const next = e.target.value;
                setEdit((s) => (s ? { ...s, brand: next } : s));
                updateVehicle(vehicleId, { brand: next.trim() || undefined });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Modell" hint="Optional">
            <input
              value={edit.model}
              onChange={(e) => {
                const next = e.target.value;
                setEdit((s) => (s ? { ...s, model: next } : s));
                updateVehicle(vehicleId, { model: next.trim() || undefined });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="FIN / VIN" hint="Optional">
            <input
              value={edit.vin}
              onChange={(e) => {
                const next = e.target.value;
                setEdit((s) => (s ? { ...s, vin: next } : s));
                updateVehicle(vehicleId, { vin: next.trim() || undefined });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Status">
            <select
              value={edit.status}
              onChange={(e) => {
                const next = e.target.value as VehicleStatus;
                setEdit((s) => (s ? { ...s, status: next } : s));
                updateVehicle(vehicleId, { status: next });
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            >
              <option value="verfuegbar">Verfügbar</option>
              <option value="vermietet">Vermietet</option>
              <option value="wartung">Wartung</option>
              <option value="inaktiv">Inaktiv</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Notizen" hint="Optional">
              <textarea
                value={edit.notes}
                onChange={(e) => {
                  const next = e.target.value;
                  setEdit((s) => (s ? { ...s, notes: next } : s));
                  updateVehicle(vehicleId, { notes: next.trim() || undefined });
                }}
                className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Kilometerstände</h3>
          <p className="mt-1 text-xs text-slate-500">
            Manuelle Einträge oder automatisch via Vermietungsabschluss (Synchronisierung).
          </p>

          <form
            className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const km = Number(kmForm.km);
              if (!Number.isFinite(km) || km < 0) return;
              addOdometerEntry({
                vehicleId,
                at: new Date(kmForm.at).toISOString(),
                km,
                source: "manuell",
                note: kmForm.note.trim() || undefined,
              });
              navigate(0);
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Zeitpunkt">
                <input
                  type="datetime-local"
                  value={kmForm.at}
                  onChange={(e) => setKmForm((s) => ({ ...s, at: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                />
              </Field>
              <Field label="KM-Stand">
                <input
                  inputMode="numeric"
                  value={kmForm.km}
                  onChange={(e) => setKmForm((s) => ({ ...s, km: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                  placeholder="z.B. 123456"
                />
              </Field>
            </div>
            <Field label="Notiz" hint="Optional">
              <input
                value={kmForm.note}
                onChange={(e) => setKmForm((s) => ({ ...s, note: e.target.value }))}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="z.B. Werkstatt, Check-in…"
              />
            </Field>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Speichern
              </button>
            </div>
          </form>

          {/* Mobile list */}
          <div className="mt-4 grid gap-2 md:hidden">
            {data.odometer.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Noch keine Kilometerstände erfasst.
              </div>
            ) : (
              data.odometer.slice(0, 10).map((e) => (
                <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{e.km} km</div>
                    <div className="text-xs text-slate-500">{new Date(e.at).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {e.source === "manuell" ? "Manuell" : `Vermietungsabschluss${e.rentalId ? ` (${e.rentalId})` : ""}`}
                  </div>
                  {e.note ? <div className="mt-2 text-sm text-slate-700">{e.note}</div> : null}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="mt-4 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 md:block">
            <table className="min-w-[720px] w-full border-collapse">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Zeitpunkt</th>
                  <th className="px-4 py-3">KM</th>
                  <th className="px-4 py-3">Quelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data.odometer.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-600" colSpan={3}>
                      Noch keine Kilometerstände erfasst.
                    </td>
                  </tr>
                ) : (
                  data.odometer.slice(0, 10).map((e) => (
                    <tr key={e.id} className="text-sm text-slate-900">
                      <td className="px-4 py-3 text-slate-700">{new Date(e.at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold">{e.km} km</td>
                      <td className="px-4 py-3 text-slate-700">
                        {e.source === "manuell"
                          ? "Manuell"
                          : `Vermietungsabschluss${e.rentalId ? ` (${e.rentalId})` : ""}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Vermietungsabschluss synchronisieren</h3>
          <p className="mt-1 text-xs text-slate-500">MVP-Stub: simuliert einen Abschluss und schreibt automatisch den KM-Stand.</p>

          <form
            className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const km = Number(syncForm.km);
              if (!Number.isFinite(km) || km < 0) return;
              addOdometerEntry({
                vehicleId,
                at: new Date(syncForm.at).toISOString(),
                km,
                source: "vermietungsabschluss",
                rentalId: syncForm.rentalId.trim() || undefined,
              });
              if (syncForm.setAvailable) updateVehicle(vehicleId, { status: "verfuegbar" });
              navigate(0);
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Vermietungs-ID" hint="Optional">
                <input
                  value={syncForm.rentalId}
                  onChange={(e) => setSyncForm((s) => ({ ...s, rentalId: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                  placeholder="z.B. R-9001"
                />
              </Field>
              <Field label="Zeitpunkt">
                <input
                  type="datetime-local"
                  value={syncForm.at}
                  onChange={(e) => setSyncForm((s) => ({ ...s, at: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                />
              </Field>
              <Field label="KM bei Abschluss">
                <input
                  inputMode="numeric"
                  value={syncForm.km}
                  onChange={(e) => setSyncForm((s) => ({ ...s, km: e.target.value }))}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                  placeholder="z.B. 124100"
                />
              </Field>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={syncForm.setAvailable}
                  onChange={(e) => setSyncForm((s) => ({ ...s, setAvailable: e.target.checked }))}
                />
                Status auf „Verfügbar“
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Synchronisieren
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Wartungen</h3>
        <p className="mt-1 text-xs text-slate-500">Wartungen/Standzeiten erfassen. Diese erscheinen auch im Kalender.</p>

        <form
          className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!maintenanceForm.title.trim()) return;
            addMaintenance({
              vehicleId,
              startAt: new Date(maintenanceForm.startAt).toISOString(),
              endAt: maintenanceForm.endAt ? new Date(maintenanceForm.endAt).toISOString() : null,
              title: maintenanceForm.title.trim(),
              status: maintenanceForm.status,
              notes: maintenanceForm.notes.trim() || undefined,
            });
            setMaintenanceForm((s) => ({ ...s, title: "", notes: "" }));
            navigate(0);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Start">
              <input
                type="datetime-local"
                value={maintenanceForm.startAt}
                onChange={(e) => setMaintenanceForm((s) => ({ ...s, startAt: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Ende" hint="Optional">
              <input
                type="datetime-local"
                value={maintenanceForm.endAt}
                onChange={(e) => setMaintenanceForm((s) => ({ ...s, endAt: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Titel">
              <input
                value={maintenanceForm.title}
                onChange={(e) => setMaintenanceForm((s) => ({ ...s, title: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="z.B. Ölwechsel, TÜV, Reparatur"
              />
            </Field>
            <Field label="Status">
              <select
                value={maintenanceForm.status}
                onChange={(e) => setMaintenanceForm((s) => ({ ...s, status: e.target.value as typeof maintenanceForm.status }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              >
                <option value="geplant">Geplant</option>
                <option value="in_arbeit">In Arbeit</option>
                <option value="erledigt">Erledigt</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Notizen" hint="Optional">
                <textarea
                  value={maintenanceForm.notes}
                  onChange={(e) => setMaintenanceForm((s) => ({ ...s, notes: e.target.value }))}
                  className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Wartung hinzufügen
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-2">
          {data.maintenances.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Noch keine Wartungen erfasst.</div>
          ) : (
            data.maintenances.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{m.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(m.startAt).toLocaleString()}{" "}
                      {m.endAt ? (
                        <>
                          – {new Date(m.endAt).toLocaleString()}
                        </>
                      ) : null}
                    </div>
                    {m.notes ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{m.notes}</div> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={m.status}
                      onChange={(e) => {
                        updateMaintenance(m.id, { status: e.target.value as typeof m.status });
                        navigate(0);
                      }}
                      className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-400"
                    >
                      <option value="geplant">Geplant</option>
                      <option value="in_arbeit">In Arbeit</option>
                      <option value="erledigt">Erledigt</option>
                    </select>
                    <Link
                      to={`/kalender?vehicleId=${encodeURIComponent(vehicleId)}&date=${encodeURIComponent(new Date(m.startAt).toISOString().slice(0, 10))}`}
                      className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Im Kalender
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-2xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500"
                      onClick={() => {
                        const ok = confirm("Wartung wirklich löschen?");
                        if (!ok) return;
                        deleteMaintenance(m.id);
                        navigate(0);
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Schäden</h3>
        <p className="mt-1 text-xs text-slate-500">Schaden anlegen (Position, Art, Details) inkl. Marker auf Skizze.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={async () => {
              await downloadSketchPng({
                filename: `skizze_${data.vehicle.licensePlate.replaceAll(" ", "_")}.png`,
                imageSrc: `${import.meta.env.BASE_URL}sketch/vehicle-top.png`,
                damages: data.damages,
              });
            }}
          >
            Skizze (PNG) herunterladen
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            onClick={async () => {
              await downloadDamagePdf({
                filename: `schadenuebersicht_${data.vehicle.licensePlate.replaceAll(" ", "_")}.pdf`,
                imageSrc: `${import.meta.env.BASE_URL}sketch/vehicle-top.png`,
                vehicleLabel: [data.vehicle.licensePlate, data.vehicle.brand, data.vehicle.model].filter(Boolean).join(" "),
                damages: data.damages,
              });
            }}
          >
            Schadenübersicht (PDF) herunterladen
          </button>
          <div className="text-[11px] text-slate-500">
            PNG: nur Skizze + Marker. PDF: Skizze + Liste (ohne Fotos, mit Details).
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              const payload = {
                vehicleLabel: [data.vehicle.licensePlate, data.vehicle.brand, data.vehicle.model].filter(Boolean).join(" "),
                damages: data.damages,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `damages_${data.vehicle.licensePlate.replaceAll(" ", "_")}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
          >
            JSON für Terminal-Export
          </button>
        </div>

        <form
          className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addDamage({
              vehicleId,
              position: damageForm.position,
              type: damageForm.type,
              severity: damageForm.severity,
              details: damageForm.details.trim() || undefined,
              marker: damageForm.marker,
              photos: damageForm.photos.length > 0 ? damageForm.photos : undefined,
            });
            setDamageForm({
              position: "unknown",
              positionMode: "auto",
              type: "kratzer",
              severity: "leicht",
              details: "",
              photos: [],
            });
            navigate(0);
          }}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-4">
              <Field label="Position">
                <select
                  value={damageForm.position}
                  onChange={(e) =>
                    setDamageForm((s) => ({
                      ...s,
                      position: e.target.value as DamagePosition,
                      positionMode: "manual",
                    }))
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                >
                  {positionSuggestion.allowed.map((pos) => (
                    <option key={pos} value={pos}>
                      {positionLabel(pos)}
                      {pos === positionSuggestion.suggested ? " (Vorschlag)" : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Schadensart">
                <select
                  value={damageForm.type}
                  onChange={(e) => setDamageForm((s) => ({ ...s, type: e.target.value as DamageType }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                >
                  <option value="kratzer">Kratzer</option>
                  <option value="delle">Delle</option>
                  <option value="riss">Riss</option>
                  <option value="lack">Lack</option>
                  <option value="scheibe">Scheibe</option>
                  <option value="reifen">Reifen</option>
                  <option value="innenraum">Innenraum</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </Field>

              <Field label="Schweregrad">
                <select
                  value={damageForm.severity}
                  onChange={(e) => setDamageForm((s) => ({ ...s, severity: e.target.value as DamageForm["severity"] }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                >
                  <option value="leicht">Leicht</option>
                  <option value="mittel">Mittel</option>
                  <option value="stark">Stark</option>
                </select>
              </Field>

              <Field label="Details / Bemerkung" hint="Optional">
                <textarea
                  value={damageForm.details}
                  onChange={(e) => setDamageForm((s) => ({ ...s, details: e.target.value }))}
                  className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
                  placeholder="Details, Bemerkungen, ggf. Umfang…"
                />
              </Field>

              <div className="grid gap-2">
                <div className="text-xs font-semibold text-slate-600">Schadensfotos</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                    Fotos hochladen
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length === 0) return;
                        const dataUrls = await Promise.all(
                          files.map(
                            (file) =>
                              new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(String(reader.result));
                                reader.onerror = () => reject(new Error("read failed"));
                                reader.readAsDataURL(file);
                              }),
                          ),
                        );
                        setDamageForm((s) => ({ ...s, photos: [...s.photos, ...dataUrls] }));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {damageForm.photos.length > 0 ? (
                    <button
                      type="button"
                      className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => setDamageForm((s) => ({ ...s, photos: [] }))}
                    >
                      Alle entfernen
                    </button>
                  ) : null}
                </div>

                {damageForm.photos.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {damageForm.photos.map((src, idx) => (
                      <div key={`${idx}-${src.slice(0, 24)}`} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img src={src} alt={`Schadensfoto ${idx + 1}`} className="block h-28 w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                          onClick={() =>
                            setDamageForm((s) => ({ ...s, photos: s.photos.filter((_, i) => i !== idx) }))
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">Optional: Fotos als Anhang zum Schaden.</div>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Skizze</div>
              <DamageSketch
                imageSrc={`${import.meta.env.BASE_URL}sketch/vehicle-top.png`}
                marker={damageForm.marker}
                onMarkerChange={(marker) =>
                  setDamageForm((s) => {
                    const next = { ...s, marker };
                    const suggestion = suggestDamagePosition(marker);
                    // Solange nicht manuell überschrieben, folgt Position dem Marker
                    if (next.positionMode === "auto") next.position = suggestion.suggested;
                    if (!marker) next.positionMode = "auto";
                    return next;
                  })
                }
              />
              <div className="text-[11px] text-slate-500">Skizzenbild: `public/sketch/vehicle-top.png`</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Schaden anlegen
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.damages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Noch keine Schäden dokumentiert.
            </div>
          ) : (
            data.damages.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {damageTypeLabel(d.type ?? "sonstiges")} • {positionLabel(d.position ?? "unknown")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {d.severity} • {new Date(d.updatedAt).toLocaleString()}
                    </div>
                    {d.details ? <div className="mt-2 text-sm text-slate-700">{d.details}</div> : null}
                  </div>
                </div>
                {d.marker ? (
                  <div className="mt-3 text-xs text-slate-500">
                    Marker: {Math.round(d.marker.x * 100)}% / {Math.round(d.marker.y * 100)}%
                  </div>
                ) : null}
                {d.photos && d.photos.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {d.photos.slice(0, 6).map((src, idx) => (
                      <div key={`${d.id}-${idx}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <img src={src} alt="Schadensfoto" className="block h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
