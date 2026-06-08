import { useMemo, useState } from "react";
import type { ServiceItem } from "../../domain/service";
import { deleteService, listServices, upsertService } from "../../storage/serviceRepo";
import { formatEur } from "../rentals/rentalUi";

type FormState = Omit<ServiceItem, "id"> & { id?: string };

const emptyForm: FormState = { name: "", hint: "", unitPriceEur: 0, vatRate: 19, active: true, appliesTo: "both" };

function appliesToLabel(value: ServiceItem["appliesTo"]): string {
  if (value === "vehicle") return "Fahrzeug";
  if (value === "equipment") return "Gerät";
  return "Beide";
}

function Field(props: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={["grid gap-1", props.className ?? ""].join(" ")}>
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
    </label>
  );
}

const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

export default function EinstellungenLeistungenPage() {
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const services = useMemo(() => listServices(true), [version]);
  const canSave = form.name.trim().length > 0;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Leistungskatalog</h3>
        <p className="mt-1 text-xs text-slate-500">Leistungen mit Hinweis, Einzelpreis und MwSt. Diese Positionen können im Vermietungsformular ausgewählt werden.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-7">
          <Field label="Leistung" className="md:col-span-2">
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Gültig für">
            <select
              value={form.appliesTo ?? "both"}
              onChange={(e) => setForm((s) => ({ ...s, appliesTo: e.target.value as ServiceItem["appliesTo"] }))}
              className={inputClass}
            >
              <option value="both">Beide</option>
              <option value="vehicle">Fahrzeug</option>
              <option value="equipment">Gerät</option>
            </select>
          </Field>
          <Field label="Einzelpreis €">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.unitPriceEur}
              onChange={(e) => setForm((s) => ({ ...s, unitPriceEur: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="MwSt %">
            <input
              type="number"
              min={0}
              step={1}
              value={form.vatRate}
              onChange={(e) => setForm((s) => ({ ...s, vatRate: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} />
            Aktiv
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                upsertService({ ...form, name: form.name.trim(), hint: form.hint.trim() });
                setForm(emptyForm);
                setVersion((v) => v + 1);
              }}
              className="w-full rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {form.id ? "Aktualisieren" : "Anlegen"}
            </button>
          </div>
          <Field label="Hinweis" className="md:col-span-7">
            <input value={form.hint} onChange={(e) => setForm((s) => ({ ...s, hint: e.target.value }))} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Gespeicherte Leistungen</h3>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Leistung</th>
                <th className="px-4 py-3">Gültig für</th>
                <th className="px-4 py-3">Hinweis</th>
                <th className="px-4 py-3 text-right">Preis</th>
                <th className="px-4 py-3 text-right">MwSt</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service) => (
                <tr key={service.id} className={service.active ? "bg-white" : "bg-slate-50 text-slate-400"}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{service.name}</td>
                  <td className="px-4 py-3 text-slate-700">{appliesToLabel(service.appliesTo)}</td>
                  <td className="px-4 py-3 text-slate-600">{service.hint || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatEur(service.unitPriceEur)}</td>
                  <td className="px-4 py-3 text-right">{service.vatRate}%</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="text-xs font-semibold text-slate-900" onClick={() => setForm(service)}>
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-700"
                        onClick={() => {
                          deleteService(service.id);
                          setVersion((v) => v + 1);
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
