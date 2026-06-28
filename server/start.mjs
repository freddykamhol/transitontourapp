import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { apiHealthOk } from "./healthCheck.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "..", "dist");
const distIndex = path.join(distDir, "index.html");

function fail(message) {
  console.error(`[portal-start] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  fail(`Frontend build fehlt: ${distIndex}. Bitte zuerst "npm run build" ausführen.`);
}

const indexHtml = fs.readFileSync(distIndex, "utf8");
const assetPaths = [...indexHtml.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((match) => match[1]);
const missingAssets = assetPaths.filter((assetPath) => !fs.existsSync(path.join(distDir, assetPath)));

if (missingAssets.length > 0) {
  fail(`Frontend assets fehlen: ${missingAssets.join(", ")}. Bitte "npm run build" neu ausführen.`);
}

console.log(`[portal-start] Frontend OK: ${distIndex}`);

if (await apiHealthOk(config.port)) {
  console.log(`[portal-start] API läuft bereits auf http://localhost:${config.port}`);
} else {
  await import("./index.js");
}
