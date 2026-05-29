import { jsPDF } from "jspdf";
import type { Rental } from "../../domain/rental";
import { getVehicle } from "../../storage/vehicleRepo";
import { damageTypeLabel, positionLabel } from "../vehicles/vehiclesUi";
import { formatDateTime, formatEur } from "./rentalUi";

function safeText(value: string | null | undefined): string {
  return (value ?? "").toString();
}

function addKeyValue(doc: jsPDF, x: number, y: number, key: string, value: string): number {
  doc.setFont("helvetica", "bold");
  doc.text(`${key}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(value, x + 45, y);
  return y + 6;
}

export function buildRentalContractPdf(rental: Rental): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Mietvertrag (Entwurf)", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Vermietungs-ID: ${rental.id}`, 15, 28);

  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.text("Termine", 15, y);
  y += 8;
  y = addKeyValue(doc, 15, y, "Start", formatDateTime(rental.startAt));
  y = addKeyValue(doc, 15, y, "Ende", formatDateTime(rental.endAt));
  y = addKeyValue(doc, 15, y, "Rückgabe", rental.actualReturnAt ? formatDateTime(rental.actualReturnAt) : "—");

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Mieter", 15, y);
  y += 8;
  y = addKeyValue(doc, 15, y, "Name", safeText(rental.tenant.name));
  y = addKeyValue(doc, 15, y, "E-Mail", safeText(rental.tenant.email));
  y = addKeyValue(doc, 15, y, "Telefon", safeText(rental.tenant.phone));
  y = addKeyValue(doc, 15, y, "Adresse", safeText(rental.tenant.addressLine1));

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Fahrzeug", 15, y);
  y += 8;
  y = addKeyValue(doc, 15, y, "Fahrzeug", safeText(rental.vehicle.label));
  y = addKeyValue(doc, 15, y, "Kennzeichen", safeText(rental.vehicle.licensePlate));
  y = addKeyValue(doc, 15, y, "VIN", safeText(rental.vehicle.vin));

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Versicherung", 15, y);
  y += 8;
  y = addKeyValue(doc, 15, y, "Paket", rental.insurance.kind);
  y = addKeyValue(doc, 15, y, "SB (EUR)", String(rental.insurance.deductibleEur ?? 0));

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Unterschriften", 15, y);
  y += 12;
  doc.setDrawColor(180);
  doc.line(15, y, 95, y);
  doc.line(115, y, 195, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Vermieter", 15, y);
  doc.text("Mieter", 115, y);

  return doc;
}

export function downloadRentalContractPdf(rental: Rental): void {
  const doc = buildRentalContractPdf(rental);
  doc.save(`mietvertrag-${rental.id}.pdf`);
}

export function buildInvoicePdf(rental: Rental): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Rechnung (Entwurf)", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Vermietungs-ID: ${rental.id}`, 15, 28);
  if (rental.payment.invoiceNumber) doc.text(`Rechnungsnr.: ${rental.payment.invoiceNumber}`, 15, 34);

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.text("Leistungen", 15, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Pos.", 15, y);
  doc.text("Beschreibung", 28, y);
  doc.text("Menge", 140, y);
  doc.text("Preis", 160, y);
  doc.text("Summe", 185, y, { align: "right" });
  y += 4;
  doc.setDrawColor(220);
  doc.line(15, y, 195, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  const rows = rental.addons.length > 0 ? rental.addons : [{ id: "base", name: "Miete (pauschal)", qty: 1, unitPriceEur: rental.payment.totalEur }];
  rows.forEach((row, idx) => {
    const unit = row.unitPriceEur ?? 0;
    const sum = unit * (row.qty ?? 1);
    doc.text(String(idx + 1), 15, y);
    doc.text(String(row.name || "—"), 28, y);
    doc.text(String(row.qty ?? 1), 145, y, { align: "right" });
    doc.text(formatEur(unit), 175, y, { align: "right" });
    doc.text(formatEur(sum), 195, y, { align: "right" });
    y += 6;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Gesamt", 160, y);
  doc.text(formatEur(rental.payment.totalEur), 195, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Zahlungsstatus: ${rental.payment.status}`, 15, y);
  y += 5;
  doc.text(`Bezahlt: ${formatEur(rental.payment.paidEur)}`, 15, y);

  return doc;
}

export function downloadInvoicePdf(rental: Rental): void {
  const doc = buildInvoicePdf(rental);
  doc.save(`rechnung-${rental.id}.pdf`);
}

export function buildDamageListPdf(rental: Rental): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Schadensliste (Entwurf)", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Vermietungs-ID: ${rental.id}`, 15, 28);
  doc.text(`Fahrzeug: ${rental.vehicle.label}`, 15, 34);

  const vehicleId = rental.vehicle.vehicleId;
  const vehicle = vehicleId ? getVehicle(vehicleId) : null;
  const damages = vehicle?.damages ?? [];

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.text("Schäden", 15, y);
  y += 8;

  if (damages.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Keine Schäden erfasst.", 15, y);
    return doc;
  }

  doc.setFont("helvetica", "bold");
  doc.text("#", 15, y);
  doc.text("Position", 24, y);
  doc.text("Art", 85, y);
  doc.text("Schwere", 130, y);
  y += 4;
  doc.setDrawColor(220);
  doc.line(15, y, 195, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  damages.forEach((dmg, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(idx + 1), 15, y);
    doc.text(positionLabel(dmg.position), 24, y);
    doc.text(damageTypeLabel(dmg.type), 85, y);
    doc.text(String(dmg.severity), 130, y);
    y += 6;
    if (dmg.details) {
      const lines = doc.splitTextToSize(dmg.details, 170);
      doc.setFontSize(9);
      doc.text(lines, 24, y);
      doc.setFontSize(10);
      y += lines.length * 4 + 2;
    }
  });

  return doc;
}

export function downloadDamageListPdf(rental: Rental): void {
  const doc = buildDamageListPdf(rental);
  doc.save(`schadensliste-${rental.id}.pdf`);
}
