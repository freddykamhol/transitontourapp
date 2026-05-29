# Portal API (Anfragen/Tickets)

## Start

- Env setzen: `.env` (siehe `.env.example`)
- API starten: `npm run dev:api`

Server läuft standardmäßig auf `http://localhost:8787`.

## Security

- Alle Admin-/Inbound-Endpoints unter `/api/*` verlangen Header `x-tot-api-key` = `PORTAL_API_KEY`.
- CORS ist auf Whitelist beschränkt:
  - Default: `transitontour.de`, `reisetransit.de`, `campingfreunde.com`, `auszeitvan.online`, `localhost`
  - Erweiterbar via `PORTAL_ALLOWED_ORIGINS` (kommagetrennt)

## Endpoints (Kurz)

- `POST /api/inbound/requests` (Kontaktformular → Ticket)  
  Body ist flexibel (Zod passthrough). Empfohlen:
  - `customer: { name, email, phone }`
  - `subject`
  - `message`
  - `source`

- `GET /api/requests` (Liste)
- `GET /api/requests/:id` (Ticket + Verlauf)
- `POST /api/requests/:id/reply` (Antwort speichern)
- `POST /api/requests/:id/forward` (Weiterleiten speichern)
- `POST /api/requests/:id/priority` (Priorität 0..10)
- `POST /api/requests/:id/reject-no-capacity` (Absage)
- `POST /api/requests/:id/block-ip` (IP blockieren)
- `DELETE /api/requests/:id` (Löschen)
- `POST /api/requests/:id/create-rental` (Stub)

## Public Link (Kunde antwortet per Link)

- `GET /public/tickets/:token`
- `POST /public/tickets/:token/reply`

