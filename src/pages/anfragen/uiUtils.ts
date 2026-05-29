export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function mapStatus(status: string): { text: string; className: string } {
  if (status === "neu") return { text: "Neu", className: "bg-slate-900 text-white" };
  if (status === "in_bearbeitung")
    return { text: "In Bearbeitung", className: "bg-slate-100 text-slate-900 ring-1 ring-slate-200" };
  if (status === "abgesagt") return { text: "Abgesagt", className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
  return { text: status, className: "bg-slate-50 text-slate-700 ring-1 ring-slate-200" };
}

