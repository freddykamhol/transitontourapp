import type { ReminderMailSettings } from "../../domain/reminder";
import type { Rental } from "../../domain/rental";
import type { jsPDF } from "jspdf";
import { sendMail } from "../../api/portalApi";
import { getVehicle } from "../../storage/vehicleRepo";
import { buildRentalContractPdf, buildReturnChecklistPdf } from "./rentalDocs";

type MailAttachment = { filename: string; contentBase64: string; contentType?: string };

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function renderTemplate(template: string, rental: Rental): string {
  return template
    .replaceAll("{name}", rental.tenant.name || "Hallo")
    .replaceAll("{id}", rental.id)
    .replaceAll("{objekt}", rental.vehicle.label)
    .replaceAll("{rueckgabe}", formatDateTime(rental.endAt));
}

async function pdfAttachment(filename: string, build: () => jsPDF): Promise<MailAttachment> {
  const pdf = build();
  return {
    filename,
    contentBase64: await arrayBufferToBase64(pdf.output("arraybuffer")),
    contentType: "application/pdf",
  };
}

function collectSpecificDocumentAttachments(rental: Rental): MailAttachment[] {
  const selections = rental.reminderWorkflow?.attachmentSelections ?? [];
  return selections.flatMap((selection) => {
    const vehicle = getVehicle(selection.itemId)?.vehicle;
    const documents = vehicle?.reminderDocuments ?? [];
    return documents
      .filter((document) => selection.documentIds.includes(document.id))
      .map((document) => ({
        filename: document.filename,
        contentBase64: document.contentBase64,
        contentType: document.contentType,
      }));
  });
}

export async function buildReminderMailAttachments(rental: Rental, settings: ReminderMailSettings): Promise<MailAttachment[]> {
  const attachments: MailAttachment[] = [];
  if (settings.attachmentCategories.includes("rental_contract")) {
    attachments.push(await pdfAttachment(`mietvertrag-${rental.id}.pdf`, () => buildRentalContractPdf(rental)));
  }
  if (settings.attachmentCategories.includes("return_checklist")) {
    attachments.push(await pdfAttachment(`rueckgabecheckliste-${rental.id}.pdf`, () => buildReturnChecklistPdf(rental)));
  }
  if (settings.attachmentCategories.includes("specific_documents")) {
    attachments.push(...collectSpecificDocumentAttachments(rental));
  }
  return attachments;
}

export async function sendRentalReminderMail(rental: Rental, settings: ReminderMailSettings): Promise<{ messageId: string | null }> {
  if (!rental.tenant.email) throw new Error("Keine Mieter-E-Mail hinterlegt.");
  return sendMail({
    to: [rental.tenant.email],
    subject: renderTemplate(settings.subject, rental),
    text: renderTemplate(settings.text, rental),
    attachments: await buildReminderMailAttachments(rental, settings),
  });
}
