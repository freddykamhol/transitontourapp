import { useMemo, useState } from "react";
import {
  normalizeRentalPartyNameParts,
  rentalPartyName,
  type Rental,
  type RentalAddon,
  type RentalInsurance,
  type RentalParty,
  type RentalPayment,
  type RentalReminderAttachmentSelection,
  type RentalVehicleRef,
} from "../../../domain/rental";
import type { ServiceItem } from "../../../domain/service";
import { listServices } from "../../../storage/serviceRepo";
import { listVehicles } from "../../../storage/vehicleRepo";
import { vehicleDisplayName } from "../../vehicles/vehiclesUi";

function Field(props: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={["grid gap-1", props.className ?? ""].join(" ")}>
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

function KindCard(props: { active: boolean; title: string; description: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={[
        "rounded-3xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
        props.active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="text-sm font-semibold">{props.title}</div>
      <div className={props.active ? "mt-2 text-xs text-slate-200" : "mt-2 text-xs text-slate-500"}>{props.description}</div>
    </button>
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
  return { name: "", salutation: "", title: "", firstNames: "", lastName: "", email: "", phone: "" };
}

function updatePartyName(party: RentalParty, patch: Partial<RentalParty>): RentalParty {
  const next = { ...party, ...patch };
  return { ...next, name: rentalPartyName(next) };
}

function defaultPayment(): RentalPayment {
  return { method: "karte", status: "offen", totalEur: 0, paidEur: 0, depositEur: 0, dueKind: "days", dueDays: 7 };
}

function addonFromService(service: ServiceItem): RentalAddon {
  return {
    id: `addon-${Date.now()}-${service.id}`,
    serviceId: service.id,
    name: service.name,
    hint: service.hint,
    qty: 1,
    unitPriceEur: service.unitPriceEur,
    vatRate: service.vatRate,
  };
}

function rentalDays(startAt: string, endAt: string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) return 1;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

type RentalFormState = {
  rentalKind: "vehicle" | "equipment";
  startAt: string;
  endAt: string;
  tenant: RentalParty;
  vehicle: RentalVehicleRef | null;
  additionalDrivers: RentalParty[];
  insurance: RentalInsurance;
  addons: RentalAddon[];
  payment: RentalPayment;
  reminderAttachmentSelections: RentalReminderAttachmentSelection[];
  internalNotes: string;
};

export default function RentalForm(props: {
  mode: "create" | "edit";
  initial?: Rental;
  readOnlyKeys?: Partial<Record<"tenant" | "vehicle" | "startAt" | "endAt" | "payment", boolean>>;
  onCancel: () => void;
  onSubmit: (value: Omit<RentalFormState, "vehicle"> & { vehicle: RentalVehicleRef }) => void | Promise<void>;
  submitLabel: string;
}) {
  const inventory = listVehicles();
  const vehicles = inventory.filter((item) => (item.kind ?? "vehicle") === "vehicle");
  const equipment = inventory.filter((item) => (item.kind ?? "vehicle") === "equipment");
  const rentableEquipment = inventory.filter(
    (item) => (item.kind ?? "vehicle") === "equipment" && item.accessoryForVehicleRental && (item.dailyRentalPriceEur ?? 0) > 0,
  );
  const services = listServices();
  const [state, setState] = useState<RentalFormState>(() => {
    const initial = props.initial;
    if (initial) {
      return {
        rentalKind: initial.vehicle?.kind ?? "vehicle",
        startAt: initial.startAt,
        endAt: initial.endAt,
        tenant: normalizeRentalPartyNameParts(initial.tenant),
        vehicle: initial.vehicle ?? null,
        additionalDrivers: (initial.additionalDrivers ?? []).map(normalizeRentalPartyNameParts),
        insurance: initial.insurance ?? { kind: "basis" },
        addons: initial.addons ?? [],
        payment: initial.payment ?? defaultPayment(),
        reminderAttachmentSelections: initial.reminderWorkflow?.attachmentSelections ?? [],
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
      rentalKind: "vehicle",
      tenant: defaultTenant(),
      vehicle: null,
      additionalDrivers: [],
      insurance: { kind: "basis", deductibleEur: 0 },
      addons: [],
      payment: defaultPayment(),
      reminderAttachmentSelections: [],
      internalNotes: "",
    };
  });

  const canSubmit = useMemo(() => {
    if (!state.vehicle) return false;
    const hasStructuredTenantName = Boolean((state.tenant.firstNames ?? "").trim() && (state.tenant.lastName ?? "").trim());
    const hasLegacyTenantName = Boolean(!(state.tenant.firstNames ?? "").trim() && !(state.tenant.lastName ?? "").trim() && !(state.tenant.salutation ?? "").trim() && !(state.tenant.title ?? "").trim() && state.tenant.name.trim());
    if (!hasStructuredTenantName && !hasLegacyTenantName) return false;
    if (state.tenant.email.trim().length === 0) return false;
    if (!state.startAt || !state.endAt) return false;
    if (new Date(state.endAt).getTime() <= new Date(state.startAt).getTime()) return false;
    return true;
  }, [state]);

  const selectedVehicleId = state.vehicle?.vehicleId ?? "";
  const primaryInventory = state.rentalKind === "equipment" ? equipment : vehicles;
  const readOnly = props.readOnlyKeys ?? {};
  const applicableServices = services.filter((service) => (service.appliesTo ?? "both") === "both" || service.appliesTo === state.rentalKind);
  const addonTotal = state.addons.reduce((sum, item) => sum + (item.unitPriceEur ?? 0) * item.qty, 0);
  const durationDays = rentalDays(state.startAt, state.endAt);
  const reminderItems = [
    ...(state.vehicle?.vehicleId ? [state.vehicle.vehicleId] : []),
    ...state.addons.map((addon) => addon.equipmentId).filter((id): id is string => Boolean(id)),
  ]
    .map((itemId) => inventory.find((item) => item.id === itemId))
    .filter((item): item is (typeof inventory)[number] => Boolean(item));
  const reminderDocumentsCount = reminderItems.reduce((sum, item) => sum + (item.reminderDocuments?.length ?? 0), 0);
  const duePreset =
    state.payment.dueKind === "date"
      ? "date"
      : state.payment.dueDays === 14
        ? "14"
        : state.payment.dueDays === 7 || !state.payment.dueDays
          ? "7"
          : "custom";

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || !state.vehicle) return;
        props.onSubmit({ ...state, vehicle: state.vehicle });
      }}
    >
      <Section title="Art der Vermietung" description="Zuerst auswählen, ob ein Fahrzeug oder ein Gerät vermietet wird. Danach ändern sich die Angaben passend.">
        <div className="grid gap-4 md:grid-cols-2">
          <KindCard
            active={state.rentalKind === "vehicle"}
            title="Fahrzeug"
            description="Fahrzeugmiete mit Kennzeichen, Fahrern, Führerscheindaten, Versicherung und Fahrzeugbedingungen."
            disabled={Boolean(readOnly.vehicle)}
            onClick={() =>
              setState((s) => ({
                ...s,
                rentalKind: "vehicle",
                vehicle: s.vehicle?.kind === "vehicle" ? s.vehicle : null,
                reminderAttachmentSelections: s.vehicle?.kind === "vehicle" ? s.reminderAttachmentSelections : [],
              }))
            }
          />
          <KindCard
            active={state.rentalKind === "equipment"}
            title="Gerät"
            description="Gerätemiete mit Nutzerangaben, Gerätezustand, Zubehör/Vollständigkeit und Geräte-Mietbedingungen."
            disabled={Boolean(readOnly.vehicle)}
            onClick={() =>
              setState((s) => ({
                ...s,
                rentalKind: "equipment",
                vehicle: s.vehicle?.kind === "equipment" ? s.vehicle : null,
                reminderAttachmentSelections: s.vehicle?.kind === "equipment" ? s.reminderAttachmentSelections : [],
              }))
            }
          />
        </div>
      </Section>

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

      <Section
        title="Mieter"
        description={state.rentalKind === "equipment" ? "Kontaktdaten und Identifikation für die Gerätemiete." : "Kontaktdaten + Führerschein optional."}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-4 md:col-span-2 md:grid-cols-[140px_140px_1fr_1fr]">
            <Field label="Anrede">
              <select
                value={state.tenant.salutation ?? ""}
                disabled={Boolean(readOnly.tenant)}
                onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { salutation: e.target.value as RentalParty["salutation"] }) }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              >
                <option value="">—</option>
                <option value="herr">Herr</option>
                <option value="frau">Frau</option>
                <option value="divers">Divers</option>
              </select>
            </Field>
            <Field label="Titel">
              <input
                value={state.tenant.title ?? ""}
                disabled={Boolean(readOnly.tenant)}
                onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { title: e.target.value }) }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                placeholder="Dr."
              />
            </Field>
            <Field label="Vorname(n)">
              <input
                value={state.tenant.firstNames ?? ""}
                disabled={Boolean(readOnly.tenant)}
                onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { firstNames: e.target.value }) }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                required
              />
            </Field>
            <Field label="Nachname">
              <input
                value={state.tenant.lastName ?? ""}
                disabled={Boolean(readOnly.tenant)}
                onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { lastName: e.target.value }) }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                required
              />
            </Field>
          </div>
          <Field label="E-Mail">
            <input
              type="email"
              value={state.tenant.email}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { email: e.target.value }) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            />
          </Field>
          <Field label="Telefon">
            <input
              value={state.tenant.phone ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { phone: e.target.value }) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Adresse (optional)">
            <input
              value={state.tenant.addressLine1 ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { addressLine1: e.target.value }) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              placeholder="Straße, Nr."
            />
          </Field>
          <Field label="PLZ">
            <input
              value={state.tenant.postalCode ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { postalCode: e.target.value }) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Ort">
            <input
              value={state.tenant.city ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: updatePartyName(s.tenant, { city: e.target.value }) }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Field label="Geburtstag">
            <input
              type="date"
              value={(state.tenant.birthDate ?? "").slice(0, 10)}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, birthDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          <Field label="Personalausweis-Nr.">
            <input
              value={state.tenant.identityCardNumber ?? ""}
              disabled={Boolean(readOnly.tenant)}
              onChange={(e) => setState((s) => ({ ...s, tenant: { ...s.tenant, identityCardNumber: e.target.value } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            />
          </Field>
          {state.rentalKind === "vehicle" ? (
            <>
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
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Mietgegenstand" description="Fahrzeug oder Gerät aus dem Bestand wählen.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={state.rentalKind === "equipment" ? "Gerät auswählen" : "Fahrzeug auswählen"}>
            <select
              value={selectedVehicleId}
              disabled={Boolean(readOnly.vehicle)}
              onChange={(e) => {
                const vehicleId = e.target.value;
                const v = primaryInventory.find((x) => x.id === vehicleId);
                if (!v) return setState((s) => ({ ...s, vehicle: null, reminderAttachmentSelections: [] }));
                const label =
                  (v.kind ?? "vehicle") === "equipment"
                    ? vehicleDisplayName(v)
                    : `${[v.brand, v.model].filter(Boolean).join(" ")} (${v.licensePlate})`.trim();
                setState((s) => ({
                  ...s,
                  reminderAttachmentSelections: s.reminderAttachmentSelections.filter((selection) => selection.itemId !== s.vehicle?.vehicleId),
                  vehicle: {
                    vehicleId: v.id,
                    kind: v.kind ?? "vehicle",
                    label,
                    category: v.category,
                    type: [v.brand, v.model].filter(Boolean).join(" "),
                    licensePlate: (v.kind ?? "vehicle") === "vehicle" ? v.licensePlate : undefined,
                    vin: (v.kind ?? "vehicle") === "vehicle" ? v.vin : undefined,
                    registrationDocumentNumber: (v.kind ?? "vehicle") === "vehicle" ? v.registrationDocumentNumber : undefined,
                  },
                }));
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              required
            >
              <option value="" disabled>
                Bitte wählen…
              </option>
              {primaryInventory.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleDisplayName(v)}
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
        title={state.rentalKind === "equipment" ? "Zusätzliche Nutzer" : "Zusatzfahrer"}
        description={state.rentalKind === "equipment" ? "Optional: weitere berechtigte Nutzer des Geräts." : "Optional. Für Prozess: zuerst Name/E-Mail reicht, Details später."}
        right={
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setState((s) => ({ ...s, additionalDrivers: [...s.additionalDrivers, defaultTenant()] }))}
          >
            {state.rentalKind === "equipment" ? "Nutzer hinzufügen" : "Zusatzfahrer hinzufügen"}
          </button>
        }
      >
        {state.additionalDrivers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {state.rentalKind === "equipment" ? "Keine zusätzlichen Nutzer." : "Keine Zusatzfahrer."}
          </div>
        ) : (
          <div className="grid gap-3">
            {state.additionalDrivers.map((d, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm font-semibold">{state.rentalKind === "equipment" ? "Zusätzlicher Nutzer" : "Zusatzfahrer"} #{idx + 1}</div>
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
                  <div className="grid gap-3 md:col-span-2 md:grid-cols-[140px_140px_1fr_1fr]">
                    <Field label="Anrede">
                      <select
                        value={d.salutation ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? updatePartyName(x, { salutation: e.target.value as RentalParty["salutation"] }) : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      >
                        <option value="">—</option>
                        <option value="herr">Herr</option>
                        <option value="frau">Frau</option>
                        <option value="divers">Divers</option>
                      </select>
                    </Field>
                    <Field label="Titel">
                      <input
                        value={d.title ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? updatePartyName(x, { title: e.target.value }) : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                        placeholder="Dr."
                      />
                    </Field>
                    <Field label="Vorname(n)">
                      <input
                        value={d.firstNames ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? updatePartyName(x, { firstNames: e.target.value }) : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      />
                    </Field>
                    <Field label="Nachname">
                      <input
                        value={d.lastName ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? updatePartyName(x, { lastName: e.target.value }) : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      />
                    </Field>
                  </div>
                  <Field label="Telefon mobil">
                    <input
                      value={d.phone ?? ""}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                  <Field label="Adresse">
                    <input
                      value={d.addressLine1 ?? ""}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, addressLine1: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="PLZ">
                      <input
                        value={d.postalCode ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, postalCode: e.target.value } : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      />
                    </Field>
                    <Field label="Ort">
                      <input
                        value={d.city ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, city: e.target.value } : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      />
                    </Field>
                  </div>
                  <Field label="Geburtstag">
                    <input
                      type="date"
                      value={(d.birthDate ?? "").slice(0, 10)}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, birthDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                  <Field label="Personalausweisnummer">
                    <input
                      value={d.identityCardNumber ?? ""}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, identityCardNumber: e.target.value } : x)),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                    />
                  </Field>
                  {state.rentalKind === "vehicle" ? (
                    <Field label="Führerscheinnummer">
                      <input
                        value={d.driverLicenseNumber ?? ""}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            additionalDrivers: s.additionalDrivers.map((x, i) => (i === idx ? { ...x, driverLicenseNumber: e.target.value } : x)),
                          }))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
                      />
                    </Field>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={state.rentalKind === "equipment" ? "Absicherung" : "Versicherung"}
        description={state.rentalKind === "equipment" ? "Optionale Absicherung, Kaution oder Haftungshinweise für die Gerätemiete." : "Schnelle Auswahl + Selbstbeteiligung optional."}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Paket">
            <select
              value={state.insurance.kind}
              onChange={(e) => setState((s) => ({ ...s, insurance: { ...s.insurance, kind: e.target.value as RentalInsurance["kind"] } }))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="basis">{state.rentalKind === "equipment" ? "Ohne Zusatzabsicherung" : "Basis"}</option>
              <option value="vollkasko">{state.rentalKind === "equipment" ? "Geräteschutz" : "Vollkasko"}</option>
              <option value="premium">{state.rentalKind === "equipment" ? "Premium-Geräteschutz" : "Premium"}</option>
            </select>
          </Field>
          <Field label={state.rentalKind === "equipment" ? "Kaution / Selbstbeteiligung (EUR)" : "Selbstbeteiligung (EUR)"}>
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
        description="Aus dem Leistungskatalog auswählen und Menge anpassen."
        right={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  addons: [...s.addons, { id: `addon-${Date.now()}`, name: "", hint: "", qty: 1, unitPriceEur: 0, vatRate: 19 }],
                }))
              }
            >
              Freie Leistung
            </button>
            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={() => setState((s) => ({ ...s, payment: { ...s.payment, totalEur: addonTotal } }))}
            >
              Summe übernehmen
            </button>
          </div>
        }
      >
        {applicableServices.length > 0 ? (
          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
            <Field label="Leistung aus Katalog">
              <select
                value=""
                onChange={(e) => {
                  const service = services.find((item) => item.id === e.target.value);
                  if (!service) return;
                  setState((s) => ({ ...s, addons: [...s.addons, addonFromService(service)] }));
                }}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              >
                <option value="" disabled>
                  Leistung auswählen…
                </option>
                {applicableServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.unitPriceEur.toFixed(2)} € · {service.vatRate}% MwSt
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end text-sm font-semibold text-slate-900">Summe: {addonTotal.toFixed(2)} €</div>
          </div>
        ) : null}
        {rentableEquipment.length > 0 ? (
          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
            <Field label="Gerät als Zubehör">
              <select
                value=""
                onChange={(e) => {
                  const equipment = rentableEquipment.find((item) => item.id === e.target.value);
                  if (!equipment) return;
                  setState((s) => ({
                    ...s,
                    addons: [
                      ...s.addons,
                      {
                        id: `equipment-${Date.now()}-${equipment.id}`,
                        equipmentId: equipment.id,
                        name: vehicleDisplayName(equipment),
                        hint: "Zubehör Fahrzeugmiete",
                        qty: rentalDays(s.startAt, s.endAt),
                        unitPriceEur: equipment.dailyRentalPriceEur ?? 0,
                        vatRate: 19,
                      },
                    ],
                  }));
                }}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              >
                <option value="" disabled>
                  Zubehör auswählen…
                </option>
                {rentableEquipment.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {vehicleDisplayName(equipment)} · {(equipment.dailyRentalPriceEur ?? 0).toFixed(2)} €/Tag
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end text-sm font-semibold text-slate-900">Mietdauer: {durationDays} Tag(e)</div>
          </div>
        ) : null}
        {state.addons.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Keine Zusatzleistungen.</div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 xl:grid xl:grid-cols-[minmax(220px,1.3fr)_minmax(260px,1.6fr)_90px_100px_130px_120px] xl:gap-3">
              {["Leistung", "Hinweis", "Menge", "MwSt %", "Preis/Stk", "Brutto"].map((label) => (
                <div key={label} className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </div>
              ))}
            </div>
            {state.addons.map((a, idx) => (
              <div key={a.id} className={["p-4", idx > 0 ? "border-t border-slate-100" : ""].join(" ")}>
                <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.3fr)_minmax(260px,1.6fr)_90px_100px_130px_120px]">
                  <Field label="Leistung" className="min-w-0 xl:[&>span]:sr-only">
                    <input
                      value={a.name}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-300 xl:shadow-none"
                    />
                  </Field>
                  <Field label="Hinweis" className="min-w-0 xl:[&>span]:sr-only">
                    <input
                      value={a.hint ?? ""}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, hint: e.target.value } : x)),
                        }))
                      }
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-300 xl:shadow-none"
                    />
                  </Field>
                  <Field label="Menge" className="min-w-0 xl:[&>span]:sr-only">
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
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 xl:shadow-none"
                    />
                  </Field>
                  <Field label="MwSt %" className="min-w-0 xl:[&>span]:sr-only">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={a.vatRate ?? 19}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          addons: s.addons.map((x, i) => (i === idx ? { ...x, vatRate: Number(e.target.value) } : x)),
                        }))
                      }
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 xl:shadow-none"
                    />
                  </Field>
                  <Field label="Preis/Stk (EUR)" className="min-w-0 xl:[&>span]:sr-only">
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
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 xl:shadow-none"
                    />
                  </Field>
                  <div className="grid gap-1">
                    <span className="text-xs font-semibold text-slate-600 xl:sr-only">Brutto</span>
                    <div className="flex h-11 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
                      <span>{(((a.unitPriceEur ?? 0) * a.qty * (1 + (a.vatRate ?? 19) / 100))).toFixed(2)} €</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-xl px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-white"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            addons: s.addons.filter((_, i) => i !== idx),
                            reminderAttachmentSelections: a.equipmentId
                              ? s.reminderAttachmentSelections.filter((selection) => selection.itemId !== a.equipmentId)
                              : s.reminderAttachmentSelections,
                          }))
                        }
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Erinnerungsmail Anhänge"
        description="Spezifische Dokumente des Mietobjekts und ausgewählter Zubehör-Geräte werden der automatischen Erinnerung beigefügt."
      >
        {reminderDocumentsCount === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Für die aktuell ausgewählten Mietobjekte sind keine spezifischen Erinnerungsmail-Dokumente hinterlegt.
          </div>
        ) : (
          <div className="grid gap-3">
            {reminderItems.map((item) => {
              const documents = item.reminderDocuments ?? [];
              if (documents.length === 0) return null;
              const selected = state.reminderAttachmentSelections.find((selection) => selection.itemId === item.id)?.documentIds ?? [];
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{vehicleDisplayName(item)}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {documents.map((document) => (
                      <label key={document.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selected.includes(document.id)}
                          onChange={(e) =>
                            setState((s) => {
                              const current = s.reminderAttachmentSelections.find((selection) => selection.itemId === item.id)?.documentIds ?? [];
                              const nextDocumentIds = e.target.checked ? [...new Set([...current, document.id])] : current.filter((id) => id !== document.id);
                              const otherSelections = s.reminderAttachmentSelections.filter((selection) => selection.itemId !== item.id);
                              return {
                                ...s,
                                reminderAttachmentSelections:
                                  nextDocumentIds.length > 0 ? [...otherSelections, { itemId: item.id, documentIds: nextDocumentIds }] : otherSelections,
                              };
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{document.filename}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Spezifische Dokumente</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Zahlung" description="Gesamtbetrag, Anzahlung, Fälligkeit und Status.">
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

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Zahlbar bis">
            <select
              value={duePreset}
              disabled={Boolean(readOnly.payment)}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "7" || value === "14") {
                  setState((s) => ({ ...s, payment: { ...s.payment, dueKind: "days", dueDays: Number(value), dueDate: undefined } }));
                } else if (value === "custom") {
                  setState((s) => ({ ...s, payment: { ...s.payment, dueKind: "days", dueDays: s.payment.dueDays && ![7, 14].includes(s.payment.dueDays) ? s.payment.dueDays : 30, dueDate: undefined } }));
                } else {
                  setState((s) => ({ ...s, payment: { ...s.payment, dueKind: "date", dueDate: s.payment.dueDate || new Date().toISOString().slice(0, 10), dueDays: undefined } }));
                }
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
            >
              <option value="7">7 Tage</option>
              <option value="14">14 Tage</option>
              <option value="custom">Tage angeben</option>
              <option value="date">Bis Datum</option>
            </select>
          </Field>
          {duePreset === "custom" ? (
            <Field label="Tage">
              <input
                type="number"
                min={1}
                step={1}
                value={state.payment.dueDays ?? 30}
                disabled={Boolean(readOnly.payment)}
                onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, dueKind: "days", dueDays: Math.max(1, Number(e.target.value)), dueDate: undefined } }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              />
            </Field>
          ) : null}
          {duePreset === "date" ? (
            <Field label="Datum">
              <input
                type="date"
                value={(state.payment.dueDate ?? "").slice(0, 10)}
                disabled={Boolean(readOnly.payment)}
                onChange={(e) => setState((s) => ({ ...s, payment: { ...s.payment, dueKind: "date", dueDate: e.target.value, dueDays: undefined } }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-300"
              />
            </Field>
          ) : null}
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
