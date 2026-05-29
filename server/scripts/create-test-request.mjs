// Usage:
//   PORTAL_API_KEY=... node server/scripts/create-test-request.mjs
// Optional:
//   PORTAL_API_URL=http://localhost:8787

const apiUrl = (process.env.PORTAL_API_URL || "http://localhost:8787").replace(/\/+$/, "");
const apiKey = process.env.PORTAL_API_KEY;

if (!apiKey) {
  console.error("Missing env var: PORTAL_API_KEY");
  process.exit(1);
}

const payload = {
  source: "terminal-test",
  customer: {
    name: "Test Kunde",
    email: "testkunde@example.com",
    phone: "+49 151 12345678",
  },
  subject: "Testanfrage – Fahrzeug mieten",
  message:
    "Hi! Ich würde gerne einen Campervan mieten.\n\nZeitraum: 2026-06-10 bis 2026-06-14\nOrt: Berlin\n\nDanke!",
  // beliebige Zusatzfelder (skalierbar)
  meta: {
    desiredVehicle: "Campervan",
    adults: 2,
    kids: 0,
  },
};

const res = await fetch(`${apiUrl}/api/inbound/requests`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-tot-api-key": apiKey,
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Request failed: ${res.status}`);
  console.error(text);
  process.exit(1);
}

console.log(text);

