import type { DamageReport, InventoryDocument, MaintenanceEntry, MaintenanceStatus, OdometerEntry, Vehicle, VehicleDb } from "../domain/vehicle";
import { createId } from "../lib/id";
import { nowIso } from "../lib/time";
import { loadVehicleDb, saveVehicleDb } from "./vehicleDb";

export type VehicleSummary = Vehicle & {
  currentKm?: number;
  openDamages: number;
};

function getCurrentKm(db: VehicleDb, vehicleId: string): number | undefined {
  const entries = db.odometer.filter((e) => e.vehicleId === vehicleId).sort((a, b) => a.at.localeCompare(b.at));
  return entries.at(-1)?.km;
}

export function listVehicles(): VehicleSummary[] {
  const db = loadVehicleDb();
  return db.vehicles
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((v) => {
      const openDamages = db.damages.filter((d) => d.vehicleId === v.id).length;
      return { ...v, currentKm: getCurrentKm(db, v.id), openDamages };
    });
}

export function getVehicle(vehicleId: string): {
  vehicle: Vehicle;
  odometer: OdometerEntry[];
  damages: DamageReport[];
  maintenances: MaintenanceEntry[];
} | null {
  const db = loadVehicleDb();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return null;
  const odometer = db.odometer
    .filter((e) => e.vehicleId === vehicleId)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const damages = db.damages
    .filter((d) => d.vehicleId === vehicleId)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const maintenances = db.maintenances
    .filter((m) => m.vehicleId === vehicleId)
    .slice()
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return { vehicle, odometer, damages, maintenances };
}

export function createVehicle(input: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Vehicle {
  const db = loadVehicleDb();
  const now = nowIso();
  const vehicle: Vehicle = { ...input, id: createId("veh"), createdAt: now, updatedAt: now };
  db.vehicles.push(vehicle);
  saveVehicleDb(db);
  return vehicle;
}

export function updateVehicle(vehicleId: string, patch: Partial<Omit<Vehicle, "id" | "createdAt" | "updatedAt">>): Vehicle {
  const db = loadVehicleDb();
  const idx = db.vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) throw new Error("Vehicle not found");
  const updated: Vehicle = { ...db.vehicles[idx], ...patch, updatedAt: nowIso() };
  db.vehicles[idx] = updated;
  saveVehicleDb(db);
  return updated;
}

export function addInventoryDocument(vehicleId: string, document: Omit<InventoryDocument, "id" | "uploadedAt">): Vehicle {
  const db = loadVehicleDb();
  const idx = db.vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) throw new Error("Vehicle not found");
  const doc: InventoryDocument = { ...document, id: createId("doc"), uploadedAt: nowIso() };
  const vehicle = db.vehicles[idx];
  const key = doc.category === "general_equipment" ? "generalDocuments" : "reminderDocuments";
  db.vehicles[idx] = { ...vehicle, [key]: [...(vehicle[key] ?? []), doc], updatedAt: nowIso() };
  saveVehicleDb(db);
  return db.vehicles[idx];
}

export function deleteInventoryDocument(vehicleId: string, documentId: string): Vehicle {
  const db = loadVehicleDb();
  const idx = db.vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) throw new Error("Vehicle not found");
  const vehicle = db.vehicles[idx];
  db.vehicles[idx] = {
    ...vehicle,
    reminderDocuments: (vehicle.reminderDocuments ?? []).filter((doc) => doc.id !== documentId),
    generalDocuments: (vehicle.generalDocuments ?? []).filter((doc) => doc.id !== documentId),
    updatedAt: nowIso(),
  };
  saveVehicleDb(db);
  return db.vehicles[idx];
}

export function deleteVehicle(vehicleId: string): void {
  const db = loadVehicleDb();
  db.vehicles = db.vehicles.filter((v) => v.id !== vehicleId);
  db.odometer = db.odometer.filter((e) => e.vehicleId !== vehicleId);
  db.damages = db.damages.filter((d) => d.vehicleId !== vehicleId);
  db.maintenances = db.maintenances.filter((m) => m.vehicleId !== vehicleId);
  saveVehicleDb(db);
}

export function addOdometerEntry(input: Omit<OdometerEntry, "id">): OdometerEntry {
  const db = loadVehicleDb();
  const entry: OdometerEntry = { ...input, id: createId("odo") };
  db.odometer.push(entry);
  saveVehicleDb(db);
  return entry;
}

export function addDamage(input: Omit<DamageReport, "id" | "createdAt" | "updatedAt">): DamageReport {
  const db = loadVehicleDb();
  const now = nowIso();
  const damage: DamageReport = { ...input, id: createId("dmg"), createdAt: now, updatedAt: now };
  db.damages.push(damage);
  saveVehicleDb(db);
  return damage;
}

export function updateDamage(damageId: string, patch: Partial<Omit<DamageReport, "id" | "createdAt" | "updatedAt">>): DamageReport {
  const db = loadVehicleDb();
  const idx = db.damages.findIndex((d) => d.id === damageId);
  if (idx < 0) throw new Error("Damage not found");
  const updated: DamageReport = { ...db.damages[idx], ...patch, updatedAt: nowIso() };
  db.damages[idx] = updated;
  saveVehicleDb(db);
  return updated;
}

export function listMaintenances(): MaintenanceEntry[] {
  const db = loadVehicleDb();
  return db.maintenances.slice().sort((a, b) => b.startAt.localeCompare(a.startAt));
}

export function addMaintenance(input: {
  vehicleId: string;
  startAt: string;
  endAt?: string | null;
  title: string;
  status?: MaintenanceStatus;
  notes?: string;
}): MaintenanceEntry {
  const db = loadVehicleDb();
  const now = nowIso();
  const entry: MaintenanceEntry = {
    id: createId("mnt"),
    vehicleId: input.vehicleId,
    createdAt: now,
    updatedAt: now,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    title: input.title,
    status: input.status ?? "geplant",
    notes: input.notes?.trim() || undefined,
  };
  db.maintenances.push(entry);
  saveVehicleDb(db);
  return entry;
}

export function updateMaintenance(maintenanceId: string, patch: Partial<Omit<MaintenanceEntry, "id" | "createdAt" | "updatedAt">>): MaintenanceEntry {
  const db = loadVehicleDb();
  const idx = db.maintenances.findIndex((m) => m.id === maintenanceId);
  if (idx < 0) throw new Error("Maintenance not found");
  const updated: MaintenanceEntry = { ...db.maintenances[idx], ...patch, updatedAt: nowIso() };
  db.maintenances[idx] = updated;
  saveVehicleDb(db);
  return updated;
}

export function deleteMaintenance(maintenanceId: string): void {
  const db = loadVehicleDb();
  db.maintenances = db.maintenances.filter((m) => m.id !== maintenanceId);
  saveVehicleDb(db);
}
