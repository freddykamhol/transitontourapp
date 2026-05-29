import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold tracking-tight">Seite nicht gefunden</h2>
      <p className="mt-2 text-sm text-slate-600">
        Die angeforderte Seite existiert nicht. Zurück zum Dashboard.
      </p>
      <div className="mt-4">
        <Link
          to="/"
          className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Dashboard öffnen
        </Link>
      </div>
    </div>
  );
}
