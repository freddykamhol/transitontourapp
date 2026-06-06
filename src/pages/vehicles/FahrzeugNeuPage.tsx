import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { VehicleStatus } from "../../domain/vehicle";
import { createVehicle } from "../../storage/vehicleRepo";

type FormState = {
  licensePlate: string;
  internalNumber: string;
  category: string;
  brand: string;
  model: string;
  vin: string;
  registrationDocumentNumber: string;
  status: VehicleStatus;
  notes: string;
};

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

export default function FahrzeugNeuPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    licensePlate: "",
    internalNumber: "",
    category: "",
    brand: "",
    model: "",
    vin: "",
    registrationDocumentNumber: "",
    status: "verfuegbar",
    notes: "",
  });
  const canSubmit = useMemo(() => form.licensePlate.trim().length > 0, [form.licensePlate]);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Fahrzeug anlegen</h2>
            <p className="mt-1 text-xs text-slate-500">Basisdaten erfassen. Kilometerstände und Schäden folgen im Detail.</p>
          </div>
          <Link to="/fahrzeug" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Zurück
          </Link>
        </div>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            const vehicle = createVehicle({
              licensePlate: form.licensePlate.trim().toUpperCase(),
              internalNumber: form.internalNumber.trim() || undefined,
              category: form.category.trim() || undefined,
              brand: form.brand.trim() || undefined,
              model: form.model.trim() || undefined,
              vin: form.vin.trim() || undefined,
              registrationDocumentNumber: form.registrationDocumentNumber.trim() || undefined,
              status: form.status,
              notes: form.notes.trim() || undefined,
            });
            navigate(`/fahrzeug/${vehicle.id}`);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Kennzeichen">
              <input
                value={form.licensePlate}
                onChange={(e) => setForm((s) => ({ ...s, licensePlate: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="B-AB 1234"
                autoFocus
              />
            </Field>
            <Field label="Interne Nummer" hint="Optional">
              <input
                value={form.internalNumber}
                onChange={(e) => setForm((s) => ({ ...s, internalNumber: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="T-001"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fahrzeugart / Kategorie" hint="Optional">
              <input
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="Wohnmobil, Transporter, PKW"
              />
            </Field>
            <Field label="Marke" hint="Optional">
              <input
                value={form.brand}
                onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="VW"
              />
            </Field>
            <Field label="Modell" hint="Optional">
              <input
                value={form.model}
                onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="Transporter T6"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="FIN / VIN" hint="Optional">
              <input
                value={form.vin}
                onChange={(e) => setForm((s) => ({ ...s, vin: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                placeholder="WVWZZZ..."
              />
            </Field>
            <Field label="Fahrzeugscheinnummer" hint="Optional">
              <input
                value={form.registrationDocumentNumber}
                onChange={(e) => setForm((s) => ({ ...s, registrationDocumentNumber: e.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as VehicleStatus }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              >
                <option value="verfuegbar">Verfügbar</option>
                <option value="vermietet">Vermietet</option>
                <option value="wartung">Wartung</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </Field>
          </div>

          <Field label="Notizen" hint="Optional">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="z.B. Winterreifen, Sonderausstattung, Hinweise…"
            />
          </Field>

          <div className="flex items-center justify-end gap-3">
            <Link
              to="/fahrzeug"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anlegen
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
