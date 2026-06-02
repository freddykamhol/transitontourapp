export type RequestListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  priority: number;
  source: string | null;
  customerEmail: string | null;
  customerName: string | null;
  subject: string | null;
  ipAddress: string | null;
};

export type TicketMessage = {
  id: string;
  requestId: string;
  createdAt: string;
  direction: "in" | "out";
  channel: string;
  fromEmail: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string | null;
  metaJson: string | null;
};

export type RequestDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  priority: number;
  source: string | null;
  customerEmail: string | null;
  customerName: string | null;
  subject: string | null;
  payload: unknown;
  ipAddress: string | null;
  userAgent: string | null;
};

export type GetRequestResponse = {
  request: RequestDetail;
  messages: TicketMessage[];
};

export function portalApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_PORTAL_API_URL as string | undefined)?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/+$/, "");
  if (import.meta.env.PROD) return "";
  return "http://localhost:8787";
}

function apiKey(): string {
  return (import.meta.env.VITE_PORTAL_API_KEY as string | undefined) ?? "";
}

export function portalCalendarToken(): string {
  const raw = (import.meta.env.VITE_PORTAL_CALENDAR_TOKEN as string | undefined)?.trim();
  if (raw && raw.length > 0) return raw;
  return apiKey();
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${portalApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init?.headers ?? {});
  headers.set("content-type", headers.get("content-type") ?? "application/json");
  const key = apiKey();
  if (key) headers.set("x-tot-api-key", key);
  return await fetch(url, { ...init, headers });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function listRequests(params?: { status?: string; q?: string; limit?: number }): Promise<RequestListItem[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.limit) search.set("limit", String(params.limit));

  const res = await apiFetch(`/api/requests?${search.toString()}`, { method: "GET" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await readJson<{ items: RequestListItem[] }>(res);
  return data.items ?? [];
}

export async function getRequest(id: string): Promise<GetRequestResponse> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}`, { method: "GET" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await readJson<GetRequestResponse>(res);
}

export async function setPriority(id: string, priority: number): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/priority`, {
    method: "POST",
    body: JSON.stringify({ priority }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function rejectNoCapacity(id: string, note?: string): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/reject-no-capacity`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function blockIpForRequest(id: string, reason?: string): Promise<{ ip: string }> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/block-ip`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await readJson<{ ip: string }>(res);
  return { ip: data.ip };
}

export async function deleteRequest(id: string): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function replyToRequest(id: string, params: { subject?: string; body: string; toEmail?: string }): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/reply`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function forwardRequest(id: string, params: { toEmail: string; subject?: string; body: string }): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/forward`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function createRentalFromRequest(id: string, note?: string): Promise<void> {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(id)}/create-rental`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function syncCalendar(items: import("../domain/calendar").CalendarSyncItem[]): Promise<void> {
  const res = await apiFetch("/api/calendar/sync", { method: "POST", body: JSON.stringify({ items }) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function sendMail(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
}): Promise<{ messageId: string | null }> {
  const res = await apiFetch("/api/mail/send", { method: "POST", body: JSON.stringify(params) });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await readJson<{ messageId?: string | null }>(res);
  return { messageId: data.messageId ?? null };
}
