import { Link } from "react-router-dom";

type RunningRental = {
  id: string;
  customerName: string;
  vehicle: string;
  from: string;
  to: string;
};

type Anfrage = {
  id: string;
  customerName: string;
  vehicleWish: string;
  dateFrom: string;
  dateTo: string;
  status: "neu" | "in_bearbeitung" | "angenommen" | "abgelehnt";
  createdAt: string;
};

const runningRentals: RunningRental[] = [
  { id: "V-1024", customerName: "Max Mustermann", vehicle: "VW Transporter T6", from: "20.05.2026", to: "23.05.2026" },
  { id: "V-1025", customerName: "Sara Klein", vehicle: "Ford Transit", from: "19.05.2026", to: "22.05.2026" },
];

const anfragen: Anfrage[] = [
  {
    id: "A-2001",
    customerName: "Lena Fischer",
    vehicleWish: "Kastenwagen",
    dateFrom: "24.05.2026",
    dateTo: "26.05.2026",
    status: "neu",
    createdAt: "20.05.2026",
  },
  {
    id: "A-2002",
    customerName: "Tom Becker",
    vehicleWish: "9-Sitzer",
    dateFrom: "28.05.2026",
    dateTo: "30.05.2026",
    status: "in_bearbeitung",
    createdAt: "19.05.2026",
  },
  {
    id: "A-2003",
    customerName: "Mia Schuster",
    vehicleWish: "Transporter",
    dateFrom: "01.06.2026",
    dateTo: "05.06.2026",
    status: "angenommen",
    createdAt: "18.05.2026",
  },
];

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{props.value}</div>
      {props.hint ? <div className="mt-2 text-xs text-slate-500">{props.hint}</div> : null}
    </div>
  );
}

function StatusPill(props: { status: Anfrage["status"] }) {
  const { label, className } =
    props.status === "neu"
      ? { label: "Neu", className: "bg-slate-900 text-white" }
      : props.status === "in_bearbeitung"
        ? { label: "In Bearbeitung", className: "bg-slate-100 text-slate-900" }
        : props.status === "angenommen"
          ? { label: "Angenommen", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" }
          : { label: "Abgelehnt", className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };

  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", className].join(" ")}>{label}</span>;
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

export default function DashboardPage() {
  const anzahlFahrzeuge = 12;
  const anzahlKunden = 48;
  const anzahlAnfragenUnbeantwortet = anfragen.filter((a) => a.status === "neu").length;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Aktuell laufende Vermietungen</h2>
            <p className="mt-1 text-xs text-slate-500">Überblick über aktive Zeiträume.</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">{runningRentals.length} aktiv</div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {runningRentals.map((rental) => (
            <div key={rental.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{rental.customerName}</div>
                  <div className="truncate text-xs text-slate-500">{rental.vehicle}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-semibold text-slate-900">{rental.id}</div>
                  <div className="text-xs text-slate-500">
                    {rental.from} – {rental.to}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Anzahl Fahrzeuge" value={anzahlFahrzeuge.toString()} hint="Bestand gesamt" />
        <StatCard label="Anzahl Kunden" value={anzahlKunden.toString()} hint="Kundendatenbank" />
        <StatCard
          label="Anzahl Anfragen (unbeantwortet)"
          value={anzahlAnfragenUnbeantwortet.toString()}
          hint="Status: Neu"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Übersicht Anfragen</h2>
            <p className="mt-1 text-xs text-slate-500">Alle Anfragen auf einen Blick.</p>
          </div>
          <Link to="/anfragen" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Alle anzeigen
          </Link>
        </div>

        {/* Mobile cards */}
        <div className="mt-4 grid gap-3 md:hidden">
          {anfragen.map((anfrage) => (
            <div key={anfrage.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{anfrage.customerName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {anfrage.id} • {anfrage.createdAt}
                  </div>
                </div>
                <StatusPill status={anfrage.status} />
              </div>
              <div className="mt-3 grid gap-1 text-sm text-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Wunsch:</span> {anfrage.vehicleWish}
                </div>
                <div className="text-slate-700">
                  <span className="text-xs font-semibold text-slate-500">Zeitraum:</span> {anfrage.dateFrom} –{" "}
                  {anfrage.dateTo}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="mt-4 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 md:block">
          <table className="min-w-[860px] w-full border-collapse">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Wunsch</th>
                <th className="px-4 py-3">Zeitraum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Eingang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {anfragen.map((anfrage) => (
                <tr key={anfrage.id} className="text-sm text-slate-900">
                  <td className="px-4 py-3 font-semibold">{anfrage.id}</td>
                  <td className="px-4 py-3">{anfrage.customerName}</td>
                  <td className="px-4 py-3">{anfrage.vehicleWish}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {anfrage.dateFrom} – {anfrage.dateTo}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={anfrage.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{anfrage.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Aktionen</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ActionButton to="/anfragen" label="Anfragen einsehen" />
          <ActionButton to="/vermietungen" label="Vermietung anlegen" />
          <ActionButton to="/kalender" label="Kalender" />
        </div>
      </section>
    </div>
  );
}
