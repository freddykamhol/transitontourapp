import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRequests, type RequestListItem } from "../api/portalApi";
import { rentalPartyName } from "../domain/rental";
import { listRentals, getRentalStatus } from "../storage/rentalRepo";
import { listVehicles } from "../storage/vehicleRepo";
import { formatDateTime } from "./anfragen/uiUtils";
import { StatusPill } from "./anfragen/UiParts";
import { formatEur } from "./rentals/rentalUi";

type DashboardRental = ReturnType<typeof listRentals>[number];

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
}

function StatCard(props: { label: string; value: string; hint?: string; to?: string }) {
  const content = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{props.value}</div>
      {props.hint ? <div className="mt-2 text-xs text-slate-500">{props.hint}</div> : null}
    </>
  );

  if (props.to) {
    return (
      <Link to={props.to} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50">
        {content}
      </Link>
    );
  }

  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{content}</div>;
}

function ActionButton(props: { to: string; label: string }) {
  return (
    <Link
      to={props.to}
      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
    >
      {props.label}
    </Link>
  );
}

function rentalRevenue(rental: DashboardRental): number {
  return Number.isFinite(rental.payment.totalEur) ? rental.payment.totalEur : 0;
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestListItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const rentals = useMemo(() => listRentals(), []);
  const inventory = useMemo(() => listVehicles(), []);
  const vehicles = useMemo(() => inventory.filter((item) => (item.kind ?? "vehicle") === "vehicle"), [inventory]);
  const equipment = useMemo(() => inventory.filter((item) => (item.kind ?? "vehicle") === "equipment"), [inventory]);

  useEffect(() => {
    let cancelled = false;
    setRequestsLoading(true);
    setRequestsError(null);
    listRequests({ limit: 200 })
      .then((items) => {
        if (!cancelled) setRequests(items);
      })
      .catch((error) => {
        if (!cancelled) setRequestsError(error instanceof Error ? error.message : "Anfragen konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const rentalStats = useMemo(() => {
    const running = rentals
      .filter((rental) => getRentalStatus(rental, now).status === "laufend")
      .sort((a, b) => a.endAt.localeCompare(b.endAt));
    const planned = rentals
      .filter((rental) => getRentalStatus(rental, now).status === "geplant")
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const overdue = rentals.filter((rental) => getRentalStatus(rental, now).overdue);
    const thisMonth = rentals.filter((rental) => {
      const start = new Date(rental.startAt);
      return Number.isFinite(start.getTime()) && start.getFullYear() === currentYear && start.getMonth() === currentMonth;
    });
    const thisYear = rentals.filter((rental) => {
      const start = new Date(rental.startAt);
      return Number.isFinite(start.getTime()) && start.getFullYear() === currentYear;
    });
    const revenueOpen = rentals.reduce((sum, rental) => sum + Math.max(0, rentalRevenue(rental) - (rental.payment.paidEur || 0)), 0);

    return {
      running,
      planned,
      overdue,
      total: rentals.length,
      thisMonth: thisMonth.length,
      revenueMonth: thisMonth.reduce((sum, rental) => sum + rentalRevenue(rental), 0),
      revenueYear: thisYear.reduce((sum, rental) => sum + rentalRevenue(rental), 0),
      revenueOpen,
    };
  }, [currentMonth, currentYear, now, rentals]);

  const requestStats = useMemo(() => {
    const open = requests.filter((request) => request.status !== "abgesagt" && request.status !== "archiv");
    const newest = requests.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
    return {
      total: requests.length,
      new: requests.filter((request) => request.status === "neu").length,
      inProgress: requests.filter((request) => request.status === "in_bearbeitung").length,
      open: open.length,
      newest,
    };
  }, [requests]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aktive Mieten" value={rentalStats.running.length.toString()} hint={`${rentalStats.overdue.length} überfällig`} to="/vermietungen" />
        <StatCard label="Geplante Mieten" value={rentalStats.planned.length.toString()} hint={`${rentalStats.thisMonth} Start(s) diesen Monat`} to="/vermietungen?status=geplant" />
        <StatCard label="Umsatz Monat" value={formatEur(rentalStats.revenueMonth)} hint={`Jahr: ${formatEur(rentalStats.revenueYear)}`} to="/vermietungen" />
        <StatCard label="Offene Zahlung" value={formatEur(rentalStats.revenueOpen)} hint="Restbetrag aller Vermietungen" to="/vermietungen" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fahrzeuge" value={vehicles.length.toString()} hint={`${equipment.length} Gerät(e) im Inventar`} to="/fahrzeug" />
        <StatCard label="Schäden offen" value={inventory.reduce((sum, item) => sum + item.openDamages, 0).toString()} hint="Alle erfassten Schadenspunkte" to="/fahrzeug" />
        <StatCard label="Anfragen neu" value={requestsLoading ? "…" : requestStats.new.toString()} hint={requestsError ?? `${requestStats.open} offen gesamt`} to="/anfragen" />
        <StatCard label="Anfragen in Arbeit" value={requestsLoading ? "…" : requestStats.inProgress.toString()} hint={`${requestStats.total} Anfragen geladen`} to="/anfragen" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Aktuell laufende Vermietungen</h2>
            <p className="mt-1 text-xs text-slate-500">Live aus den gespeicherten Vermietungen berechnet.</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">{rentalStats.running.length} aktiv</div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rentalStats.running.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 lg:col-span-2">
              Aktuell läuft keine Vermietung.
            </div>
          ) : (
            rentalStats.running.slice(0, 6).map((rental) => {
              const status = getRentalStatus(rental, now);
              return (
                <Link key={rental.id} to={`/vermietungen/${rental.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{rentalPartyName(rental.tenant) || "Ohne Mietername"}</div>
                      <div className="truncate text-xs text-slate-500">{rental.vehicle.label}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-slate-900">{rental.id}</div>
                      <div className={status.overdue ? "text-xs font-semibold text-rose-700" : "text-xs text-slate-500"}>
                        {formatDate(rental.startAt)} – {formatDate(rental.endAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Nächste Vermietungen</h2>
            <p className="mt-1 text-xs text-slate-500">Die nächsten geplanten Übergaben.</p>
          </div>
          <Link to="/kalender" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Kalender öffnen
          </Link>
        </div>

        <div className="mt-4 hidden w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[760px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Miete</th>
                <th className="px-4 py-3">Mieter</th>
                <th className="px-4 py-3">Fahrzeug</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Betrag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rentalStats.planned.slice(0, 6).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={6}>Keine geplanten Vermietungen.</td>
                </tr>
              ) : (
                rentalStats.planned.slice(0, 6).map((rental) => (
                  <tr key={rental.id} className="text-sm text-slate-900">
                    <td className="px-4 py-3 font-semibold">{rental.id}</td>
                    <td className="px-4 py-3">{rentalPartyName(rental.tenant) || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{rental.vehicle.label}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(rental.startAt)}</td>
                    <td className="px-4 py-3 font-semibold">{formatEur(rentalRevenue(rental))}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/vermietungen/${rental.id}`} className="text-xs font-semibold text-slate-900 hover:text-slate-700">Öffnen</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
          {rentalStats.planned.slice(0, 6).length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Keine geplanten Vermietungen.</div>
          ) : (
            rentalStats.planned.slice(0, 6).map((rental) => (
              <Link key={rental.id} to={`/vermietungen/${rental.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{rentalPartyName(rental.tenant) || "—"}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">{rental.vehicle.label}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs font-semibold text-slate-900">{formatEur(rentalRevenue(rental))}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500">Start: {formatDateTime(rental.startAt)}</div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Neue Anfragen</h2>
            <p className="mt-1 text-xs text-slate-500">Live aus der Portal-API.</p>
          </div>
          <Link to="/anfragen" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Alle anzeigen
          </Link>
        </div>

        {requestsError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{requestsError}</div> : null}

        <div className="mt-4 hidden w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[760px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Betreff</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Update</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {requestsLoading ? (
                <tr><td className="px-4 py-6 text-sm text-slate-600" colSpan={5}>Lädt…</td></tr>
              ) : requestStats.newest.length === 0 ? (
                <tr><td className="px-4 py-6 text-sm text-slate-600" colSpan={5}>Keine Anfragen vorhanden.</td></tr>
              ) : (
                requestStats.newest.map((request) => (
                  <tr key={request.id} className="text-sm text-slate-900">
                    <td className="px-4 py-3"><StatusPill status={request.status} /></td>
                    <td className="px-4 py-3"><div className="font-semibold">{request.subject ?? "—"}</div><div className="text-xs text-slate-500">{request.id}</div></td>
                    <td className="px-4 py-3 text-slate-700"><div>{request.customerName ?? "—"}</div><div className="text-xs text-slate-500">{request.customerEmail ?? "—"}</div></td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(request.updatedAt)}</td>
                    <td className="px-4 py-3 text-right"><Link to={`/anfragen/${request.id}`} className="text-xs font-semibold text-slate-900 hover:text-slate-700">Öffnen</Link></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Aktionen</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ActionButton to="/anfragen" label="Anfragen einsehen" />
          <ActionButton to="/vermietungen/neu" label="Vermietung anlegen" />
          <ActionButton to="/kalender" label="Kalender" />
        </div>
      </section>
    </div>
  );
}
