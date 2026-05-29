import type { DamagePosition, DamageType, VehicleStatus } from "../../domain/vehicle";

export function formatStatus(status: VehicleStatus): string {
  switch (status) {
    case "verfuegbar":
      return "Verfügbar";
    case "vermietet":
      return "Vermietet";
    case "wartung":
      return "Wartung";
    case "inaktiv":
      return "Inaktiv";
  }
}

export function statusPillClass(status: VehicleStatus): string {
  switch (status) {
    case "verfuegbar":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "vermietet":
      return "bg-slate-900 text-white";
    case "wartung":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "inaktiv":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export function positionLabel(position: DamagePosition): string {
  switch (position) {
    case "front_left":
      return "Front links";
    case "front_center":
      return "Front mittig";
    case "front_right":
      return "Front rechts";
    case "side_left":
      return "Links";
    case "side_right":
      return "Rechts";
    case "rear_left":
      return "Heck links";
    case "rear_center":
      return "Heck mittig";
    case "rear_right":
      return "Heck rechts";
    case "top_left":
      return "Oben links";
    case "top_right":
      return "Oben rechts";
    case "bottom_left":
      return "Unten links";
    case "bottom_right":
      return "Unten rechts";
    case "unknown":
      return "Unbekannt";
  }
}

export function damageTypeLabel(type: DamageType): string {
  switch (type) {
    case "kratzer":
      return "Kratzer";
    case "delle":
      return "Delle";
    case "riss":
      return "Riss";
    case "lack":
      return "Lack";
    case "scheibe":
      return "Scheibe";
    case "reifen":
      return "Reifen";
    case "innenraum":
      return "Innenraum";
    case "sonstiges":
      return "Sonstiges";
  }
}
