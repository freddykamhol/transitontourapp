function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function toDateValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}${m}${day}`;
}

function addDaysLocal(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0);
  return next.toISOString();
}

function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
}

export type IcsEvent = {
  uid: string;
  title: string;
  startAt: string; // ISO
  endAt?: string | null; // ISO
  allDay?: boolean;
  description?: string;
};

export function buildIcsCalendar(params: { name: string; prodId: string; events: IcsEvent[] }): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${params.prodId}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeText(params.name)}`);

  for (const e of params.events) {
    const dtstamp = toUtcStamp(new Date().toISOString());
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(e.uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);

    if (e.allDay) {
      const start = toDateValue(e.startAt);
      const endIso = e.endAt ?? addDaysLocal(e.startAt, 1);
      const end = toDateValue(endIso);
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(e.startAt)}`);
      if (e.endAt) lines.push(`DTEND:${toUtcStamp(e.endAt)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

