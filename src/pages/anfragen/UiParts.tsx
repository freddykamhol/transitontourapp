import { useEffect } from "react";
import { mapStatus } from "./uiUtils";

export function Card(props: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {props.title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">{props.title}</h2>
            {props.subtitle ? <p className="mt-1 text-xs text-slate-500">{props.subtitle}</p> : null}
          </div>
          {props.right ? <div className="shrink-0">{props.right}</div> : null}
        </div>
      ) : null}
      <div className={props.title ? "mt-4" : ""}>{props.children}</div>
    </section>
  );
}

export function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

export function StatusPill(props: { status: string }) {
  const mapped = mapStatus(props.status);
  return <Pill text={mapped.text} className={mapped.className} />;
}

export function Modal(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative mx-auto mt-16 w-[min(720px,calc(100%-24px))] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{props.title}</h3>
            {props.subtitle ? <p className="mt-1 text-xs text-slate-500">{props.subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
        <div className="mt-4">{props.children}</div>
      </div>
    </div>
  );
}

