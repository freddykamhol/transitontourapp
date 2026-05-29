import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { portalApiBaseUrl, portalCalendarToken, syncCalendar } from "../api/portalApi";
import type { CalendarSyncItem } from "../domain/calendar";
import { listRentals } from "../storage/rentalRepo";
import { listMaintenances, listVehicles } from "../storage/vehicleRepo";
import { buildIcsCalendar } from "../lib/ics";

type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  kind: "vermietung" | "uebergabe" | "wartung";
  vehicleId?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function mondayIndex(day: number): number {
  // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  return (day + 6) % 7;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function kindDot(kind: CalendarEvent["kind"]): string {
  if (kind === "vermietung") return "bg-slate-900";
  if (kind === "uebergabe") return "bg-slate-400";
  return "bg-amber-500";
}

function isSameIsoDay(isoA: string, dayKey: string): boolean {
  const d = new Date(isoA);
  if (!Number.isFinite(d.getTime())) return false;
  return toIsoDate(d) === dayKey;
}

const weekdayShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function KalenderPage() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicleFilter, setVehicleFilter] = useState<string>(() => searchParams.get("vehicleId") ?? "");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string>("");

  useEffect(() => {
    const qDate = searchParams.get("date");
    if (!qDate) return;
    const d = new Date(`${qDate}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return;
    setMonth(startOfMonth(d));
    setSelected(d);
  }, [searchParams]);

  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of listVehicles()) {
      map.set(v.id, [v.licensePlate, v.brand, v.model].filter(Boolean).join(" "));
    }
    return map;
  }, []);

  function daysBetweenInclusive(start: Date, end: Date): Date[] {
    const a = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const b = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0);
    const days: Date[] = [];
    for (let d = new Date(a); d.getTime() <= b.getTime(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0)) {
      days.push(d);
    }
    return days;
  }

  const rentals = useMemo(() => listRentals(), []);
  const maintenances = useMemo(() => listMaintenances(), []);

  const rentedVehiclesByDay = useMemo(() => {
    const map = new Map<string, { vehicleId: string; label: string }[]>();
    const seen = new Map<string, Set<string>>();
    for (const r of listRentals()) {
      const start = new Date(r.startAt);
      const end = new Date(r.endAt);
      const vehicleId = r.vehicle?.vehicleId;
      if (!vehicleId) continue;
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;

      const label = r.vehicle?.label ?? vehicleLabelById.get(vehicleId) ?? vehicleId;
      for (const d of daysBetweenInclusive(start, end)) {
        const key = toIsoDate(d);
        const daySeen = seen.get(key) ?? new Set<string>();
        if (daySeen.has(vehicleId)) continue;
        daySeen.add(vehicleId);
        seen.set(key, daySeen);

        const list = map.get(key) ?? [];
        list.push({ vehicleId, label });
        map.set(key, list);
      }
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => a.label.localeCompare(b.label));
      map.set(k, list);
    }
    return map;
  }, [vehicleLabelById]);

  const totalActiveVehicles = useMemo(() => {
    return listVehicles().filter((v) => v.status !== "inaktiv").length;
  }, []);

  const daySignals = useMemo(() => {
    const handovers = new Map<string, number>();
    const returns = new Map<string, number>();
    const maintenanceDays = new Map<string, number>();

    for (const r of rentals) {
      const vehicleId = r.vehicle?.vehicleId;
      if (vehicleFilter && vehicleId !== vehicleFilter) continue;
      if (vehicleId && vehicleLabelById.has(vehicleId) === false && r.vehicle?.label) {
        // no-op (label already in rental)
      }
      const start = new Date(r.startAt);
      const end = new Date(r.endAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      const startKey = toIsoDate(start);
      const endKey = toIsoDate(end);
      handovers.set(startKey, (handovers.get(startKey) ?? 0) + 1);
      returns.set(endKey, (returns.get(endKey) ?? 0) + 1);
    }

    for (const m of maintenances) {
      if (vehicleFilter && m.vehicleId !== vehicleFilter) continue;
      const start = new Date(m.startAt);
      const end = new Date(m.endAt ?? m.startAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      for (const d of daysBetweenInclusive(start, end)) {
        const key = toIsoDate(d);
        maintenanceDays.set(key, (maintenanceDays.get(key) ?? 0) + 1);
      }
    }

    return { handovers, returns, maintenanceDays };
  }, [maintenances, rentals, vehicleFilter, vehicleLabelById]);

  const syncItems = useMemo<CalendarSyncItem[]>(() => {
    const items: CalendarSyncItem[] = [];
    for (const r of rentals) {
      items.push({
        id: r.id,
        kind: "rental",
        title: `Vermietung: ${r.vehicle?.label ?? r.vehicle?.vehicleId ?? "Fahrzeug"}`,
        startAt: r.startAt,
        endAt: r.endAt,
        vehicleId: r.vehicle?.vehicleId ?? null,
        meta: { type: "rental" },
      });
    }
    for (const m of maintenances) {
      items.push({
        id: m.id,
        kind: "maintenance",
        title: `Wartung: ${(vehicleLabelById.get(m.vehicleId) ?? m.vehicleId) || "Fahrzeug"} – ${m.title}`,
        startAt: m.startAt,
        endAt: m.endAt ?? null,
        vehicleId: m.vehicleId ?? null,
        meta: { status: m.status },
      });
    }
    return items;
  }, [maintenances, rentals, vehicleLabelById]);

  const webcalHttpUrl = useMemo(() => {
    const token = portalCalendarToken();
    const base = portalApiBaseUrl();
    const url = `${base}/public/calendar.ics?token=${encodeURIComponent(token)}`;
    return url;
  }, []);

  const webcalUrl = useMemo(() => webcalHttpUrl.replace(/^https?:\/\//, "webcal://"), [webcalHttpUrl]);

  const icsDownload = useMemo(() => {
    const ics = buildIcsCalendar({
      name: "Transit on Tour Kalender",
      prodId: "-//Transit on Tour//Kalender//DE",
      events: syncItems.map((it) => ({
        uid: `tot-${it.kind}-${it.id}`,
        title: it.title,
        startAt: it.startAt,
        endAt: it.endAt ?? undefined,
        allDay: true,
      })),
    });
    return ics;
  }, [syncItems]);

  const gridDays = useMemo(() => {
    const first = startOfMonth(month);
    const firstWeekday = mondayIndex(first.getDay());
    const start = new Date(first);
    start.setDate(first.getDate() - firstWeekday);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [month]);

  const selectedKey = toIsoDate(selected);
  const selectedHandovers = useMemo(() => {
    return rentals
      .filter((r) => (vehicleFilter ? r.vehicle?.vehicleId === vehicleFilter : true))
      .filter((r) => isSameIsoDay(r.startAt, selectedKey))
      .map((r) => ({
        id: `handover-${r.id}`,
        title: `Übergabe: ${r.vehicle?.label ?? r.vehicle?.vehicleId ?? "Fahrzeug"}`,
        href: `/vermietungen/${encodeURIComponent(r.id)}`,
      }));
  }, [rentals, selectedKey, vehicleFilter]);

  const selectedReturns = useMemo(() => {
    return rentals
      .filter((r) => (vehicleFilter ? r.vehicle?.vehicleId === vehicleFilter : true))
      .filter((r) => isSameIsoDay(r.endAt, selectedKey))
      .map((r) => ({
        id: `return-${r.id}`,
        title: `Rückgabe: ${r.vehicle?.label ?? r.vehicle?.vehicleId ?? "Fahrzeug"}`,
        href: `/vermietungen/${encodeURIComponent(r.id)}`,
      }));
  }, [rentals, selectedKey, vehicleFilter]);

  const selectedMaintenances = useMemo(() => {
    const day = new Date(`${selectedKey}T00:00:00`);
    return maintenances
      .filter((m) => (vehicleFilter ? m.vehicleId === vehicleFilter : true))
      .filter((m) => {
        const start = new Date(m.startAt);
        const end = new Date(m.endAt ?? m.startAt);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
        const a = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).getTime();
        const b = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0).getTime();
        const x = day.getTime();
        return x >= a && x <= b;
      })
      .map((m) => ({
        id: `mnt-${m.id}`,
        title: `${vehicleLabelById.get(m.vehicleId) ?? m.vehicleId}: ${m.title}`,
        href: `/fahrzeug/${encodeURIComponent(m.vehicleId)}?date=${encodeURIComponent(selectedKey)}`,
        status: m.status,
      }));
  }, [maintenances, selectedKey, vehicleFilter, vehicleLabelById]);

  const selectedEntryCount = selectedHandovers.length + selectedReturns.length + selectedMaintenances.length;
  const selectedRentedVehicles = (rentedVehiclesByDay.get(selectedKey) ?? []).filter((x) => (vehicleFilter ? x.vehicleId === vehicleFilter : true));
  const selectedRentedCount = rentedVehiclesByDay.get(selectedKey)?.length ?? 0;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Kalender</h2>
            <p className="mt-1 text-xs text-slate-500">Monatsansicht für Übergaben/Rückgaben und Wartungen.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={vehicleFilter}
              onChange={(e) => {
                const next = e.target.value;
                setVehicleFilter(next);
                const nextParams = new URLSearchParams(searchParams);
                if (next) nextParams.set("vehicleId", next);
                else nextParams.delete("vehicleId");
                setSearchParams(nextParams, { replace: true });
              }}
              className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              aria-label="Fahrzeug Filter"
            >
              <option value="">Alle Fahrzeuge</option>
              {listVehicles().map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.licensePlate, v.brand, v.model].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              ‹
            </button>
            <div className="min-w-40 text-center text-sm font-semibold tracking-tight text-slate-900">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              ›
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px"
              onClick={() => {
                const now = new Date();
                setMonth(startOfMonth(now));
                setSelected(now);
              }}
            >
              Heute
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur">
            <span className="h-1.5 w-6 rounded-full bg-amber-600" />
            Vermietet (nicht voll)
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur">
            <span className="h-1.5 w-6 rounded-full bg-rose-600" />
            Voll belegt
          </span>
        </div>

        <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Webcal</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-700">{webcalUrl}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
                onClick={async () => {
                  setSyncError("");
                  await navigator.clipboard.writeText(webcalUrl);
                }}
              >
                Link kopieren
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:translate-y-px disabled:opacity-50"
                disabled={syncBusy}
                onClick={async () => {
                  setSyncBusy(true);
                  setSyncError("");
                  try {
                    await syncCalendar(syncItems);
                    window.location.href = webcalUrl;
                  } catch (e) {
                    setSyncError(e instanceof Error ? e.message : "Sync fehlgeschlagen");
                  } finally {
                    setSyncBusy(false);
                  }
                }}
              >
                Sofort einrichten
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:translate-y-px"
                onClick={() => {
                  const blob = new Blob([icsDownload], { type: "text/calendar;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "kalender.ics";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                ICS herunterladen
              </button>
            </div>
          </div>
          {syncError ? <div className="text-xs font-semibold text-rose-700">{syncError}</div> : null}
          <div className="text-[11px] text-slate-500">
            „Sofort einrichten“ synchronisiert Vermietungen/Wartungen an die API und öffnet anschließend den Webcal-Link.
          </div>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 bg-slate-50">
              {weekdayShort.map((d) => (
                <div key={d} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-white">
              {gridDays.map((d) => {
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = sameDay(d, today);
                const isSelected = sameDay(d, selected);
                const key = toIsoDate(d);
                const handoverCount = daySignals.handovers.get(key) ?? 0;
                const returnCount = daySignals.returns.get(key) ?? 0;
                const maintenanceCount = daySignals.maintenanceDays.get(key) ?? 0;
                const dayEvents = [
                  ...(handoverCount > 0 ? [{ id: `${key}-handover`, kind: "uebergabe" as const }] : []),
                  ...(returnCount > 0 ? [{ id: `${key}-return`, kind: "uebergabe" as const }] : []),
                  ...(maintenanceCount > 0 ? [{ id: `${key}-maint`, kind: "wartung" as const }] : []),
                ];
                const rentedCount = rentedVehiclesByDay.get(key)?.length ?? 0;
                const showOccupancyLine = totalActiveVehicles > 0 && rentedCount > 0;
                const occupancyClass =
                  rentedCount >= totalActiveVehicles ? "bg-rose-600" : "bg-amber-600";

                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "relative h-16 border-t border-slate-200 p-2 text-left transition hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/40 sm:h-24",
                      !inMonth ? "bg-slate-50/40" : "bg-white",
                      isSelected ? "bg-slate-50 ring-2 ring-inset ring-slate-900" : "",
                    ].join(" ")}
                    onClick={() => setSelected(d)}
                    title={
                      totalActiveVehicles > 0 && rentedCount > 0
                        ? `${rentedCount} / ${totalActiveVehicles} Fahrzeuge vermietet`
                        : undefined
                    }
                  >
                    {showOccupancyLine ? (
                      <div className={["absolute left-2 right-2 top-1 h-1 rounded-full", occupancyClass].join(" ")} />
                    ) : null}
                    <div
                      className={[
                        "absolute left-2 top-3 text-xs font-semibold tabular-nums",
                        inMonth ? "text-slate-900" : "text-slate-400",
                        isToday ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm" : "",
                      ].join(" ")}
                    >
                      {d.getDate()}
                    </div>

                    <div className="pt-8">

                    {/* Mobile: dots + count */}
                    <div className="mt-2 flex items-center gap-1 sm:hidden">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span key={e.id} className={["h-1.5 w-1.5 rounded-full", kindDot(e.kind)].join(" ")} />
                      ))}
                      {handoverCount + returnCount + maintenanceCount > 0 ? (
                        <span className="ml-1 text-[10px] font-semibold text-slate-500">
                          {handoverCount + returnCount + maintenanceCount}
                        </span>
                      ) : null}
                    </div>

                    {/* Desktop/Tablet: compact badges */}
                    <div className="mt-2 hidden flex-wrap gap-1 sm:flex">
                      {handoverCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                          Ü {handoverCount}
                        </span>
                      ) : null}
                      {returnCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                          R {returnCount}
                        </span>
                      ) : null}
                      {maintenanceCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          W {maintenanceCount}
                        </span>
                      ) : null}
                    </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auswahl</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selected.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-500">{selectedEntryCount} Einträge</div>
            </div>

            <div className="mt-4 grid gap-2">
              {selectedEntryCount === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Keine Einträge für diesen Tag.</div>
              ) : null}

              {selectedHandovers.length + selectedReturns.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Übergabe / Rückgabe</div>
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                      {selectedHandovers.length + selectedReturns.length}
                    </span>
                  </div>
                  <div className="grid gap-1 px-2 py-2">
                    {[...selectedHandovers, ...selectedReturns].map((it) => (
                      <Link
                        key={it.id}
                        to={it.href}
                        className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{it.title}</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-500 group-hover:text-slate-600">Zur Vermietung</div>
                        </div>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedMaintenances.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Wartungen</div>
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      {selectedMaintenances.length}
                    </span>
                  </div>
                  <div className="grid gap-1 px-2 py-2">
                    {selectedMaintenances.map((it) => (
                      <Link
                        key={it.id}
                        to={it.href}
                        className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{it.title}</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-500 group-hover:text-slate-600">
                            Status: {it.status === "geplant" ? "Geplant" : it.status === "in_arbeit" ? "In Arbeit" : "Erledigt"}
                          </div>
                        </div>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vermietete Fahrzeuge</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                      {vehicleFilter ? selectedRentedVehicles.length : selectedRentedCount}
                      <span className="ml-1 text-xs font-semibold text-slate-500">
                        {totalActiveVehicles > 0 && !vehicleFilter ? `/ ${totalActiveVehicles}` : "vermietet"}
                      </span>
                    </div>
                  </div>
                  {!vehicleFilter && totalActiveVehicles > 0 ? (
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        selectedRentedCount >= totalActiveVehicles
                          ? "bg-rose-600 text-white"
                          : selectedRentedCount > 0
                            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
                      ].join(" ")}
                    >
                      {selectedRentedCount >= totalActiveVehicles ? "Voll belegt" : selectedRentedCount > 0 ? "Teilweise" : "Frei"}
                    </span>
                  ) : null}
                </div>

                {selectedRentedVehicles.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-600">Keine Vermietungen an diesem Tag.</div>
                ) : (
                  <div className="max-h-56 overflow-auto px-2 py-2">
                    {selectedRentedVehicles.map((v) => (
                      <div key={v.vehicleId} className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{v.label}</div>
                          <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{v.vehicleId}</div>
                        </div>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
