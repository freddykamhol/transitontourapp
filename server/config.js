import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) throw new Error(`Missing env var: ${name}`);
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return fallback;
  return value;
}

const defaultAllowedOrigins = [
  "https://transitontour.de",
  "https://reisetransit.de",
  "https://campingfreunde.com",
  "https://auszeitvan.online",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
];

export const config = {
  port: Number(optional("PORTAL_API_PORT", "8787")),
  apiKey: required("PORTAL_API_KEY"),
  calendarToken: optional("PORTAL_CALENDAR_TOKEN", ""),
  dbPath: optional("PORTAL_DB_PATH", "./data/portal.sqlite"),
  allowedOrigins: optional("PORTAL_ALLOWED_ORIGINS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(defaultAllowedOrigins),
};
