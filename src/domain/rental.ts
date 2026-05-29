export type RentalId = string;

export type RentalParty = {
  name: string;
  email: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  driverLicenseNumber?: string;
  driverLicenseIssuedBy?: string;
  driverLicenseValidUntil?: string; // ISO date
};

export type RentalVehicleRef = {
  vehicleId: string;
  label: string; // z.B. "VW T6 (B-AB 1234)"
  licensePlate?: string;
  vin?: string;
};

export type RentalInsurance = {
  kind: "basis" | "vollkasko" | "premium";
  deductibleEur?: number;
  notes?: string;
};

export type RentalAddon = {
  id: string;
  name: string;
  qty: number;
  unitPriceEur?: number;
};

export type RentalPayment = {
  method: "bar" | "karte" | "ueberweisung" | "paypal" | "sonstiges";
  status: "offen" | "teilweise" | "bezahlt" | "erstattet";
  totalEur: number;
  paidEur: number;
  depositEur?: number;
  invoiceNumber?: string;
  notes?: string;
};

export type Rental = {
  id: RentalId;
  createdAt: string;
  updatedAt: string;

  // Termine
  startAt: string; // ISO
  endAt: string; // ISO
  actualReturnAt?: string | null; // ISO

  // Mieter
  tenant: RentalParty;

  // Fahrzeug
  vehicle: RentalVehicleRef;

  // Zusatzfahrer
  additionalDrivers: RentalParty[];

  // Versicherung
  insurance: RentalInsurance;

  // Zusatzleistungen
  addons: RentalAddon[];

  // Zahlung
  payment: RentalPayment;

  internalNotes?: string;
};

export type RentalDb = {
  version: 1;
  rentals: Rental[];
};

