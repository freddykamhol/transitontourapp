import { useMemo, useState } from "react";
import type { Rental, RentalAddon, RentalInsurance, RentalParty, RentalPayment, RentalVehicleRef } from "../../../domain/rental";
import { listVehicles } from "../../../storage/vehicleRepo";

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

function Section(props: { title: string; description?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{props.title}</h2>
          {props.description ? <p className="mt-1 text-xs text-slate-500">{props.description}</p> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function toLocalDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromLocalDateTime(value: string): string {
  // value: "YYYY-MM-DDTHH:mm" in local timezone
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function defaultTenant(): RentalParty {
  return { name: "", email: "", phone: "" };
}

function defaultPayment(): RentalPayment {
  return { method: "karte", status: "offen", totalEur: 0, paidEur: 0, depositEur: 0 };
}

type RentalFormState = {
  startAt: string;
  endAt: string;
  tenant: RentalParty;
  vehicle: RentalVehicleRef | null;
  additionalDrivers: RentalParty[];
  insurance: RentalInsurance;
  addons: RentalAddon[];
  payment: RentalPayment;
  internalNotes: string;
};

export default function RentalForm(props: {
  mode: "create" | "edit";
  initial?: Rental;
  readOnlyKeys?: Partial<Record<"tenant" | "vehicle" | "startAt" | "endAt" | "payment", boolean>>;
  onCancel: () => void;
  onSubmit: (value: Omit<RentalFormState, "vehicle"> & { vehicle: RentalVehicleRef }) => void;
  submitLabel: string;
}) {
  const vehicles = listVehicles();
  const [state, setState] = useState<RentalFormState>(() => {
    const initial = props.initial;
    if (initial) {
      return {
        startAt: initial.startAt,
        endAt: initial.endAt,
        tenant: initial.tenant,
        vehicle: initial.vehicle ?? null,
        additionalDrivers: initial.additionalDrivers ?? [],
        insurance: initial.insurance ?? { kind: "basis" },
        addons: initial.addons ?? [],
        payment: initial.payment ?? defaultPayment(),
        internalNotes: initial.internalNotes ?? "",
      };
    }

    const start = new Date();
    start.setHours(start.getHours() + 2);
    const end = new Date(start);
    end.setDate(end.getDate() + 3);

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      tenant: defaultTenant(),
      vehicle: null,
      additionalDrivers: [],
      insurance: { kind: "basis", deductibleEur: 0 },
      addons: [],
      payment: defaultPayment(),
      internalNotes: "",
    };
  });

  const canSubmit = useMemo(() => {
    if (!state.vehicle) return false;
    if (state.tenant.name.trim().length === 0) return false;
    if (state.tenant.email.trim().length === 0) return false;
    if (!state.startAt || !state.endAt) return false;
    if (new Date(state.endAt).getTime() <= new Date(state.startAt).getTime()) return false;
    return true;
  }, [state]);

  const selectedVehicleId = state.vehicle?.vehicleId ?? "";
  const readOnly = props.readOnlyKeys ?? {};

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || !state.vehicle) return;
        props.onSubmit({ ...state, vehicle: state.vehicle });
      }}
    >
      <Section title="Termine" description="Schnell: Start/Ende setzen. Wenn eine Miete läuft, kann nur die Rückgabe angepasst werden.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Start">
            <input
              type="datetime-local"
              value={toLocalDateTime(state.startAt)}
              disabled={Boolean(readOnly.startAt)}
              onChange={(e) => setState((s) => ({ ...s, startAt: fromLocalDateTime(e.target.value) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            />
          </Field>
          <Field label="Ende / Rückgabe geplant" hint="Überfällig wird automatisch rot markiert.">
            <input
              type="datetime-local"
              value={toLocalDateTime(state.endAt)}
              disabled={Boolean(readOnly.endAt)}
              onChange={(e) => setState((s) => ({ ...s, endAt: fromLocalDateTime(e.target.value) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            />
          </Field>
        </div>
      </Section>

      <Section title="Mieter" description="Kontaktdaten + Führerschein optional.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input
              value={state.tenant.name}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, name: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            />
          </Field>
          <Field label="E-Mail">
            <input
              type="email"
              value={state.tenant.email}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, email: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            />
          </Field>
          <Field label="Telefon">
            <input
              value={state.tenant.phone ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, phone: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Adresse (optional)">
            <input
              value={state.tenant.addressLine1 ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, addressLine1: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              placeholder="Straße, Nr."
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Führerschein-Nr. (optional)">
            <input
              value={state.tenant.driverLicenseNumber ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, driverLicenseNumber: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Ausstellungsort (optional)">
            <input
              value={state.tenant.driverLicenseIssuedBy ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, driverLicenseIssuedBy: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Gültig bis (optional)">
            <input
              type="date"
              value={(state.tenant.driverLicenseValidUntil ?? "").slice(0, 10)}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, driverLicenseValidUntil: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>
      </Section>

      <Section title="Fahrzeug" description="Aus Bestand wählen.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fahrzeug auswählen">
            <select
              value={selectedVehicleId}
              disabled={Boolean(readOnly.vehicle)}
              onChange={(e) => {
                const vehicleId = e.target.value;
                const v = vehicles.find((x) => x.id === vehicleId);
                if (!v) return setState((s) => ({ ...s, vehicle: null }));
                const label = `${v.brand} ${v.model} (${v.licensePlate})`;
                setState((s) => ({
                  ...s,
                  vehicle: { vehicleId: v.id, label, licensePlate: v.licensePlate, vin: v.vin },
                }));
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            >
              <option value="" disabled>
                Bitte wählen…
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} • {v.licensePlate}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Interne Notiz (optional)" hint="z.B. Sonderwünsche, Hinweise für Übergabe.">
            <input
              value={state.internalNotes}
              onChange={(e) => setState((s) => ({ ...s, internalNotes: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Zusatzfahrer"
        description="Optional. Für Prozess: zuerst Name/E-Mail reicht, Details später."
        right={
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setState((s) => ({ ...s, additionalDrivers: [...s.additionalDrivers, defaultTenant()] }))}
          >
            Zusatzfahrer hinzufügen
          </button>
        }
      >
        {state.additionalDrivers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Keine Zusatzfahrer.</div>
        ) : (
          <div className="grid gap-3">
            {state.additionalDrivers.map((d, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm font-semibold">Zusatzfahrer #{idx + 1}</div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800"
                    onClick={() =>
                      setState((s) => ({ ...s, additionalDrivers: s.additionalDrivers.filter((_, i) => i !== idx) }))
                    }
                  >
                    Entfernen
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={d.name}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                  <Field label="E-Mail (optional)">
                    <input
                      type="email"
                      value={d.email}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Versicherung" description="Schnelle Auswahl + Selbstbeteiligung optional.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Paket">
            <select
              value={state.insurance.kind}
              onChange={(e) => setState((s) => ({ ...s, insurance: { ...s.insurance, kind: e.target.value as RentalInsurance["kind"] } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="basis">Basis</option>
              <option value="vollkasko">Vollkasko</option>
              <option value="premium">Premium</option>
            </select>
          </Field>
          <Field label="Selbstbeteiligung (EUR)">
            <input
              type="number"
              min={0}
              step={50}
              value={state.insurance.deductibleEur ?? 0}
              onChange={(e) => setState((s) => ({ ...s, insurance: { ...s.insurance, deductibleEur: Number(e.target.value) } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Notiz (optional)">
            <input
              value={state.insurance.notes ?? ""}
              onChange={(e) => setState((s) => ({ ...s, insurance: { ...s.insurance, notes: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Zusatzleistungen"
        description="Optional. Für Prozess: erstmal grob, Preise später."
        right={
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() =>
              setState((s) => ({
                ...s,
                addons: [...s.addons, { id: `addon-${Date.now()}`, name: "", qty: 1, unitPriceEur: 0 }],
              }))
            }
          >
            Leistung hinzufügen
          </button>
        }
      >
        {state.addons.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Keine Zusatzleistungen.</div>
        ) : (
          <div className="grid gap-3">
            {state.addons.map((a, idx) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-6">
                  <Field label="Name">
                    <input
                      value={a.name}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 md:col-span-3"
                    />
                  </Field>
                  <Field label="Menge">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={a.qty}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 md:col-span-1"
                    />
                  </Field>
                  <Field label="Preis/Stk (EUR)">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={a.unitPriceEur ?? 0}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, unitPriceEur: Number(e.target.value) } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300 md:col-span-1"
                    />
                  </Field>
                  <div className="flex items-end md:col-span-1">
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-slate-50"
                      onClick={() => setState((s) => ({ ...s, addons: s.addons.filter((_, i) => i !== idx) }))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Zahlung" description="Gesamtbetrag, Anzahlung, Status.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Methode">
            <select
              value={state.payment.method}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, method: e.target.value as RentalPayment["method"] } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="karte">Karte</option>
              <option value="bar">Bar</option>
              <option value="ueberweisung">Überweisung</option>
              <option value="paypal">PayPal</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={state.payment.status}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, status: e.target.value as RentalPayment["status"] } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="offen">Offen</option>
              <option value="teilweise">Teilweise</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="erstattet">Erstattet</option>
            </select>
          </Field>
          <Field label="Rechnungsnr. (optional)">
            <input
              value={state.payment.invoiceNumber ?? ""}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, invoiceNumber: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Gesamt (EUR)">
            <input
              type="number"
              min={0}
              step={1}
              value={state.payment.totalEur}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, totalEur: Number(e.target.value) } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Bezahlt (EUR)">
            <input
              type="number"
              min={0}
              step={1}
              value={state.payment.paidEur}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, paidEur: Number(e.target.value) } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Kaution (EUR)">
            <input
              type="number"
              min={0}
              step={50}
              value={state.payment.depositEur ?? 0}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, depositEur: Number(e.target.value) } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notiz (optional)">
            <input
              value={state.payment.notes ?? ""}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, notes: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            "rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm",
            canSubmit ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500",
          ].join(" ")}
        >
          {props.submitLabel}
        </button>
      </div>
    </form>
  );
}

