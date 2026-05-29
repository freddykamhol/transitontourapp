import { useMemo, useState } from "react";

type Marker = { x: number; y: number };

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function computeMarker(container: HTMLDivElement, clientX: number, clientY: number): Marker {
  const rect = container.getBoundingClientRect();
  const x = clamp01((clientX - rect.left) / rect.width);
  const y = clamp01((clientY - rect.top) / rect.height);
  return { x, y };
}

export default function DamageSketch(props: {
  imageSrc: string;
  marker?: Marker;
  onMarkerChange?: (marker: Marker | undefined) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const markerStyle = useMemo(() => {
    if (!props.marker) return undefined;
    return {
      left: `${props.marker.x * 100}%`,
      top: `${props.marker.y * 100}%`,
    } as const;
  }, [props.marker]);

  return (
    <div className="grid gap-3">
      <div className="text-xs text-slate-500">
        Klick auf das Fahrzeug setzt einen Marker. Der Marker wird mit dem Schaden gespeichert.
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
        onClick={(e) => {
          if (imageError) return;
          const container = e.currentTarget;
          const next = computeMarker(container, e.clientX, e.clientY);
          props.onMarkerChange?.(next);
        }}
      >
        {imageError ? (
          <div className="grid gap-2 p-4">
            <div className="text-sm font-semibold text-slate-900">Skizzenbild nicht gefunden</div>
            <div className="text-xs text-slate-600">
              Datei fehlt oder Pfad falsch: <span className="font-mono">{props.imageSrc}</span>
            </div>
            <div className="text-xs text-slate-500">
              Lege das Bild z.B. als <span className="font-mono">public/sketch/vehicle-top.png</span> ab.
            </div>
          </div>
        ) : (
          <img
            src={props.imageSrc}
            alt="Fahrzeug-Skizze"
            className="block h-auto w-full select-none"
            draggable={false}
            onError={() => setImageError(true)}
          />
        )}

        {/* helper labels */}
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Heck
        </div>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Front
        </div>
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Linke Fahrzeugseite
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Rechte Fahrzeugseite
        </div>

        {/* marker */}
        {markerStyle && !imageError ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={markerStyle}
            aria-hidden="true"
          >
            <span className="relative block h-4 w-4">
              <span className="absolute inset-0 rounded-full bg-rose-500/25" />
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-600 ring-2 ring-white" />
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => props.onMarkerChange?.(undefined)}
        >
          Marker entfernen
        </button>
      </div>
    </div>
  );
}
