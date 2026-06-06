import { db } from "./db.js";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveRentalSignaturePackage(rentalId, rental) {
  const existing = db.prepare("SELECT createdAt, signedContractJson FROM rental_signature_packages WHERE rentalId = ?").get(rentalId);
  const now = nowIso();
  db.prepare(
    `INSERT INTO rental_signature_packages(rentalId, rentalJson, signedContractJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(rentalId) DO UPDATE SET rentalJson = excluded.rentalJson, updatedAt = excluded.updatedAt`,
  ).run(rentalId, JSON.stringify(rental), existing?.signedContractJson ?? null, existing?.createdAt ?? now, now);
}

export function getRentalSignaturePackage(rentalId) {
  const row = db.prepare("SELECT * FROM rental_signature_packages WHERE rentalId = ?").get(rentalId);
  if (!row) return null;
  return {
    rentalId: row.rentalId,
    rental: parseJson(row.rentalJson),
    signedContract: parseJson(row.signedContractJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function saveSignedContract(rentalId, signedContract) {
  const now = nowIso();
  const result = db
    .prepare("UPDATE rental_signature_packages SET signedContractJson = ?, updatedAt = ? WHERE rentalId = ?")
    .run(JSON.stringify(signedContract), now, rentalId);
  return result.changes > 0;
}
