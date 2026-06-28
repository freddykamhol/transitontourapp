import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { InventoryKind, VehicleStatus } from "../../domain/vehicle";
import { createVehicle } from "../../storage/vehicleRepo";

type FormState = {
  kind: InventoryKind;
  licensePlate: string;
  internalNumber: string;
  category: string;
  brand: string;
  model: string;
  vin: string;
  registrationDocumentNumber: string;
  accessoryForVehicleRental: boolean;
  dailyRentalPriceEur: string;
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

function KindCard(props: { active: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-3xl border p-5 text-left transition",
        props.active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="text-sm font-semibold">{props.title}</div>
      <div className={props.active ? "mt-2 text-xs text-slate-200" : "mt-2 text-xs text-slate-500"}>{props.description}</div>
    </button>
  );
}

export default function FahrzeugNeuPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({
    kind: "vehicle",
    licensePlate: "",
    internalNumber: "",
    category: "",
    brand: "",
    model: "",
    vin: "",
    registrationDocumentNumber: "",
    accessoryForVehicleRental: false,
    dailyRentalPriceEur: "",
    status: "verfuegbar",
    notes: "",
  });

  const dailyPrice = Number(form.dailyRentalPriceEur.replace(",", "."));
  const canSubmit = useMemo(() => {
    if (form.kind === "vehicle" && form.licensePlate.trim().length === 0) return false;
    if (form.kind === "equipment" && ![form.brand, form.model, form.category].some((value) => value.trim().length > 0)) return false;
    if (form.kind === "equipment" && (!Number.isFinite(dailyPrice) || dailyPrice <= 0)) return false;
    return true;
  }, [dailyPrice, form]);

  const kindLabel = form.kind === "equipment" ? "Gerät" : "Fahrzeug";

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Inventar anlegen</h2>
            <p className="mt-1 text-xs text-slate-500">Mehrseitig: zuerst Oberkategorie, danach passende Stammdaten.</p>
          </div>
          <Link to="/fahrzeug" className="text-xs font-semibold text-slate-900 hover:text-slate-700">Zurück</Link>
        </div>

        <div className="mt-5 flex gap-2 text-xs font-semibold text-slate-500">
          <span className={step === 1 ? "text-slate-900" : ""}>1 Oberkategorie</span>
          <span>→</span>
          <span className={step === 2 ? "text-slate-900" : ""}>2 Stammdaten</span>
        </div>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              setStep(2);
              return;
            }
            if (!canSubmit) return;
            const created = createVehicle({
              kind: form.kind,
              licensePlate: form.kind === "vehicle" ? form.licensePlate.trim().toUpperCase() : form.model.trim() || form.category.trim() || "GERÄT",
              internalNumber: undefined,
              category: form.category.trim() || undefined,
              brand: form.brand.trim() || undefined,
              model: form.model.trim() || undefined,
              vin: form.kind === "vehicle" ? form.vin.trim() || undefined : undefined,
              registrationDocumentNumber: form.kind === "vehicle" ? form.registrationDocumentNumber.trim() || undefined : undefined,
              accessoryForVehicleRental: form.kind === "equipment" ? true : false,
              dailyRentalPriceEur: form.kind === "equipment" ? dailyPrice : undefined,
              status: form.status,
              notes: form.notes.trim() || undefined,
            });
            navigate(`/fahrzeug/${created.id}`);
          }}
        >
          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <KindCard
                active={form.kind === "vehicle"}
                title="Fahrzeug"
                description="Kennzeichen, FIN, Fahrzeugschein, Kilometerstände und fahrzeugbezogene Schäden."
                onClick={() => setForm((s) => ({ ...s, kind: "vehicle", accessoryForVehicleRental: false, dailyRentalPriceEur: "" }))}
              />
              <KindCard
                active={form.kind === "equipment"}
                title="Gerät"
                description="Geräte, Maschinen oder Zubehör mit eigenem Tagesmietpreis."
                onClick={() => setForm((s) => ({ ...s, kind: "equipment", licensePlate: "" }))}
              />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">
                Oberkategorie: {kindLabel}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {form.kind === "vehicle" ? (
                  <Field label="Kennzeichen">
                    <input value={form.licensePlate} onChange={(e) => setForm((s) => ({ ...s, licensePlate: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" placeholder="B-AB 1234" autoFocus />
                  </Field>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="text-xs font-semibold text-slate-500">Interne Nummer</div>
                  <div className="mt-1 font-semibold text-slate-900">Wird beim Speichern automatisch vergeben.</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label={form.kind === "equipment" ? "Geräteart / Kategorie" : "Fahrzeugart / Kategorie"} hint="Optional">
                  <input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" placeholder={form.kind === "equipment" ? "Anhänger, Kompressor, Werkzeug" : "Wohnmobil, Transporter, PKW"} />
                </Field>
                <Field label={form.kind === "equipment" ? "Hersteller" : "Marke"} hint="Optional">
                  <input value={form.brand} onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" />
                </Field>
                <Field label="Modell / Bezeichnung" hint={form.kind === "equipment" ? "Bei Geräten ausreichend als Name" : "Optional"}>
                  <input value={form.model} onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" />
                </Field>
              </div>

              {form.kind === "vehicle" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="FIN / VIN" hint="Optional">
                    <input value={form.vin} onChange={(e) => setForm((s) => ({ ...s, vin: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" placeholder="WVWZZZ..." />
                  </Field>
                  <Field label="Fahrzeugscheinnummer" hint="Optional">
                    <input value={form.registrationDocumentNumber} onChange={(e) => setForm((s) => ({ ...s, registrationDocumentNumber: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" />
                  </Field>
                </div>
              ) : (
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <Field label="Tagesmietpreis (EUR)" hint="Pflicht für Gerätemieten. Der Preis wird im Vermietungsformular automatisch pro Miettag genutzt.">
                    <input type="number" min={0} step={0.01} value={form.dailyRentalPriceEur} onChange={(e) => setForm((s) => ({ ...s, dailyRentalPriceEur: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400" placeholder="25,00" />
                  </Field>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as VehicleStatus }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400">
                    <option value="verfuegbar">Verfügbar</option>
                    <option value="vermietet">Vermietet</option>
                    <option value="wartung">Wartung</option>
                    <option value="inaktiv">Inaktiv</option>
                  </select>
                </Field>
              </div>

              <Field label="Notizen" hint="Optional">
                <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400" placeholder="Hinweise, Ausstattung, Zubehör…" />
              </Field>
            </>
          )}

          <div className="flex items-center justify-end gap-3">
            {step === 2 ? <button type="button" onClick={() => setStep(1)} className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Zurück</button> : null}
            <Link to="/fahrzeug" className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Abbrechen</Link>
            <button type="submit" disabled={step === 2 && !canSubmit} className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              {step === 1 ? "Weiter" : `${kindLabel} anlegen`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
