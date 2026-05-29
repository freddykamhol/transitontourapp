export type CalendarItemKind = "rental" | "maintenance";

export type CalendarSyncItem = {
  id: string;
  kind: CalendarItemKind;
  title: string;
  startAt: string; // ISO
  endAt?: string | null; // ISO
  vehicleId?: string | null;
  meta?: Record<string, unknown>;
};

