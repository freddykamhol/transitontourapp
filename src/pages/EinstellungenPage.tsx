import { NavLink, Outlet } from "react-router-dom";

function TabLink(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      end
      className={({ isActive }) =>
        [
          "inline-flex items-center rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition",
          isActive ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        ].join(" ")
      }
    >
      {props.label}
    </NavLink>
  );
}

export default function EinstellungenPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Einstellungen</h2>
            <p className="mt-1 text-xs text-slate-500">Integrationen, Status und Benutzerverwaltung.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabLink to="/einstellungen/integrationen" label="Integrationen" />
            <TabLink to="/einstellungen/status" label="Status" />
            <TabLink to="/einstellungen/benutzer" label="Benutzer" />
          </div>
        </div>
      </section>

      <Outlet />
    </div>
  );
}
