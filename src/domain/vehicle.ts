export type Id = string;

export type InventoryKind = "vehicle" | "equipment";

export type VehicleStatus = "verfuegbar" | "vermietet" | "wartung" | "inaktiv";

export type Vehicle = {
  id: Id;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  kind?: InventoryKind;
  internalNumber?: string;
  licensePlate: string;
  category?: string;
  brand?: string;
  model?: string;
  vin?: string;
  registrationDocumentNumber?: string;
  accessoryForVehicleRental?: boolean;
  dailyRentalPriceEur?: number;
  reminderDocuments?: InventoryDocument[];
  generalDocuments?: InventoryDocument[];

  status: VehicleStatus;
  notes?: string;
};

export type InventoryDocument = {
  id: Id;
  filename: string;
  contentBase64: string;
  contentType: string;
  uploadedAt: string;
  category: "specific_documents" | "general_equipment";
};

export type MaintenanceStatus = "geplant" | "in_arbeit" | "erledigt";

export type MaintenanceEntry = {
  id: Id;
  vehicleId: Id;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  startAt: string; // ISO
  endAt?: string | null; // ISO
  title: string;
  status: MaintenanceStatus;
  notes?: string;
};

export type OdometerEntry = {
  id: Id;
  vehicleId: Id;
  at: string; // ISO
  km: number;
  source: "manuell" | "vermietungsabschluss";
  rentalId?: string;
  note?: string;
};

export type DamagePosition =
  | "front_left"
  | "front_center"
  | "front_right"
  | "side_left"
  | "side_right"
  | "rear_left"
  | "rear_center"
  | "rear_right"
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "unknown";

export type DamageSurface = "outside" | "inside" | "none";

export type DamageInteriorLocation =
  | "driver"
  | "passenger"
  | "rear_bench"
  | "trunk"
  | "conversion"
  | "other";

export type DamageType =
  | "kratzer"
  | "delle"
  | "riss"
  | "lack"
  | "scheibe"
  | "reifen"
  | "innenraum"
  | "sonstiges";

export type SketchMarker = {
  x: number; // 0..1 (relative)
  y: number; // 0..1 (relative)
};

export type DamageReport = {
  id: Id;
  vehicleId: Id;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  position: DamagePosition;
  surface?: DamageSurface;
  interiorLocation?: DamageInteriorLocation;
  customLocation?: string;
  locationNote?: string;
  type: DamageType;
  severity: "leicht" | "mittel" | "stark";
  details?: string;
  marker?: SketchMarker;
  photos?: string[]; // data URLs
};

export type VehicleDb = {
  version: 2;
  vehicles: Vehicle[];
  odometer: OdometerEntry[];
  damages: DamageReport[];
  maintenances: MaintenanceEntry[];
};
