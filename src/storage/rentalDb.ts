import type { RentalDb } from "../domain/rental";

const STORAGE_KEY = "tot.rentalDb.v1";

function safeParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDb(value: unknown): value is RentalDb {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RentalDb>;
  return v.version === 1 && Array.isArray(v.rentals);
}

export function loadRentalDb(): RentalDb {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (isDb(parsed)) return parsed;
  return { version: 1, rentals: [] };
}

export function saveRentalDb(db: RentalDb): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

