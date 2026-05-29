#!/usr/bin/env node
/**
 * Generate:
 * - PNG: sketch image with all markers (no text)
 * - PDF: sketch image + grouped damage list (no photos)
 *
 * Usage:
 *   node tools/export-damages.mjs --input damages.json --image public/sketch/vehicle-top.png --out ./exports
 *
 * damages.json format:
 *   {
 *     "vehicleLabel": "...",
 *     "damages": [{ "position": "...", "type": "...", "severity": "...", "details": "...", "createdAt": "...", "marker": { "x": 0.1, "y": 0.2 } }]
 *   }
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import PDFDocument from "pdfkit";

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function groupDamages(damages) {
  const top = [];
  const bottom = [];
  const none = [];
  for (const d of damages) {
    const m = d?.marker;
    if (!m || typeof m.x !== "number" || typeof m.y !== "number") none.push(d);
    else if (m.y < 0.5) top.push(d);
    else bottom.push(d);
  }
  return { top, bottom, none };
}

function labelPosition(pos) {
  const map = {
    front_left: "Front links",
    front_center: "Front mittig",
    front_right: "Front rechts",
    side_left: "Links",
    side_right: "Rechts",
    rear_left: "Heck links",
    rear_center: "Heck mittig",
    rear_right: "Heck rechts",
    top_left: "Oben links",
    top_right: "Oben rechts",
    bottom_left: "Unten links",
    bottom_right: "Unten rechts",
    unknown: "Unbekannt",
  };
  return map[pos] ?? String(pos ?? "Unbekannt");
}

function labelType(type) {
  const map = {
    kratzer: "Kratzer",
    delle: "Delle",
    riss: "Riss",
    lack: "Lack",
    scheibe: "Scheibe",
    reifen: "Reifen",
    innenraum: "Innenraum",
    sonstiges: "Sonstiges",
  };
  return map[type] ?? String(type ?? "Sonstiges");
}

async function renderPng({ imagePath, damages, outPath }) {
  const img = sharp(imagePath);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image size");

  const width = meta.width;
  const height = meta.height;

  // Build SVG overlay with markers
  const markers = damages
    .map((d) => d?.marker)
    .filter((m) => m && typeof m.x === "number" && typeof m.y === "number")
    .map((m) => ({ x: clamp01(m.x) * width, y: clamp01(m.y) * height }));

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${markers
      .map((p) => {
        const halo = `<circle cx="${p.x}" cy="${p.y}" r="14" fill="rgba(225,29,72,0.30)"/>`;
        const core = `<circle cx="${p.x}" cy="${p.y}" r="7.25" fill="rgba(225,29,72,1)"/>`;
        const outline = `<circle cx="${p.x}" cy="${p.y}" r="7.25" fill="none" stroke="rgba(15,23,42,0.9)" stroke-width="3.5"/>`;
        const ring = `<circle cx="${p.x}" cy="${p.y}" r="9.25" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2.25"/>`;
        return `${halo}${core}${outline}${ring}`;
      })
      .join("\n")}
  </svg>`;

  const composite = await img
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  fs.writeFileSync(outPath, composite);
}

function writePdf({ pngBuffer, vehicleLabel, damages, outPath }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(14).text("Schadenübersicht");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).text(`Fahrzeug: ${vehicleLabel || "—"}`);
  doc.text(`Export: ${new Date().toLocaleString()}`);
  doc.moveDown(0.8);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const sketchMaxHeight = 260;
  doc.image(pngBuffer, { fit: [pageWidth, sketchMaxHeight], align: "left" });
  doc.moveDown(1.0);

  doc.font("Helvetica-Bold").fontSize(11).text("Schäden (ohne Fotos, mit Details)");
  doc.moveDown(0.5);

  const { top, bottom, none } = groupDamages(damages);
  const sections = [
    { title: "Oben (linke Fahrzeugseite)", items: top },
    { title: "Unten (rechte Fahrzeugseite)", items: bottom },
    { title: "Ohne Marker", items: none },
  ];

  for (const section of sections) {
    if (!section.items.length) continue;
    doc.font("Helvetica-Bold").fontSize(10).text(section.title);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(10);

    for (const d of section.items) {
      const title = `${labelType(d.type)} • ${labelPosition(d.position)} • ${d.severity || ""}`.trim();
      const meta = fmtDate(d.createdAt) ? `Datum: ${fmtDate(d.createdAt)}` : "";
      const details = d.details ? `Details: ${String(d.details).trim()}` : "";
      const line = [title, meta, details].filter(Boolean).join(" — ");

      // prominent bullet
      const x = doc.x;
      const y = doc.y + 8;
      doc.save();
      doc.fillColor("#0f172a");
      doc.circle(x + 6, y, 3.25).fill();
      doc.restore();

      doc.text(line, x + 18, doc.y, { width: pageWidth - 18 });
      doc.moveDown(0.2);

      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    }

    doc.moveDown(0.4);
  }

  doc.end();
}

const input = arg("--input");
const imagePath = arg("--image");
const outDir = arg("--out") ?? "./exports";

if (!input || !imagePath) {
  console.error("Missing args. Example:\n  node tools/export-damages.mjs --input damages.json --image public/sketch/vehicle-top.png --out ./exports");
  process.exit(1);
}

const json = readJson(input);
const damages = Array.isArray(json.damages) ? json.damages : [];
const vehicleLabel = json.vehicleLabel ?? "";

ensureDir(outDir);

const baseName = (vehicleLabel || "fahrzeug").toString().replaceAll(" ", "_").replaceAll("/", "_");
const pngPath = path.join(outDir, `skizze_${baseName}.png`);
const pdfPath = path.join(outDir, `schadenuebersicht_${baseName}.pdf`);

await renderPng({ imagePath, damages, outPath: pngPath });
const pngBuffer = fs.readFileSync(pngPath);
writePdf({ pngBuffer, vehicleLabel, damages, outPath: pdfPath });

console.log(`OK\n- ${pngPath}\n- ${pdfPath}`);

