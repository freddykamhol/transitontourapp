function pad2(n) {
  return String(n).padStart(2, "0");
}

function toUtcStamp(iso) {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function toDateValue(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}${m}${day}`;
}

function escapeText(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
}

export function buildIcs({ name, prodId, events }) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${prodId}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeText(name)}`);

  const dtstamp = toUtcStamp(new Date().toISOString());
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(e.uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);

    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toDateValue(e.startAt)}`);
      lines.push(`DTEND;VALUE=DATE:${toDateValue(e.endAt)}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(e.startAt)}`);
      if (e.endAt) lines.push(`DTEND:${toUtcStamp(e.endAt)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

