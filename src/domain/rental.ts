export type RentalId = string;

export type RentalParty = {
  name: string;
  salutation?: "herr" | "frau" | "divers" | "";
  title?: string;
  firstNames?: string;
  lastName?: string;
  email: string;
  phone?: string;
  birthDate?: string;
  identityCardNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  driverLicenseNumber?: string;
  driverLicenseIssuedBy?: string;
  driverLicenseValidUntil?: string; // ISO date
};

export function rentalPartyName(party: Pick<RentalParty, "name" | "salutation" | "title" | "firstNames" | "lastName">): string {
  const salutationLabel = party.salutation === "herr" ? "Herr" : party.salutation === "frau" ? "Frau" : "";
  const structured = [salutationLabel, party.title, party.firstNames, party.lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return structured || party.name || "";
}

export function rentalPartyFirstName(party: Pick<RentalParty, "name" | "firstNames">): string {
  const firstNames = (party.firstNames ?? "").trim();
  if (firstNames) return firstNames.split(/\s+/)[0] ?? firstNames;
  return (party.name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function normalizeRentalPartyNameParts(party: RentalParty): RentalParty {
  if ((party.firstNames ?? "").trim() || (party.lastName ?? "").trim()) {
    return { ...party, name: rentalPartyName(party) };
  }
  const parts = (party.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return party;
  return {
    ...party,
    firstNames: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

export type RentalVehicleRef = {
  vehicleId: string;
  kind?: "vehicle" | "equipment";
  label: string; // z.B. "VW T6 (B-AB 1234)"
  category?: string;
  type?: string;
  licensePlate?: string;
  vin?: string;
  registrationDocumentNumber?: string;
};

export type RentalInsurance = {
  kind: "basis" | "vollkasko" | "premium";
  deductibleEur?: number;
  notes?: string;
};

export type RentalAddon = {
  id: string;
  serviceId?: string;
  equipmentId?: string;
  name: string;
  hint?: string;
  qty: number;
  unitPriceEur?: number;
  vatRate?: number;
};

export type RentalPayment = {
  method: "bar" | "karte" | "ueberweisung" | "paypal" | "sonstiges";
  status: "offen" | "teilweise" | "bezahlt" | "erstattet";
  totalEur: number;
  paidEur: number;
  depositEur?: number;
  dueKind?: "days" | "date";
  dueDays?: number;
  dueDate?: string;
  invoiceNumber?: string;
  notes?: string;
};

export type RentalSignerKey = "tenant1" | "tenant2";

export type RentalDigitalSignature = {
  signer: RentalSignerKey;
  signerName: string;
  signatureDataUrl: string;
  signedAt: string;
};

export type RentalSignedContract = {
  filename: string;
  contentBase64: string;
  contentType: string;
  uploadedAt: string;
  signedAt: string;
  source: "digital" | "paper";
  digitalSignatures?: RentalDigitalSignature[];
};

export type RentalContractWorkflow = {
  lastSentAt?: string;
  lastMessageId?: string | null;
  lastError?: string;
  digitalSignatures?: RentalDigitalSignature[];
  signedContract?: RentalSignedContract;
};

export type RentalReminderAttachmentSelection = {
  itemId: string;
  documentIds: string[];
};

export type RentalReminderWorkflow = {
  attachmentSelections?: RentalReminderAttachmentSelection[];
  sentAt?: string;
  messageId?: string | null;
  lastError?: string;
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

  contractWorkflow?: RentalContractWorkflow;
  reminderWorkflow?: RentalReminderWorkflow;
  internalNotes?: string;
};

export type RentalDb = {
  version: 1;
  rentals: Rental[];
};
