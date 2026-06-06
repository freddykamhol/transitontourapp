import { useState } from "react";
import type { CompanyData } from "../../domain/company";
import { getCompanyData, saveCompanyData } from "../../storage/companyRepo";

function Field(props: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={["grid gap-1", props.className ?? ""].join(" ")}>
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
    </label>
  );
}

function inputClass() {
  return "h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";
}

export default function EinstellungenFirmendatenPage() {
  const [company, setCompany] = useState<CompanyData>(() => getCompanyData());
  const [savedAt, setSavedAt] = useState("");

  function update<K extends keyof CompanyData>(key: K, value: CompanyData[K]) {
    setCompany((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Firmendaten</h3>
          <p className="mt-1 text-xs text-slate-500">Diese Daten werden im Mietvertrag für Vermieter, Halter, Eigentümer und Zahlung genutzt.</p>
        </div>
        <div className="text-xs font-semibold text-slate-500">{savedAt ? `Gespeichert: ${savedAt}` : "Noch nicht gespeichert"}</div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Firma">
          <input value={company.company} onChange={(e) => update("company", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Name">
          <input value={company.name} onChange={(e) => update("name", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Anschrift" className="md:col-span-2">
          <input value={company.address} onChange={(e) => update("address", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Telefon">
          <input value={company.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Telefax">
          <input value={company.fax} onChange={(e) => update("fax", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="E-Mail">
          <input type="email" value={company.email} onChange={(e) => update("email", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="IBAN">
          <input value={company.iban} onChange={(e) => update("iban", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="BIC">
          <input value={company.bic} onChange={(e) => update("bic", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Bemerkungen" className="md:col-span-2">
          <textarea
            value={company.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px"
          onClick={() => {
            saveCompanyData(company);
            setSavedAt(new Date().toLocaleString());
          }}
        >
          Firmendaten speichern
        </button>
      </div>
    </section>
  );
}
