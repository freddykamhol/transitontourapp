import { useMemo, useState } from "react";
import type { ReminderAttachmentCategory, ReminderMailSettings } from "../../domain/reminder";
import { getReminderMailSettings, reminderCategories, reminderCategoryLabels, saveReminderMailSettings } from "../../storage/reminderRepo";

function Field(props: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={["grid gap-1", props.className ?? ""].join(" ")}>
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

const inputClass = "h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

export default function EinstellungenErinnerungsmailPage() {
  const [settings, setSettings] = useState<ReminderMailSettings>(() => getReminderMailSettings());
  const [savedAt, setSavedAt] = useState("");
  const enabledCategories = useMemo(() => new Set(settings.attachmentCategories), [settings.attachmentCategories]);

  const toggleCategory = (category: ReminderAttachmentCategory) => {
    setSettings((current) => {
      const next = new Set(current.attachmentCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { ...current, attachmentCategories: Array.from(next) };
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Erinnerungsmail</h3>
          <p className="mt-1 text-xs text-slate-500">Automatischer Versand vor Rückgabe mit auswählbaren Anhang-Kategorien.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))} />
          Aktiv
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Betreff">
          <input value={settings.subject} onChange={(e) => setSettings((s) => ({ ...s, subject: e.target.value }))} className={inputClass} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tage vor Rückgabe">
            <input type="number" min={0} step={1} value={settings.daysBeforeReturn} onChange={(e) => setSettings((s) => ({ ...s, daysBeforeReturn: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} className={inputClass} />
          </Field>
          <Field label="Uhrzeit">
            <input type="time" value={settings.sendTime} onChange={(e) => setSettings((s) => ({ ...s, sendTime: e.target.value || "09:00" }))} className={inputClass} />
          </Field>
        </div>
        <Field label="Text" className="md:col-span-2" hint="Variablen: {name}, {id}, {item}, {returnAt}">
          <textarea value={settings.text} onChange={(e) => setSettings((s) => ({ ...s, text: e.target.value }))} className="min-h-48 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10" />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Anhang-Kategorien</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {reminderCategories.map((category) => (
            <label key={category} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={enabledCategories.has(category)} onChange={() => toggleCategory(category)} />
              {reminderCategoryLabels[category]}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500">{savedAt || "Noch nicht gespeichert"}</div>
        <button
          type="button"
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          onClick={() => {
            saveReminderMailSettings(settings);
            setSavedAt(`Gespeichert: ${new Date().toLocaleString()}`);
          }}
        >
          Speichern
        </button>
      </div>
    </section>
  );
}
