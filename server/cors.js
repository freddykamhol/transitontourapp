import cors from "cors";
import { config } from "./config.js";

function normalizeOrigin(origin) {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    return u.origin;
  } catch {
    return null;
  }
}

const allowed = new Set(config.allowedOrigins.map((o) => normalizeOrigin(o)).filter(Boolean));
const allowedRootDomains = new Set((config.allowedRootDomains ?? []).map((domain) => String(domain).toLowerCase()).filter(Boolean));

function isAllowedRootDomain(origin) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    for (const domain of allowedRootDomains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const corsMiddleware = cors({
  origin(origin, cb) {
    // server-to-server requests often have no Origin
    if (!origin) return cb(null, true);
    const normalized = normalizeOrigin(origin);
    if (normalized && allowed.has(normalized)) return cb(null, true);
    if (isAllowedRootDomain(origin)) return cb(null, true);
    console.warn(`[cors] allowing unlisted origin with API-key auth: ${origin}`);
    return cb(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-TOT-API-KEY"],
  credentials: false,
  maxAge: 86400,
});
