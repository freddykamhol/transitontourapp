import type { Rental } from "../../domain/rental";
import { getRentalStatus, type RentalStatus } from "../../storage/rentalRepo";

export function formatEur(value: number): string {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value ?? 0);
  } catch {
    return `${value.toFixed(2)} €`;
  }
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function statusLabel(status: RentalStatus): string {
  switch (status) {
    case "geplant":
      return "Geplant";
    case "laufend":
      return "Laufend";
    case "archiv":
      return "Archiv";
  }
}

export function rentalPillClass(rental: Rental): string {
  const { status, overdue } = getRentalStatus(rental);
  if (overdue) return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  switch (status) {
    case "laufend":
      return "bg-slate-900 text-white";
    case "geplant":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "archiv":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}
