import type { Rental, RentalAddon, RentalInsurance, RentalParty, RentalPayment, RentalReminderAttachmentSelection, RentalVehicleRef } from "../domain/rental";
import { nowIso } from "../lib/time";
import { loadRentalDb, saveRentalDb } from "./rentalDb";

export type RentalStatus = "geplant" | "laufend" | "archiv";

function nextRentalId(existingRentals: Rental[]): string {
  const highest = existingRentals.reduce((max, rental) => {
    const match = rental.id.match(/^MV(\d{9})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `MV${String(highest + 1).padStart(9, "0")}`;
}

export function getRentalStatus(rental: Rental, now = new Date()): { status: RentalStatus; overdue: boolean } {
  if (rental.actualReturnAt) return { status: "archiv", overdue: false };
  const start = new Date(rental.startAt);
  const end = new Date(rental.endAt);
  const overdue = Number.isFinite(end.getTime()) && end.getTime() < now.getTime();
  if (Number.isFinite(start.getTime()) && start.getTime() > now.getTime()) return { status: "geplant", overdue: false };
  return { status: "laufend", overdue };
}

export function listRentals(): Rental[] {
  const db = loadRentalDb();
  return db.rentals.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getRental(rentalId: string): Rental | null {
  const db = loadRentalDb();
  return db.rentals.find((r) => r.id === rentalId) ?? null;
}

export type CreateRentalInput = {
  startAt: string;
  endAt: string;
  tenant: RentalParty;
  vehicle: RentalVehicleRef;
  additionalDrivers?: RentalParty[];
  insurance?: RentalInsurance;
  addons?: RentalAddon[];
  payment?: RentalPayment;
  reminderAttachmentSelections?: RentalReminderAttachmentSelection[];
  internalNotes?: string;
};

export function createRental(input: CreateRentalInput): Rental {
  const db = loadRentalDb();
  const now = nowIso();

  const rental: Rental = {
    id: nextRentalId(db.rentals),
    createdAt: now,
    updatedAt: now,
    startAt: input.startAt,
    endAt: input.endAt,
    actualReturnAt: null,
    tenant: input.tenant,
    vehicle: input.vehicle,
    additionalDrivers: input.additionalDrivers ?? [],
    insurance: input.insurance ?? { kind: "basis" },
    addons: input.addons ?? [],
    payment: input.payment ?? { method: "karte", status: "offen", totalEur: 0, paidEur: 0 },
    reminderWorkflow: { attachmentSelections: input.reminderAttachmentSelections ?? [] },
    internalNotes: input.internalNotes ?? "",
  };

  db.rentals.push(rental);
  saveRentalDb(db);
  return rental;
}

export function updateRental(rentalId: string, patch: Partial<Omit<Rental, "id" | "createdAt" | "updatedAt">>): Rental {
  const db = loadRentalDb();
  const idx = db.rentals.findIndex((r) => r.id === rentalId);
  if (idx < 0) throw new Error("Rental not found");
  const updated: Rental = { ...db.rentals[idx], ...patch, updatedAt: nowIso() };
  db.rentals[idx] = updated;
  saveRentalDb(db);
  return updated;
}

export function markReturned(rentalId: string, atIso?: string): Rental {
  return updateRental(rentalId, { actualReturnAt: atIso ?? nowIso() });
}

export function deleteRental(rentalId: string): void {
  const db = loadRentalDb();
  db.rentals = db.rentals.filter((r) => r.id !== rentalId);
  saveRentalDb(db);
}
