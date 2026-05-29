import { config } from "./config.js";

export function requireApiKey(req, res, next) {
  const key = req.header("x-tot-api-key");
  if (!key || key !== config.apiKey) return res.status(401).json({ error: "unauthorized" });
  return next();
}

