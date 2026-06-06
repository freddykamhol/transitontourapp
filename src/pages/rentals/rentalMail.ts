import type { Rental, RentalSignerKey } from "../../domain/rental";
import { prepareRentalSignaturePackage, sendMail } from "../../api/portalApi";
import { buildDamageListPdf, buildRentalContractPdf } from "./rentalDocs";

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function signatureUrl(rental: Rental, signer: RentalSignerKey): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const mieter = signer === "tenant2" ? "2" : "1";
  return `${base}/signieren/${encodeURIComponent(rental.id)}?mieter=${mieter}`;
}

export function buildRentalDocumentsMailText(rental: Rental, signer: RentalSignerKey): string {
  const party = signer === "tenant2" ? rental.additionalDrivers[0] : rental.tenant;
  const name = party?.name?.trim() || "Hallo";
  return [
    `Hallo ${name},`,
    "",
    `anbei erhältst du den Mietvertrag und die Schadensliste zu deiner Vermietung ${rental.id}.`,
    "",
    "Bitte signiere den Mietvertrag digital über diesen Link:",
    signatureUrl(rental, signer),
    "",
    "Alternativ kannst du den Mietvertrag ausdrucken, unterschrieben zur Abholung mitbringen und vorlegen.",
    "",
    "Viele Grüße",
    "Transit on Tour",
  ].join("\n");
}

export async function sendRentalDocumentsMail(rental: Rental): Promise<{ messageId: string | null }> {
  if (!rental.tenant.email) throw new Error("Keine Mieter-E-Mail hinterlegt.");

  await prepareRentalSignaturePackage(rental);

  const contract = buildRentalContractPdf(rental);
  const damageList = buildDamageListPdf(rental);
  const [contractBase64, damageListBase64] = await Promise.all([
    arrayBufferToBase64(contract.output("arraybuffer") as ArrayBuffer),
    arrayBufferToBase64(damageList.output("arraybuffer") as ArrayBuffer),
  ]);

  const attachments = [
    { filename: `mietvertrag-${rental.id}.pdf`, contentBase64: contractBase64, contentType: "application/pdf" },
    { filename: `schadensliste-${rental.id}.pdf`, contentBase64: damageListBase64, contentType: "application/pdf" },
  ];

  const primary = await sendMail({
    to: [rental.tenant.email],
    subject: `Mietunterlagen ${rental.id} - ${rental.vehicle.licensePlate ?? rental.vehicle.label}`,
    text: buildRentalDocumentsMailText(rental, "tenant1"),
    attachments,
  });

  const secondTenant = rental.additionalDrivers[0];
  if (secondTenant?.email) {
    await sendMail({
      to: [secondTenant.email],
      subject: `Mietunterlagen ${rental.id} - ${rental.vehicle.licensePlate ?? rental.vehicle.label}`,
      text: buildRentalDocumentsMailText(rental, "tenant2"),
      attachments,
    });
  }

  return primary;
}
