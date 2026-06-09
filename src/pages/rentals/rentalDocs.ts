import { jsPDF } from "jspdf";
import type { Rental, RentalAddon, RentalDigitalSignature, RentalParty } from "../../domain/rental";
import { getCompanyData } from "../../storage/companyRepo";
import { getVehicle } from "../../storage/vehicleRepo";
import { renderSketchWithMarkers } from "../vehicles/exportDamageSketch";
import { damageLocationLabel, damageTypeLabel } from "../vehicles/vehiclesUi";
import { formatEur } from "./rentalUi";

function safeText(value: string | null | undefined): string {
  return (value ?? "").toString();
}

function compact(values: Array<string | null | undefined>): string {
  return values.map((value) => safeText(value).trim()).filter(Boolean).join(", ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return safeText(value);
  return date.toLocaleDateString("de-DE");
}

function partyAddress(party: RentalParty): string {
  return compact([party.addressLine1, compact([party.postalCode, party.city])]);
}

function money(value: number): string {
  return formatEur(Number.isFinite(value) ? value : 0);
}

function addonNet(addon: RentalAddon): number {
  return (addon.unitPriceEur ?? 0) * addon.qty;
}

function addonVat(addon: RentalAddon): number {
  return addonNet(addon) * ((addon.vatRate ?? 19) / 100);
}

function paymentDueLabel(payment: Rental["payment"]): string {
  if (payment.dueKind === "date" && payment.dueDate) return formatDate(payment.dueDate);
  return `${payment.dueDays ?? 7} Tage`;
}

export function buildRentalContractPdf(rental: Rental): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const company = getCompanyData();
  const vehicleRecord = rental.vehicle.vehicleId ? getVehicle(rental.vehicle.vehicleId)?.vehicle : null;
  const rentalKind = rental.vehicle.kind ?? vehicleRecord?.kind ?? "vehicle";
  const isEquipmentRental = rentalKind === "equipment";
  const vehicle = {
    category: rental.vehicle.category ?? vehicleRecord?.category ?? "",
    type: rental.vehicle.type ?? (compact([vehicleRecord?.brand, vehicleRecord?.model]) || rental.vehicle.label),
    vin: rental.vehicle.vin ?? vehicleRecord?.vin ?? "",
    registrationDocumentNumber: rental.vehicle.registrationDocumentNumber ?? vehicleRecord?.registrationDocumentNumber ?? "",
    licensePlate: rental.vehicle.licensePlate ?? vehicleRecord?.licensePlate ?? "",
  };
  const driver2 = rental.additionalDrivers[0] ?? { name: "", email: "" };
  const addons = rental.addons.length > 0 ? rental.addons : [{ id: "base", name: isEquipmentRental ? "Miete Gerät" : "Miete Fahrzeug", hint: "Vereinbarte Nutzung", qty: 1, unitPriceEur: rental.payment.totalEur, vatRate: 19 }];
  const totalNet = addons.reduce((sum, addon) => sum + addonNet(addon), 0);
  const totalVat = addons.reduce((sum, addon) => sum + addonVat(addon), 0);
  const totalGross = totalNet + totalVat;

  const page = { left: 14, top: 14, right: 196, bottom: 282, width: 182 };
  const ink: [number, number, number] = [15, 23, 42];
  const navy: [number, number, number] = [21, 52, 89];
  const border: [number, number, number] = [203, 213, 225];
  const soft: [number, number, number] = [248, 250, 252];
  const panel: [number, number, number] = [241, 245, 249];

  function paintPage() {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, "F");
  }

  function setText(color: [number, number, number] = ink) {
    doc.setTextColor(...color);
  }

  function header(pageNo: number, title = "MIETVERTRAG") {
    paintPage();
    setText(navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(company.company || "Transit on Tour", page.left, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${title} · ${rental.id} · Seite ${pageNo}`, page.right, 16, { align: "right" });
    doc.setDrawColor(...border);
    doc.setLineWidth(0.25);
    doc.line(page.left, 18, page.right, 18);
    setText();
  }

  function section(title: string, y: number): number {
    doc.setFillColor(...navy);
    doc.roundedRect(page.left, y, page.width, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), page.left + 4, y + 5.2);
    setText();
    return y + 12;
  }

  function labelValue(label: string, value: string, x: number, y: number, w: number, h = 14) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...border);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(label, x + 3, y + 4.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText();
    const lines = doc.splitTextToSize(value || " ", w - 6);
    doc.text(lines.slice(0, Math.max(1, Math.floor((h - 7) / 3.8))), x + 3, y + 9.5);
  }

  function infoCard(title: string, items: Array<[string, string]>, x: number, y: number, w: number, minH = 0): number {
    const rowH = 8.5;
    const h = Math.max(minH, 12 + items.length * rowH);
    doc.setFillColor(...soft);
    doc.setDrawColor(...border);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(navy);
    doc.text(title, x + 4, y + 6);
    items.forEach(([label, value], index) => {
      const rowY = y + 11 + index * rowH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x + 4, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.7);
      setText();
      const lines = doc.splitTextToSize(value || "—", w - 45);
      doc.text(lines.slice(0, 1), x + 39, rowY);
    });
    return h;
  }

  function noteBox(title: string, body: string, x: number, y: number, w: number, h: number) {
    doc.setFillColor(...panel);
    doc.setDrawColor(...border);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(navy);
    doc.text(title, x + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setText();
    doc.text(doc.splitTextToSize(body, w - 8), x + 4, y + 11);
  }

  function tableHeader(labels: string[], widths: number[], x: number, y: number) {
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    doc.setFillColor(...navy);
    doc.setDrawColor(...navy);
    doc.rect(x, y, totalWidth, 8, "F");

    let cx = x;
    labels.forEach((label, index) => {
      doc.setDrawColor(255, 255, 255);
      if (index > 0) doc.line(cx, y, cx, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text(label, cx + 2, y + 5.2);
      cx += widths[index];
    });

    doc.setDrawColor(...navy);
    doc.rect(x, y, totalWidth, 8, "S");
    setText();
  }

  function tableRow(values: string[], widths: number[], x: number, y: number, h: number) {
    let cx = x;
    values.forEach((value, index) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...border);
      doc.rect(cx, y, widths[index], h, "FD");
      doc.setFont("helvetica", index === 0 ? "bold" : "normal");
      doc.setFontSize(6.6);
      setText(index === 0 ? navy : ink);
      const lines = doc.splitTextToSize(value || " ", widths[index] - 4);
      doc.text(lines.slice(0, Math.max(1, Math.floor((h - 3) / 3.2))), cx + 2, y + 4.8);
      cx += widths[index];
    });
  }

  function signatureRow(y: number) {
    const w = 49;
    const xs = [page.left + 2, page.left + 66, page.left + 130];
    ["Vermieter", "1. Mieter", "2. Mieter"].forEach((label, index) => {
      doc.setDrawColor(...navy);
      doc.line(xs[index], y, xs[index] + w, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText();
      doc.text(label, xs[index], y + 5);
      doc.text("Datum:", xs[index], y + 11);
    });
  }

  header(1);
  let y = 25;
  y = section("Vertragspartner", y);
  const half = (page.width - 6) / 2;
  infoCard("Vermieter, Halter und Eigentümer", [
    ["Firma", company.company],
    ["Name", company.name],
    ["Anschrift", company.address],
    ["Telefon", company.phone],
    ["Telefax", company.fax],
    ["E-Mail", company.email],
    ["Bemerkungen", company.notes],
  ], page.left, y, half, 73);
  infoCard(
    isEquipmentRental ? "Gerätedaten" : "Fahrzeugdaten",
    isEquipmentRental
      ? [
          ["Geräteart", vehicle.category],
          ["Gerätetyp", vehicle.type],
          ["Interne Referenz", rental.vehicle.label],
        ]
      : [
          ["Fahrzeugart", vehicle.category],
          ["Fahrzeugtyp", vehicle.type],
          ["FIN", vehicle.vin],
          ["Fahrzeugscheinnummer", vehicle.registrationDocumentNumber],
          ["Kennzeichen", vehicle.licensePlate],
        ],
    page.left + half + 6,
    y,
    half,
    73,
  );
  y += 81;

  y = section("Zustand bei Übergabe", y);
  noteBox("Zustand", isEquipmentRental
    ? "1. Das Gerät wird dem Mieter in funktionsfähigem, gereinigtem und vollständigem Zustand mit vereinbartem Zubehör übergeben.\n2. Der Mieter prüft das Gerät bei Übergabe auf erkennbare Mängel, Vollständigkeit und Eignung für den vorgesehenen Zweck.\n3. Der genaue Zustand ergibt sich aus dem Übergabeprotokoll. Dieses Protokoll ist Bestandteil dieses Mietvertrags."
    : "1. Das Fahrzeug wird dem Mieter in technisch einwandfreiem Zustand übergeben. Optische Beeinträchtigungen wie kleine Lackschäden, kleine Dellen, Kratzer oder Parkrempler stellen keine Fahrzeugmängel dar, sofern die Gebrauchsfähigkeit dadurch nicht beeinträchtigt ist.\n2. Das Fahrzeug wird innen und außen gereinigt übergeben.\n3. Der genaue Zustand ergibt sich aus dem gemeinsam zu erstellenden Übergabeprotokoll. Dieses Protokoll ist Bestandteil dieses Mietvertrags.", page.left, y, page.width, 32);
  y += 40;

  y = section(isEquipmentRental ? "Mieter und berechtigte Nutzer" : "Mieter und berechtigte Fahrer", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(isEquipmentRental ? "Nur die nachstehend genannten Mieter/Nutzer sind zur Nutzung des Geräts berechtigt." : "Nur die nachstehend genannten Mieter/Fahrer sind zum Führen des Fahrzeugs berechtigt.", page.left, y);
  y += 5;
  const driverFields: Array<[string, (party: RentalParty) => string]> = [
    ["Name, Vorname", (party) => party.name],
    ["Adresse", partyAddress],
    ["Telefon mobil", (party) => safeText(party.phone)],
    ["Geburtstag", (party) => formatDate(party.birthDate)],
    ["Personalausweisnummer", (party) => safeText(party.identityCardNumber)],
    ["Führerscheinnummer", (party) => safeText(party.driverLicenseNumber)],
  ];
  infoCard(isEquipmentRental ? "1. Mieter / Nutzer" : "1. Mieter / Fahrer", driverFields.map(([label, getter]) => [label, getter(rental.tenant)]), page.left, y, half, 65);
  infoCard(isEquipmentRental ? "2. Mieter / Nutzer" : "2. Mieter / Fahrer", driverFields.map(([label, getter]) => [label, getter(driver2)]), page.left + half + 6, y, half, 65);

  doc.addPage();
  header(2);
  y = 25;
  y = section("Miete und Servicekosten", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(doc.splitTextToSize("Für die Nutzung des Fahrzeugs während der vereinbarten Mietdauer zahlt der Mieter die folgende Miete, Nutzungsgebühren und Kosten.", page.width), page.left, y);
  y += 8;
  const widths = [42, 44, 15, 22, 22, 18, 19];
  tableHeader(["Leistung", "Hinweise", "Menge", "Preis", "Netto", "MwSt", "Brutto"], widths, page.left, y);
  y += 8;
  addons.slice(0, 5).forEach((addon) => {
    const net = addonNet(addon);
    const vat = addonVat(addon);
    tableRow([addon.name, addon.hint ?? "", String(addon.qty), money(addon.unitPriceEur ?? 0), money(net), money(vat), money(net + vat)], widths, page.left, y, 13);
    y += 13;
  });
  if (addons.length > 5) {
    tableRow(["Weitere Leistungen", `${addons.length - 5} weitere Position(en) sind in der Gesamtsumme enthalten.`, "", "", "", "", ""], widths, page.left, y, 10);
    y += 10;
  }
  doc.setFillColor(...soft);
  doc.setDrawColor(...border);
  doc.roundedRect(page.left, y + 5, page.width, 22, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setText(navy);
  doc.text("Gesamtbetrag", page.left + 4, y + 13);
  doc.setFontSize(12);
  doc.text(money(totalGross || rental.payment.totalEur), page.right - 4, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Netto ${money(totalNet)} · MwSt ${money(totalVat)}`, page.right - 4, y + 20, { align: "right" });
  y += 34;

  y = section("Zahlung", y);
  const quarter = (page.width - 15) / 4;
  labelValue("Abschlagszahlung brutto", money(rental.payment.paidEur), page.left, y, quarter, 16);
  labelValue("Zahlbar bei Rückgabe", "Bar oder EC-Karte", page.left + quarter + 5, y, quarter, 16);
  labelValue("Zahlbar bis", paymentDueLabel(rental.payment), page.left + 2 * (quarter + 5), y, quarter, 16);
  labelValue("Zahlungsstatus", rental.payment.status, page.left + 3 * (quarter + 5), y, quarter, 16);
  y += 21;
  noteBox("Bankverbindung", `IBAN ${company.iban || "____________________________"}     BIC ${company.bic || "________________"}`, page.left, y, page.width, 15);
  y += 24;

  y = section("Termine und Sicherheiten", y);
  const startDate = new Date(rental.startAt);
  const endDate = new Date(rental.endAt);
  infoCard("Vereinbarte Termine", [
    ["Fahrzeugübernahme", `${formatDate(rental.startAt)} · ${startDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`],
    ["Fahrzeugrückgabe", `${formatDate(rental.endAt)} · ${endDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`],
  ], page.left, y, half, 36);
  infoCard("Mietsicherheit", [
    ["Kaution", money(rental.payment.depositEur ?? 0)],
    ["Fälligkeit", "spätestens bei Fahrzeugübernahme"],
    ["Übergabe", "nach Kaution und Abschlagszahlung"],
  ], page.left + half + 6, y, half, 36);

  doc.addPage();
  header(3);
  y = 25;
  y = section("Besondere Vereinbarungen und Rückgabe", y);
  const clauseCards: Array<[string, string]> = [
    ["Zustellung / Abholung", "Kosten entstehen nur, soweit Zustellung oder Abholung vereinbart ist. Holt der Vermieter das Fahrzeug wegen nicht vereinbarungsgemäßer Rückgabe ab, trägt der Mieter die hierdurch entstehenden Kosten, sofern kein technischer Defekt entgegensteht."],
    ["Kraftstoff / Öl", "Das Fahrzeug wird vollgetankt übergeben und vollgetankt zurückgegeben. Fehlmengen und notwendige Betriebsstoffe kann der Vermieter dem Mieter berechnen."],
    ["Servicepauschale / Nutzgas", "Eine befüllte Gasflasche wird bereitgestellt. Reicht der Vorrat nicht aus, sorgt der Mieter auf eigene Kosten für Befüllung oder Austausch."],
    ["Endreinigung", "Vereinbarte Reinigungskosten sind vom Mieter zu zahlen, sofern das Fahrzeug nicht gereinigt zurückgegeben wird oder die Reinigung durch den Vermieter vereinbart ist."],
    ["Haftung bei Unfällen", "Mehrere Mieter haften als Gesamtschuldner. Ergänzend gelten die allgemeinen Mietbedingungen und die Versicherungsregelungen dieses Vertrages."],
    ["Selbstbeteiligung", `Vollkasko/Teilkasko: Selbstbeteiligung ${money(rental.insurance.deductibleEur ?? 0)} pro Schadensfall, soweit vertraglich und versicherungsrechtlich vereinbart.`],
  ];
  clauseCards.forEach(([title, text], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    noteBox(title, text, page.left + col * (half + 6), y + row * 38, half, 30);
  });
  y += 122;
  noteBox("Bestandteile des Vertrags", "Die allgemeinen Mietbedingungen, das Übergabeprotokoll und alle vereinbarten Anlagen sind Bestandteil dieses Mietvertrags.", page.left, y, page.width, 18);
  y += 37;
  signatureRow(y);

  function termsHeader(pageNo: number) {
    paintPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    setText(navy);
    doc.text("ALLGEMEINE MIETBEDINGUNGEN", page.right, 18, { align: "right" });
    doc.setDrawColor(...border);
    doc.line(page.left, 22, page.right, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${company.company || "Transit on Tour"} · Allgemeine Mietbedingungen für Wohn- und Reisemobile`, page.left, 286);
    doc.text(String(pageNo), page.right, 286, { align: "right" });
  }

  function addTermsDocument(rawText: string) {
    const gap = 10;
    const colWidth = (page.width - gap) / 2;
    const top = 31;
    const bottom = 274;
    const fontSize = 5.15;
    const lineHeight = 2.35;
    let pageNo = 0;
    let col: 0 | 1 = 0;
    let tx = page.left;
    let ty = top;

    const addPage = () => {
      pageNo += 1;
      doc.addPage();
      termsHeader(pageNo);
      col = 0;
      tx = page.left;
      ty = top;
    };

    const nextColumn = () => {
      if (col === 0) {
        col = 1;
        tx = page.left + colWidth + gap;
        ty = top;
      } else {
        addPage();
      }
    };

    const addParagraph = (paragraph: string) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return;
      const isHeading = /^(\d+\.|\d+\.\d+\.?|Mehrere Mieter|Wir haben)/.test(trimmed);
      doc.setFont("helvetica", isHeading ? "bold" : "normal");
      doc.setFontSize(isHeading ? 5.35 : fontSize);
      setText(isHeading ? navy : ink);
      const lines = doc.splitTextToSize(trimmed, colWidth);
      const needed = lines.length * lineHeight + (isHeading ? 1.8 : 1.2);
      if (ty + needed > bottom) nextColumn();
      doc.text(lines, tx, ty);
      ty += needed;
    };

    addPage();
    rawText
      .replace(/\r/g, "")
      .split(/\n+/)
      .forEach(addParagraph);

    if (pageNo > 0) {
      doc.setDrawColor(...navy);
      doc.line(page.left + 105, 262, page.right, 262);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText();
      doc.text("Unterschrift + Datum Mieter", page.left + 105, 267);
    }
  }

  const vehicleTermsText = `Mehrere Mieter bilden eine Mietergemeinschaft. Jeder Mieter hat identische Rechte und Pflichten.
1. Zustande kommen des verbindlichen Mietvertrages:
1.1. Absprachen oder Erklärungen, die nur mündlich, ohne schriftliche Bestätigung, per E-Mail oder SMS erfolgt sind, sind in jedem Fall ohne rechtliche Wirkung. Der Abschluss eines Mietvertrages über das Fahrzeug kann nur schriftlich, in der Regel durch beiderseitige Unterschrift dieses Vertrages erfolgen.
1.2. Der Mietvertrag kommt zwischen den Vertragsparteien zustande. Eine Übertragung oder Abtretung der Rechte aus dem Mietvertrag durch den Mieter auf andere dritte Personen ist nur mit ausdrücklicher schriftlicher vorheriger Zustimmung des Vermieters möglich.
1.3. Das Fahrzeug darf ohne vorherige schriftliche Zustimmung des Vermieters nicht dritten Personen zum Gebrauch überlassen werden, es darf nur von den im Mietvertrag genannten Fahrern / Mietern gefahren werden.
2. Kündigung, Stornierungen:
2.1. Ist ein Termin für die Rückgabe des Fahrzeugs nicht bestimmt (unbefristetes Mietverhältnis) so kann das Mietverhältnis von beiden Parteien unter Einhaltung der gesetzlichen Kündigungsfrist (§ 580 a BGB) gekündigt werden. Wenn die Miete nach Tagen bemessen ist, kann die Kündigung danach gemäß § 580 a Abs 3 BGB an jedem Tag zum Ablauf des folgenden Tages ausgesprochen werden.
2.2. Bei befristet abgeschlossenen Mietverträgen ist die vereinbarte Mietdauer (Termine) für beide Parteien verbindlich, sie kann nur im gegenseitigen Einvernehmen verlängert oder verkürzt werden.
2.2.1 Eine Kündigung oder Stornierung des Vertrages ist, außer bei Vorliegen eines wichtigen Grundes im Sinne von § 543 BGB beiderseitig ausgeschlossen.
2.2.2. Der Mieter ist verpflichtet, das Fahrzeug spätestens zum angegebenen Zeitpunkt unter Berücksichtigung der üblichen Zeittoleranzen an den Vermieter zurückzugeben. Sofern der Mieter das Fahrzeug selbst beim Vermieter abgeholt hat, ist er verpflichtet, das Fahrzeug zum Vermieter zurückzubringen. Sofern Abholung durch den Vermieter vereinbart ist, ist das Fahrzeug zum an-gegebenen Zeitpunkt zur Abholung am vereinbarten Ort vom Mieter bereitzustellen.
2.2.3. Das Mietverhältnis verlängert sich nicht automatisch, wenn der Mieter das Fahrzeug nicht termingerecht zurückbringt und dem Vermieter übergibt. Im Falle einer verspäteten Rückgabe kann der Vermieter eine Entschädigung gemäß § 546 BGB in Höhe des vereinbarten Mietpreises vom Mieter verlangen.
3. Nutzung und Nutzungsverbote des Mietfahrzeugs
3.1. Die Benutzung des Fahrzeugs ist ausschließlich innerhalb Europäischen Union (EU) gestattet. Außerhalb dieser Grenzen besteht in der Kraftfahrversicherung (insbesondere Vollkaskoschutz) kein Versicherungsschutz. Will der Mieter das Fahrzeug in anderen Ländern und Gebieten benutzen, so ist hierzu eine schriftliche vorherige Zustimmung des Vermieters erforderlich.
3.2. Vom Vermieter generell nicht gestattet ist die Nutzung des Fahrzeugs zu folgenden Zwecken:
3.2.1. Teilnahme an Wettrennen, Fahrertraining, Geländefahrten und ähnlichen Nutzungen.
3.2.2. Beförderung von leicht entzündlichen, giftigen oder sonst gefährlichen Stoffen.
3.2.3. Jegliche Verwendung im Zusammenhang mit der Begehung von Straftaten oder Zoll- und Steuervergehen, insbesondere dem Transport von Stoffen, die unter das Betäubungsmittelgesetz fallen.
3.3. Die Benutzung des Fahrzeugs ist nicht gestattet, sofern der Mieter oder Fahrer nicht im Besitz einer gültigen in Deutschland anerkannten Fahrerlaubnis ist, ein Fahrverbot besteht oder die Fahrerlaubnis vorläufig entzogen ist.
3.4. Die Benutzung des Fahrzeugs ist nicht gestattet, sofern der Fahrer infolge Genusses alkoholischer Getränke oder anderer berauschender Mittel nicht in der Lage ist, das Fahrzeug sicher zu führen (fahruntüchtiger Fahrer).
3.5. Hält sich der Mieter nicht an die in den vorstehenden Abschnitten 3.1 bis 3.4 vereinbarten Nutzungsverbote, liegt eine Pflichtverletzung des Mieters beim Gebrauch des Fahrzeugs vor.
4. Kleinreparaturen, Kraftstoffe, Öle
4.1. Der während der Mietdauer verbrauchte Kraftstoff, Motoröl und andere Hilfs- und Betriebsstoffe sind vom Mieter auf eigene Kosten zu beschaffen.
4.2. Kleine Instandsetzungen wie zum Beispiel der Austausch von Glühbirnen kann der Mieter selbst vornehmen oder bis zur Höhe von 150 € je Einzelfall ohne vorherige Absprache mit dem Vermieter durch eine Fachwerkstatt ausführen lassen. Der Vermieter erstattet dem Mieter die Kosten gegen Vorlage eines Rechnungsbeleges und Vorlage des ausgetauschten beschädigten Teiles. Keine Kostenerstattung ohne Rechnungsbeleg. Eigenleistungen des Mieters werden nicht vergütet.
5. Fürsorgepflichten des Mieters und Haftung für Schäden
5.1. Der Mieter ist verpflichtet, das Fahrzeug vor der Übernahme genauestens zu überprüfen. Falls Beschädigungen oder Mängel festgestellt werden, zeigt der Mieter diese dem Vermieter in Textform (z. B. per E-Mail) an.
5.2. Der Mieter ist verpflichtet, das Fahrzeug ab dem Zeitpunkt der Übergabe so zu behandeln und zu benutzen, wie es ein verständiger auf die Werterhaltung bedachter Eigentümer tun würde. Insbesondere ist der Mieter auf seine Kosten verpflichtet:
- Das Fahrzeug bei extremen Wetterbedingungen (z. B. Hagel, Sturm, Überschwemmung, starker Schneefall) entsprechend gegen Beschädigungen zu sichern;
- Das Fahrzeug bei Besorgnis der Beschädigung durch Vandalismus auf eigene Kosten entsprechend zu sichern, zum Beispiel durch Abstellen in einer gesicherten Garage;
- Signalisieren die Kontrollleuchten im Fahrzeug (z. B. für Ölstand/Öldruck, Wasser, Temperatur, Bremsenverschleiß oder Sonstiges) ein Problem, so ist der Mieter verpflichtet, sich entsprechend den in der Betriebsanleitung des Herstellers für das Fahrzeug dafür vorgegebenen Hinweisen zu verhalten.
- Den Ölstand des Motors und der Nebenaggregate sowie den Reifendruck vor jedem Antritt einer längeren Fahrt zu prüfen und ggf. entsprechend den Vorgaben des Herstellers richtigzustellen.
5.3. Der Mieter hat im Rahmen seiner gegenüber dem Vermieter bestehenden allgemeinen Fürsorge- und Sorgfaltspflichten für das gemietete Fahrzeug auch das Verschulden von seinen Beifahrern und Mitreisenden zu vertreten. Beifahrer und Mitreisender ist jeder, der sich mit Wissen und im Einverständnis mit dem Mieter im oder am Fahrzeug befindet.
5.4. Der Mieter haftet für alle Vermögensschäden des Vermieters, die aufgrund einer schuldhaften Verletzung seiner allgemeinen und nach diesem Mietvertrag bestehenden Fürsorgepflichten entstehen, im gesetzlichen Umfang. Der Vermieter ist bei Versicherungsfällen verpflichtet, zunächst die Fahrzeugvoll- oder Fahrzeugteilversicherung (Voll- oder Teilkaskoversicherung) in Anspruch zu nehmen. Leistungen der Versicherung mindern die Schadensersatzpflicht des Mieters.
5.5. Nimmt der Vermieter die Reparatur eines Schadens selbst oder durch eigene Mitarbeiter vor, so wird hiermit ein Stundensatz je geleistete Arbeitsstunde und Person in Höhe von 25,00 € als angemessene Ersatzleistung vereinbart.
6. Nicht unfallbedingte Fahrzeugschäden u. technische Defekte:
6.1. Der Mieter haftet für alle Schäden am Fahrzeug, die auf Bedienungsfehler während der Mietzeit zurückzuführen sind, im gesetzlichen Umfang.
6.2. Treten nach der Übergabe des Fahrzeugs an den Mieter nicht unfallbedingte technische Defekte am Fahrzeug auf, die die Gebrauchstauglichkeit wesentlich einschränken, sind beide Parteien berechtigt, den Vertrag mit sofortiger Wirkung fristlos zu kündigen, sofern es nicht möglich ist, den Defekt durch eine Reparatur kurzfristig zu beheben.
6.3. Für die Dauer der durch einen technischen Defekt bedingten Gebrauchsbeeinträchtigung ist der Tagesmietpreis um 1/24 je angefangene Stunde zu mindern. Der Mieter verzichtet auch im Falle einer Kündigung auf alle weitergehenden Ansprüche, es sei denn, für den technischen Defekt ist ein grob fahrlässiges oder vorsätzliches Verhalten des Vermieters ursächlich.
6.4. Endet der Vertrag aufgrund einer fristlosen Kündigung gemäß Abschnitt 6.2., so bleibt der Mieter zur Zahlung der vereinbarten Miete bis zum Zeitpunkt der Kündigung verpflichtet. Auf alle etwa bestehenden weitergehenden Ansprüche, insbesondere Schadensersatz einschließlich Ersatz von Mangelfolgeschäden verzichten die Parteien gegenseitig. Dieser Verzicht gilt nicht, wenn der Defekt vom Vermieter grob fahrlässig oder vorsätzlich zu vertreten ist.
6.5. Abschnitte 6.2. bis 6.4. gelten nicht, sofern der Mieter gemäß Abschnitt 6.1. wegen eines Bedienungsfehlers für den Schaden haftet, das heißt der Defekt auf einen Bedienungsfehler des Mieters zurückzuführen ist.
6.6. Der Mieter hat dem Vermieter einen etwaigen technischen Defekt des Fahrzeugs unverzüglich anzuzeigen. Unterbleibt eine Anzeige, hat der Mieter dem Vermieter den daraus entstehenden Schaden zu ersetzen.
7. Verkehrsunfälle, Haftungsbeschränkung des Mieters:
7.1. Der Vermieter haftet nicht für Gegenstände, die vom Mieter in das Fahrzeug eingebracht wurden, wie bspw. Reisegepäck, Kameras oder Fahrräder. Bei Verkehrsunfällen ist der Vermieter verpflichtet, dem Mieter alle zur Durchsetzung seiner eigenen Schadensersatz- oder Schmerzensgeldansprüche gegenüber Unfallgegnern erforderlichen Daten in Textform mitzuteilen, dies gilt auch für entsprechende Ansprüche seiner Beifahrer und Mitreisenden.
7.2. Im Falle eines Verkehrsunfalles, sofern es sich nicht nur um einen Bagatellunfall handelt, durch den die Gebrauchstauglichkeit des Fahrzeugs nicht wesentlich eingeschränkt ist, sind beide Parteien berechtigt, den Vertrag mit sofortiger Wirkung fristlos zu kündigen. Der Mieter bleibt auch in diesem Fall zur Zahlung der vereinbarten Miete bis zum Zeitpunkt der Kündigung verpflichtet.
7.3. Bei Verkehrsunfällen (auch ohne Fremdbeteiligung), Brand, Wildschaden und sonstigen Schäden hat der Mieter unverzüglich die örtliche Polizei hinzuzuziehen und für die Aufnahme des Unfall- bzw. Schadenhergangs zu sorgen, den Vermieter zu benachrichtigen, dem Vermieter einen ausführlichen Unfallbericht mit beigefügter Unfallskizze zukommen zu lassen, bei Unfällen mit Fremdbeteiligung sind die Kennzeichen der beteiligten Fahrzeuge und deren Haftpflichtversicherungen und Namen und Anschriften der Fahrer und der Zeugen festzuhalten.
7.4. Bei allen Verkehrsunfällen haftet der Mieter – sofern ihm keine Obliegenheitsverletzung nach Abschnitt 7.3. oder 7.5. vorzuwerfen ist - für sämtliche Kosten, die durch eine fachgerechte Reparatur des Fahrzeugs (oder bei Totalschäden für die Kosten der Wiederbeschaffung) dem Vermieter entstehen, für andere Schäden haftet der Mieter nicht. Keine Haftung des Mieters besteht auch insoweit als der Vermieter Schadensersatz von Unfallbeteiligten oder deren Versicherungen oder der für das Fahrzeug bestehenden Fahrzeugvoll- oder Fahrzeugteilversicherung (Voll- oder Teilkaskoversicherung) erhält. In Höhe der mit der Versicherung vereinbarten Selbstbeteiligung ist ein Schaden aber regelmäßig durch Versicherungsleistungen nicht gedeckt und dann vom Mieter zu begleichen.
7.5. Führt das Verhalten des Mieters nach einem Verkehrsunfall (beispielsweise Unfallflucht), oder das Verhalten des Mieters, welches für den Verkehrsunfall ursächlich war, ein Verstoß gegen die Nutzungsverbote nach Abschnitt 3 oder eine sonstige Obliegenheitsverletzung des Mieters dazu, dass sich die für das Fahrzeug bestehende Fahrzeugvoll- oder Fahrzeugteilversicherung ganz oder teilweise auf Leistungsfreiheit nach den Vorschriften des Versicherungsvertragsgesetzes (VVG) gegenüber dem Vermieter berufen kann, haftet der Mieter für alle Vermögensschäden des Vermieters im gesetzlichen Umfang, soweit diese nicht durch eine Versicherungsleistung gedeckt sind. Die Vollkaskoversicherung kann sich beispielsweise auf Leistungsfreiheit berufen, wenn der Mieter das Fahrzeug unter Einfluss von alkoholischen oder sonstigen berauschenden Mitteln führt oder Unfallflucht begeht.
7.6. Mit Wirkung ab dem Zeitpunkt der Befriedigung sämtlicher Schadensersatzansprüche des Vermieters durch den Mieter tritt der Vermieter alle ihm möglicherweise gegenüber dritten Personen zustehenden Schadensersatzansprüchen zum Zwecke der Geltendmachung an den Mieter ab.
8. Fürsorgepflicht und Haftung des Vermieters:
8.1. Der Vermieter ist verpflichtet, die Regulierung von allen Fahrzeugschäden, die einen Versicherungsfall darstellen, bei den betreffenden Fahrzeugversicherungen zu verlangen, soweit dies nicht unwirtschaftlich oder offensichtlich aussichtslos erscheint.
8.2. Der Vermieter kann die Leistung verweigern, soweit diese für den Vermieter unmöglich ist. Dies ist insbesondere dann der Fall, wenn das Fahrzeug vor Beginn der Mietzeit durch einen Verkehrsunfall oder infolge höherer Gewalt bei Naturereignissen so beschädigt wurde, dass es nicht mehr gebrauchstauglich ist, und eine Reparatur oder Ersatzbeschaffung vor Beginn der Mietzeit nicht mehr möglich war oder einen Aufwand erfordert hätte, der unter Berücksichtigung der Mietdauer und des vereinbarten Gesamtmietpreises und der Gebote von Treu und Glauben in einem groben Missverhältnis zum Leistungsinteresse des Mieters steht.
8.3. Der Vermieter kann die Leistung auch verweigern, wenn er keinen Versicherungsschutz durch eine Fahrzeugvollversicherung zu wirtschaftlich zumutbaren Bedingungen erreichen kann.
8.4. Im Fall einer Nichtleistung gemäß Abschnitt 8.1. sind Schadensersatzansprüche gegenüber dem Vermieter - gleich aus welchem Rechtsgrund - ausgeschlossen, es sei denn, dem Vermieter fällt grobe Fahrlässigkeit oder Vorsatz zur Last. Der Vermieter ist jedoch verpflichtet, alle erhaltenen Zahlungen an den Mieter umgehend zurückzuzahlen.
8.5. Der Vermieter übernimmt keine Gewähr für die Eignung des Fahrzeugs zu dem vom Mieter vorgesehenen Zweck.
8.6. Die verschuldensunabhängige Haftung des Vermieters ist ausgeschlossen. Der Vermieter haftet nur für Vorsatz und grobe Fahrlässigkeit, für leichte Fahrlässigkeit nur bei der Verletzung wesentlicher Vertragspflichten. Diese Haftungsbeschränkungen gelten nicht bei der Verletzung des Körpers, des Lebens oder der Gesundheit und nicht in dem Fall des arglistigen Verschweigens von Mängeln des Fahrzeugs. Diese Haftungsbeschränkung gilt entsprechend für alle nach Vertragsschluss oder nach Überlassung des Fahrzeugs entstandenen Mängel des Fahrzeugs oder sonstige Schäden.
9. Verlust von Schlüsseln oder Fahrzeugpapieren:
9.1. Sofern der Mieter den Verlust von Fahrzeugpapieren oder eines Schlüssels zu vertreten hat, ist er verpflichtet, die Kosten der Ersatzbeschaffung zu tragen sowie den damit verbundenen Zeit- und sonstigen Aufwand des Vermieters zu entschädigen.
9.2. Der Zeitaufwand des Vermieters ist dabei in Höhe von 21 € je Stunde zu entschädigen, es bleibt dem Mieter vorbehalten, den Aufwand des Vermieters durch Eigenleistungen zu minimieren.
10. Technische und optische Veränderungen:
10.1. Der Mieter darf an dem Fahrzeug keine technischen Veränderungen vornehmen.
10.2. Der Mieter ist nicht dazu befugt, das Fahrzeug optisch zu verändern, dazu zählen insbesondere Lackierungen, Aufkleber oder Klebefolien.
11. Rechtswahl, Gerichtsstand, Sonstiges
11.1 Die Einhaltung der Straßenverkehrsgesetze beim Betrieb des Fahrzeugs und der Teilnahme am öffentlichen Straßenverkehr im In- und Ausland ist ausschließlich Sache des Mieters.
11.2 Die Parteien vereinbaren die Geltung von deutschem Recht für ihre gegenseitigen rechtlichen Beziehungen aus diesem Mietvertrag.
11.3. Für den Fall, dass der Mieter keinen allgemeinen Gerichtsstand in Deutschland hat, vereinbaren die Parteien, die Zuständigkeit deutscher Gerichte für die Entscheidung über Rechtsstreitigkeiten die aufgrund dieses Mietvertrages bzw. Mietverhältnisses entstehen könnten. Zuständig soll dabei das Gericht sein, bei dem der Vermieter seinen allgemeinen Gerichtsstand hat, sofern nicht das Amtsgericht ausschließlich zuständig ist, in dem sich das vermietete Mietobjekt befindet.
11.4. Wenn und soweit eine der Bestimmungen dieses Vertrages gegen eine zwingende gesetzliche Vorschrift verstößt, tritt an ihre Stelle die entsprechende gesetzliche Regelung.
Wir haben die allgemeinen Mietbedingungen zur Kenntnis genommen.`;

  const equipmentTermsText = `Mehrere Mieter bilden eine Mietergemeinschaft. Jeder Mieter hat identische Rechte und Pflichten.
1. Zustandekommen des Mietvertrages:
1.1. Der Mietvertrag über das im Vertrag bezeichnete Gerät, Zubehör und ggf. Verbrauchsmaterial kommt durch Unterzeichnung, digitale Signatur oder tatsächliche Übernahme des Mietgegenstandes zustande.
1.2. Abweichende Nebenabreden bedürfen der Textform. Der Mieter ist nicht berechtigt, Rechte aus diesem Vertrag ohne vorherige Zustimmung des Vermieters auf Dritte zu übertragen.
1.3. Das Gerät bleibt Eigentum des Vermieters. Verkauf, Verpfändung, Sicherungsübereignung, Untervermietung oder Weitergabe an Dritte sind ohne ausdrückliche Zustimmung des Vermieters untersagt.
2. Mietzeit, Rückgabe und Abrechnung:
2.1. Die Mietzeit beginnt mit Übergabe oder Bereitstellung des Geräts und endet mit vollständiger Rückgabe beim Vermieter, sofern nicht schriftlich etwas anderes vereinbart wurde.
2.2. Eine verspätete Rückgabe berechtigt den Vermieter, die vereinbarte Miete für die Dauer der Vorenthaltung weiter zu berechnen. Weitergehende Schäden bleiben vorbehalten.
2.3. Zubehör, Akkus, Ladegeräte, Schlüssel, Anleitungen, Transportboxen und sonstige mitvermietete Teile sind vollständig und in ordnungsgemäßem Zustand zurückzugeben.
3. Übergabe, Prüfung und Mängelanzeige:
3.1. Der Mieter prüft das Gerät bei Übergabe auf offensichtliche Mängel, Vollständigkeit und Eignung für den vorgesehenen Einsatz.
3.2. Offensichtliche Mängel, Fehlteile oder Transportschäden sind unverzüglich vor Inbetriebnahme anzuzeigen. Unterbleibt die Anzeige, gilt der Mietgegenstand als äußerlich ordnungsgemäß übernommen, soweit der Mangel erkennbar war.
3.3. Das Übergabeprotokoll, Fotos und die Schadensliste sind Bestandteil des Mietvertrages.
4. Bestimmungsgemäße Nutzung und Sicherheit:
4.1. Das Gerät darf nur bestimmungsgemäß, sorgfältig und entsprechend Bedienungsanleitung, Sicherheitsvorschriften und Herstellerhinweisen verwendet werden.
4.2. Der Mieter stellt sicher, dass nur geeignete und eingewiesene Personen das Gerät nutzen. Erforderliche Schutzkleidung, Genehmigungen, Prüfungen oder Befähigungen sind Sache des Mieters.
4.3. Einsatz unter gefährlichen, feuchten, explosionsgefährdeten, überlastenden oder sonst ungeeigneten Bedingungen ist untersagt, soweit das Gerät hierfür nicht ausdrücklich freigegeben ist.
5. Pflege, Reinigung und Betriebsstoffe:
5.1. Der Mieter hält das Gerät während der Mietzeit in ordnungsgemäßem Zustand, schützt es vor Diebstahl, Witterung, unsachgemäßem Zugriff und Überlastung.
5.2. Verbrauchsstoffe, Betriebsstoffe, Verschleißteile und fachgerechte Zwischenreinigung trägt der Mieter, sofern nicht ausdrücklich anders vereinbart.
5.3. Das Gerät ist gereinigt zurückzugeben. Erforderliche Reinigungs-, Trocknungs-, Entsorgungs- oder Wiederherstellungskosten kann der Vermieter berechnen.
6. Schäden, Verlust und Diebstahl:
6.1. Schäden, Funktionsstörungen, Verlust oder Diebstahl sind dem Vermieter unverzüglich mitzuteilen. Bei Diebstahl oder sonstigem strafbaren Verhalten ist zusätzlich unverzüglich Anzeige bei der Polizei zu erstatten.
6.2. Der Mieter haftet für Schäden, Verlust, Fehlteile und Folgekosten, soweit diese durch unsachgemäße Nutzung, Pflichtverletzung oder nicht ordnungsgemäße Rückgabe verursacht wurden.
6.3. Reparaturen dürfen nur nach vorheriger Zustimmung des Vermieters erfolgen. Eigenmächtige Reparaturen, Umbauten oder technische Veränderungen sind untersagt.
7. Haftung des Vermieters und Verfügbarkeit:
7.1. Der Vermieter haftet für Vorsatz und grobe Fahrlässigkeit sowie nach den gesetzlichen Vorschriften bei Verletzung von Leben, Körper oder Gesundheit.
7.2. Für mittelbare Schäden, Produktionsausfall, entgangenen Gewinn oder ungeeignete Einsatzplanung haftet der Vermieter nur, soweit gesetzlich zwingend vorgeschrieben.
7.3. Wird das Gerät vor Mietbeginn ohne Verschulden des Vermieters nicht verfügbar, kann der Vermieter ein gleichwertiges Ersatzgerät anbieten oder vom Vertrag zurücktreten. Bereits gezahlte Beträge werden dann erstattet.
8. Rückgabezustand und Abnahme:
8.1. Der Vermieter prüft das Gerät nach Rückgabe. Später erkennbare verdeckte Schäden können nachgemeldet werden, wenn sie plausibel der Mietzeit zuzuordnen sind.
8.2. Fehlendes Zubehör, fehlende Akkus/Ladegeräte, beschädigte Transportbehälter oder fehlende Anleitungen können zum Wiederbeschaffungswert berechnet werden.
9. Rechtswahl, Gerichtsstand, Sonstiges:
9.1. Es gilt deutsches Recht.
9.2. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt; an ihre Stelle tritt die gesetzliche Regelung.
Wir haben die allgemeinen Mietbedingungen für Geräte zur Kenntnis genommen.`;

  addTermsDocument(isEquipmentRental ? equipmentTermsText : vehicleTermsText);
  return doc;
}

export function downloadRentalContractPdf(rental: Rental): void {
  const doc = buildRentalContractPdf(rental);
  doc.save(`mietvertrag-${rental.id}.pdf`);
}

export function buildSignedRentalContractPdf(rental: Rental, signatures: RentalDigitalSignature[]): jsPDF {
  const doc = buildRentalContractPdf(rental);
  const pageCount = doc.getNumberOfPages();
  const tenant1 = signatures.find((signature) => signature.signer === "tenant1");
  const tenant2 = signatures.find((signature) => signature.signer === "tenant2");
  const dateLabel = (signature: RentalDigitalSignature) => {
    const date = new Date(signature.signedAt);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString("de-DE") : signature.signedAt;
  };

  doc.setPage(3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  if (tenant1) {
    doc.addImage(tenant1.signatureDataUrl, "PNG", 81, 184, 42, 15, undefined, "FAST");
    doc.text(dateLabel(tenant1), 91, 207);
  }
  if (tenant2) {
    doc.addImage(tenant2.signatureDataUrl, "PNG", 145, 184, 42, 15, undefined, "FAST");
    doc.text(dateLabel(tenant2), 155, 207);
  }

  doc.setPage(pageCount);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(15, 23, 42);
  if (tenant1) {
    doc.addImage(tenant1.signatureDataUrl, "PNG", 111, 247, 36, 13, undefined, "FAST");
    doc.text(dateLabel(tenant1), 116, 269);
  }
  if (tenant2) {
    doc.addImage(tenant2.signatureDataUrl, "PNG", 153, 247, 36, 13, undefined, "FAST");
    doc.text(dateLabel(tenant2), 158, 269);
  }

  return doc;
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

export async function buildDamageListPdf(rental: Rental): Promise<jsPDF> {
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
  const outsideDamages = damages.filter((damage) => (damage.surface ?? "outside") === "outside");
  const insideDamages = damages.filter((damage) => damage.surface === "inside");
  const markers = outsideDamages
    .map((damage) => damage.marker)
    .filter((marker): marker is { x: number; y: number } => {
      return Boolean(
        marker &&
          typeof marker === "object" &&
          typeof marker.x === "number" &&
          typeof marker.y === "number" &&
          Number.isFinite(marker.x) &&
          Number.isFinite(marker.y),
      );
    })
    .map((marker) => ({
      x: Math.max(0, Math.min(1, marker.x)),
      y: Math.max(0, Math.min(1, marker.y)),
    }));

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.text("Skizze", 15, y);
  y += 6;

  try {
    const rendered = await renderSketchWithMarkers({ imageSrc: "/sketch/vehicle-top.png", markers, width: 1200 });
    const sketchW = 180;
    const sketchH = Math.min(92, (rendered.height / rendered.width) * sketchW);
    doc.addImage(rendered.dataUrl, "PNG", 15, y, sketchW, sketchH);
    y += sketchH + 12;
  } catch {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Skizzenbild konnte nicht geladen werden.", 15, y);
    y += 12;
  }

  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
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
    doc.text(damageLocationLabel(dmg), 24, y);
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

  if (insideDamages.some((damage) => damage.marker)) {
    try {
      const insideMarkers = insideDamages
        .map((damage) => damage.marker)
        .filter((marker): marker is { x: number; y: number } => {
          return Boolean(
            marker &&
              typeof marker === "object" &&
              typeof marker.x === "number" &&
              typeof marker.y === "number" &&
              Number.isFinite(marker.x) &&
              Number.isFinite(marker.y),
          );
        })
        .map((marker) => ({ x: Math.max(0, Math.min(1, marker.x)), y: Math.max(0, Math.min(1, marker.y)) }));
      const renderedInside = await renderSketchWithMarkers({ imageSrc: "/sketch/innen2.png", markers: insideMarkers, width: 1200 });
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Schadensskizze innen", 15, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Vermietungs-ID: ${rental.id}`, 15, 28);
      const sketchW = 180;
      const sketchH = Math.min(220, (renderedInside.height / renderedInside.width) * sketchW);
      doc.addImage(renderedInside.dataUrl, "PNG", 15, 40, sketchW, sketchH);
    } catch {
      // Schadensliste bleibt auch ohne Innen-Skizze exportierbar.
    }
  }

  return doc;
}

export async function downloadDamageListPdf(rental: Rental): Promise<void> {
  const doc = await buildDamageListPdf(rental);
  doc.save(`schadensliste-${rental.id}.pdf`);
}
