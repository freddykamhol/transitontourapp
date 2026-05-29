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

export const corsMiddleware = cors({
  origin(origin, cb) {
    // server-to-server requests often have no Origin
    if (!origin) return cb(null, true);
    const normalized = normalizeOrigin(origin);
    if (normalized && allowed.has(normalized)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-TOT-API-KEY"],
  credentials: false,
  maxAge: 86400,
});

