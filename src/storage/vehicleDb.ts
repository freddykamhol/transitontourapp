import type { VehicleDb } from "../domain/vehicle";

const STORAGE_KEY_V1 = "tot.vehicleDb.v1";
const STORAGE_KEY_V2 = "tot.vehicleDb.v2";

function safeParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isDbV2(value: unknown): value is VehicleDb {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<VehicleDb>;
  return (
    v.version === 2 &&
    Array.isArray(v.vehicles) &&
    Array.isArray(v.odometer) &&
    Array.isArray(v.damages) &&
    Array.isArray(v.maintenances)
  );
}

function normalizeDb(db: VehicleDb): VehicleDb {
  return {
    ...db,
    vehicles: db.vehicles.map((vehicle) => ({
      ...vehicle,
      kind: vehicle.kind ?? "vehicle",
      accessoryForVehicleRental: Boolean(vehicle.accessoryForVehicleRental),
      dailyRentalPriceEur:
        typeof vehicle.dailyRentalPriceEur === "number" && Number.isFinite(vehicle.dailyRentalPriceEur)
          ? vehicle.dailyRentalPriceEur
          : undefined,
    })),
  };
}

export function loadVehicleDb(): VehicleDb {
  const parsedV2 = safeParse(localStorage.getItem(STORAGE_KEY_V2));
  if (isDbV2(parsedV2)) return normalizeDb(parsedV2);

  const parsedV1 = safeParse(localStorage.getItem(STORAGE_KEY_V1));
  if (
    parsedV1 &&
    typeof parsedV1 === "object" &&
    (parsedV1 as { version?: unknown }).version === 1 &&
    Array.isArray((parsedV1 as { vehicles?: unknown }).vehicles) &&
    Array.isArray((parsedV1 as { odometer?: unknown }).odometer) &&
    Array.isArray((parsedV1 as { damages?: unknown }).damages)
  ) {
    const v1 = parsedV1 as { vehicles: VehicleDb["vehicles"]; odometer: VehicleDb["odometer"]; damages: VehicleDb["damages"] };
    const migrated: VehicleDb = normalizeDb({ version: 2, vehicles: v1.vehicles, odometer: v1.odometer, damages: v1.damages, maintenances: [] });
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
    return migrated;
  }

  return { version: 2, vehicles: [], odometer: [], damages: [], maintenances: [] };
}

export function saveVehicleDb(db: VehicleDb): void {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(db));
}
