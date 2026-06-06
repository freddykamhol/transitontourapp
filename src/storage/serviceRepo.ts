import type { ServiceDb, ServiceItem } from "../domain/service";
import { createId } from "../lib/id";

const STORAGE_KEY = "tot.serviceDb.v1";

const defaultServices: ServiceItem[] = [
  { id: "svc-rent", name: "Miete Fahrzeug", hint: "Vereinbarte Nutzung des Fahrzeugs", unitPriceEur: 0, vatRate: 19, active: true },
  { id: "svc-cleaning", name: "Endreinigung", hint: "Innen- und Außenreinigung nach Rückgabe", unitPriceEur: 0, vatRate: 19, active: true },
  { id: "svc-delivery", name: "Zustellung / Abholung", hint: "Kosten für Zustellung oder Abholung", unitPriceEur: 0, vatRate: 19, active: true },
  { id: "svc-gas", name: "Servicepauschale / Nutzgas", hint: "Bereitstellung und Rückgabe Gasvorrat", unitPriceEur: 0, vatRate: 19, active: true },
];

function safeParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDb(value: unknown): value is ServiceDb {
  if (!value || typeof value !== "object") return false;
  const db = value as Partial<ServiceDb>;
  return db.version === 1 && Array.isArray(db.services);
}

function loadDb(): ServiceDb {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (isDb(parsed)) return parsed;
  return { version: 1, services: defaultServices };
}

function saveDb(db: ServiceDb): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function listServices(includeInactive = false): ServiceItem[] {
  return loadDb()
    .services.filter((service) => includeInactive || service.active)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertService(input: Omit<ServiceItem, "id"> & { id?: string }): ServiceItem {
  const db = loadDb();
  const service: ServiceItem = { ...input, id: input.id || createId("svc") };
  const idx = db.services.findIndex((item) => item.id === service.id);
  if (idx >= 0) db.services[idx] = service;
  else db.services.push(service);
  saveDb(db);
  return service;
}

export function deleteService(serviceId: string): void {
  const db = loadDb();
  db.services = db.services.filter((service) => service.id !== serviceId);
  saveDb(db);
}
