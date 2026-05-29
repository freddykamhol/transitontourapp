import { jsPDF } from "jspdf";
import type { DamageReport } from "../../domain/vehicle";
import { damageTypeLabel, positionLabel } from "./vehiclesUi";

type Marker = { x: number; y: number };

function ensureMarker(m: unknown): Marker | null {
  if (!m || typeof m !== "object") return null;
  const any = m as { x?: unknown; y?: unknown };
  if (typeof any.x !== "number" || typeof any.y !== "number") return null;
  if (!Number.isFinite(any.x) || !Number.isFinite(any.y)) return null;
  return { x: Math.max(0, Math.min(1, any.x)), y: Math.max(0, Math.min(1, any.y)) };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  // halo
  ctx.fillStyle = "rgba(225, 29, 72, 0.30)";
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  // core
  ctx.fillStyle = "rgba(225, 29, 72, 1)";
  ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x, y, 7.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // inner ring for contrast on light backgrounds
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2.25;
  ctx.beginPath();
  ctx.arc(x, y, 9.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export async function renderSketchWithMarkers(params: {
  imageSrc: string;
  markers: Marker[];
  width: number;
}): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(params.imageSrc);
  const aspect = img.naturalHeight / img.naturalWidth;
  const width = params.width;
  const height = Math.round(width * aspect);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  for (const m of params.markers) {
    drawMarker(ctx, m.x * width, m.y * height);
  }

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export async function downloadSketchPng(params: {
  filename: string;
  imageSrc: string;
  damages: DamageReport[];
}) {
  const markers = params.damages.map((d) => ensureMarker(d.marker)).filter(Boolean) as Marker[];
  const rendered = await renderSketchWithMarkers({ imageSrc: params.imageSrc, markers, width: 1400 });
  downloadDataUrl(params.filename, rendered.dataUrl);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function groupDamages(damages: DamageReport[]) {
  const top: DamageReport[] = [];
  const bottom: DamageReport[] = [];
  const none: DamageReport[] = [];

  for (const d of damages) {
    const m = ensureMarker(d.marker);
    if (!m) {
      none.push(d);
    } else if (m.y < 0.5) {
      top.push(d);
    } else {
      bottom.push(d);
    }
  }
  return { top, bottom, none };
}

function addBulletLine(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const bulletRadius = 3.25;
  const bulletGap = 10;
  const textX = x + bulletRadius * 2 + bulletGap;

  const lines = doc.splitTextToSize(text, maxWidth - (textX - x));
  doc.setFillColor(15, 23, 42);
  doc.circle(x + bulletRadius, y - bulletRadius + 1, bulletRadius, "F");

  let lineY = y;
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], i === 0 ? textX : textX, lineY);
    lineY += lineHeight;
  }
  return lineY;
}

export async function downloadDamagePdf(params: {
  filename: string;
  imageSrc: string;
  vehicleLabel: string;
  damages: DamageReport[];
}) {
  const markers = params.damages.map((d) => ensureMarker(d.marker)).filter(Boolean) as Marker[];
  const rendered = await renderSketchWithMarkers({ imageSrc: params.imageSrc, markers, width: 1200 });

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Schadenübersicht", margin, margin);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fahrzeug: ${params.vehicleLabel}`, margin, margin + 18);
  doc.text(`Export: ${new Date().toLocaleString()}`, margin, margin + 34);

  // Sketch image
  const imageMaxHeight = 260;
  const sketchW = contentWidth;
  const sketchH = Math.min(imageMaxHeight, Math.round((rendered.height / rendered.width) * sketchW));
  const sketchY = margin + 52;
  doc.addImage(rendered.dataUrl, "PNG", margin, sketchY, sketchW, sketchH);

  let y = sketchY + sketchH + 18;

  const { top, bottom, none } = groupDamages(params.damages);
  const sections: Array<{ title: string; items: DamageReport[] }> = [
    { title: "Oben (linke Fahrzeugseite)", items: top },
    { title: "Unten (rechte Fahrzeugseite)", items: bottom },
    { title: "Ohne Marker", items: none },
  ];

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Schäden (ohne Fotos, mit Details)", margin, y);
  y += 14;

  doc.setFontSize(10);
  const lineHeight = 12;

  for (const section of sections) {
    if (section.items.length === 0) continue;

    // new page if tight
    if (y > pageHeight - margin - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");

    for (const d of section.items) {
      const title = `${damageTypeLabel(d.type ?? "sonstiges")} • ${positionLabel(d.position ?? "unknown")} • ${d.severity}`;
      const meta = fmtDate(d.createdAt) ? `Datum: ${fmtDate(d.createdAt)}` : "";
      const details = d.details?.trim() ? `Details: ${d.details.trim()}` : "";

      const block = [title, meta, details].filter(Boolean).join(" — ");

      if (y > pageHeight - margin - 40) {
        doc.addPage();
        y = margin;
      }

      y = addBulletLine(doc, block, margin, y, contentWidth, lineHeight);
      y += 4;
    }
  }

  const blob = doc.output("blob");
  downloadBlob(params.filename, blob);
}
