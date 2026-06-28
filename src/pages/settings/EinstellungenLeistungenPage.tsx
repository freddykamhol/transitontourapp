import { useState } from "react";
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

function suggestionRuleLabel(service: ServiceItem): string {
  const rule = service.suggestionRule;
  if (!rule?.enabled) return "—";
  const range = [rule.minDays ? `ab ${rule.minDays}` : "", rule.maxDays ? `bis ${rule.maxDays}` : ""].filter(Boolean).join(", ");
  const qty = rule.quantityMode === "fixed" ? `${rule.fixedQty ?? 1}x` : "pro Miettag";
  return [range || "immer", qty].join(" · ");
}

function Field(props: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={["grid min-w-0 gap-1", props.className ?? ""].join(" ")}>
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
    </label>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

export default function EinstellungenLeistungenPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [services, setServices] = useState(() => listServices(true));
  const canSave = form.name.trim().length > 0;
  const suggestionEnabled = Boolean(form.suggestionRule?.enabled);
  const refreshServices = () => setServices(listServices(true));

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Leistungskatalog</h3>
        <p className="mt-1 text-xs text-slate-500">Leistungen mit Hinweis, Einzelpreis und MwSt. Diese Positionen können im Vermietungsformular ausgewählt werden.</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-12">
          <Field label="Leistung" className="lg:col-span-4">
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className={inputClass} />
          </Field>
          <Field label="Gültig für" className="lg:col-span-2">
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
          <Field label="Einzelpreis €" className="lg:col-span-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.unitPriceEur}
              onChange={(e) => setForm((s) => ({ ...s, unitPriceEur: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <Field label="MwSt %" className="lg:col-span-2">
            <input
              type="number"
              min={0}
              step={1}
              value={form.vatRate}
              onChange={(e) => setForm((s) => ({ ...s, vatRate: Number(e.target.value) }))}
              className={inputClass}
            />
          </Field>
          <label className="grid min-w-0 gap-1 lg:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <span className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} />
              Aktiv
            </span>
          </label>
          <Field label="Hinweis" className="lg:col-span-9">
            <input value={form.hint} onChange={(e) => setForm((s) => ({ ...s, hint: e.target.value }))} className={inputClass} />
          </Field>
          <div className="flex items-end lg:col-span-3">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                upsertService({
                  ...form,
                  name: form.name.trim(),
                  hint: form.hint.trim(),
                  suggestionRule: form.suggestionRule?.enabled ? form.suggestionRule : undefined,
                });
                setForm(emptyForm);
                refreshServices();
              }}
              className="h-11 w-full rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {form.id ? "Aktualisieren" : "Anlegen"}
            </button>
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 lg:col-span-12">
            <input
              type="checkbox"
              checked={suggestionEnabled}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  suggestionRule: e.target.checked ? { enabled: true, quantityMode: "rentalDays", minDays: s.suggestionRule?.minDays, maxDays: s.suggestionRule?.maxDays } : undefined,
                }))
              }
            />
            Automatisch im Vermietungsformular vorschlagen
          </label>
          {suggestionEnabled ? (
            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-12">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Ab Tagen">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.suggestionRule?.minDays ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        suggestionRule: { enabled: true, quantityMode: s.suggestionRule?.quantityMode ?? "rentalDays", maxDays: s.suggestionRule?.maxDays, minDays: e.target.value ? Number(e.target.value) : undefined, fixedQty: s.suggestionRule?.fixedQty },
                      }))
                    }
                    className={inputClass}
                    placeholder="z.B. 5"
                  />
                </Field>
                <Field label="Bis Tagen">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.suggestionRule?.maxDays ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        suggestionRule: { enabled: true, quantityMode: s.suggestionRule?.quantityMode ?? "rentalDays", minDays: s.suggestionRule?.minDays, maxDays: e.target.value ? Number(e.target.value) : undefined, fixedQty: s.suggestionRule?.fixedQty },
                      }))
                    }
                    className={inputClass}
                    placeholder="z.B. 4"
                  />
                </Field>
                <Field label="Menge">
                  <select
                    value={form.suggestionRule?.quantityMode ?? "rentalDays"}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        suggestionRule: { enabled: true, minDays: s.suggestionRule?.minDays, maxDays: s.suggestionRule?.maxDays, quantityMode: e.target.value as NonNullable<ServiceItem["suggestionRule"]>["quantityMode"], fixedQty: s.suggestionRule?.fixedQty ?? 1 },
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="rentalDays">Pro Miettag</option>
                    <option value="fixed">Feste Menge</option>
                  </select>
                </Field>
                {form.suggestionRule?.quantityMode === "fixed" ? (
                  <Field label="Feste Menge">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.suggestionRule?.fixedQty ?? 1}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          suggestionRule: { enabled: true, minDays: s.suggestionRule?.minDays, maxDays: s.suggestionRule?.maxDays, quantityMode: "fixed", fixedQty: Math.max(1, Number(e.target.value) || 1) },
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                Beispiel: Roadtrip ab 5 Tagen mit Menge pro Miettag ergibt bei 6 Tagen automatisch 6 Positionen.
              </div>
            </div>
          ) : null}
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
                <th className="px-4 py-3">Vorschlagsregel</th>
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
                  <td className="px-4 py-3 text-slate-600">{suggestionRuleLabel(service)}</td>
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
                          refreshServices();
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
