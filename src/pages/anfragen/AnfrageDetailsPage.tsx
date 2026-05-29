import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  blockIpForRequest,
  createRentalFromRequest,
  deleteRequest,
  forwardRequest,
  getRequest,
  replyToRequest,
  rejectNoCapacity,
  sendMail,
  setPriority,
  type GetRequestResponse,
  type TicketMessage,
} from "../../api/portalApi";
import { Card, Modal, StatusPill } from "./UiParts";
import { formatDateTime } from "./uiUtils";

function MessageBubble(props: { msg: TicketMessage }) {
  const isIn = props.msg.direction === "in";
  return (
    <div className={["grid", isIn ? "justify-items-start" : "justify-items-end"].join(" ")}>
      <div
        className={[
          "w-full max-w-2xl rounded-3xl border px-4 py-3 shadow-sm",
          isIn ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            {isIn ? "Eingang" : "Ausgang"} • {props.msg.channel}
          </div>
          <div className="text-[11px] text-slate-500">{formatDateTime(props.msg.createdAt)}</div>
        </div>
        {props.msg.subject ? <div className="mt-2 text-sm font-semibold text-slate-900">{props.msg.subject}</div> : null}
        {props.msg.body ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{props.msg.body}</div> : null}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {props.msg.fromEmail ? <span>Von: {props.msg.fromEmail}</span> : null}
          {props.msg.toEmail ? <span>An: {props.msg.toEmail}</span> : null}
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs text-slate-500">{props.hint}</span> : null}
    </label>
  );
}

export default function AnfrageDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<GetRequestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [replyForm, setReplyForm] = useState<{ toEmail: string; subject: string; body: string }>({
    toEmail: "",
    subject: "",
    body: "",
  });
  const [forwardForm, setForwardForm] = useState<{ toEmail: string; subject: string; body: string }>({
    toEmail: "",
    subject: "",
    body: "",
  });
  const [rejectNote, setRejectNote] = useState("");
  const [replySendEmail, setReplySendEmail] = useState(true);
  const [forwardSendEmail, setForwardSendEmail] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getRequest(id);
      setData(d);
      setReplyForm((s) => ({
        ...s,
        toEmail: s.toEmail || d.request.customerEmail || "",
        subject: s.subject || `Re: ${d.request.subject ?? ""}`.trim(),
      }));
      setForwardForm((s) => ({
        ...s,
        subject: s.subject || `[FW] ${d.request.subject ?? ""}`.trim(),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const header = useMemo(() => {
    if (!data) return null;
    const customer = [data.request.customerName, data.request.customerEmail].filter(Boolean).join(" • ");
    return { customer: customer || "—" };
  }, [data]);

  if (!id) {
    return (
      <Card title="Anfrage" subtitle="Keine ID angegeben.">
        <Link to="/anfragen" className="text-xs font-semibold text-slate-900 hover:text-slate-700">
          Zur Übersicht
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card
        title={data?.request.subject ?? "Anfrage"}
        subtitle={header ? header.customer : "—"}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => void load()}
            >
              Aktualisieren
            </button>
            <Link
              to="/anfragen"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Zur Übersicht
            </Link>
          </div>
        }
      >
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        {loading || !data ? (
          <div className="text-sm text-slate-600">Lädt…</div>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</div>
                <div className="mt-2">
                  <StatusPill status={data.request.status} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Priorität</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">{data.request.priority}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Letztes Update</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(data.request.updatedAt)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Ticket-ID">
                  <input
                    value={data.request.id}
                    readOnly
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  />
                </Field>
                <Field label="Eingang">
                  <input
                    value={formatDateTime(data.request.createdAt)}
                    readOnly
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  />
                </Field>
                <Field label="Priorität setzen" hint="0..10">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      defaultValue={data.request.priority}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
                      onBlur={async (e) => {
                        const value = Number(e.target.value);
                        if (!Number.isFinite(value)) return;
                        setBusy("priority");
                        try {
                          await setPriority(data.request.id, Math.max(0, Math.min(10, Math.trunc(value))));
                          await load();
                        } finally {
                          setBusy(null);
                        }
                      }}
                    />
                    <div className="grid place-items-center text-[11px] text-slate-500">{busy === "priority" ? "…" : ""}</div>
                  </div>
                </Field>
              </div>
            </div>

            <Card title="Aktionen" subtitle="Ticket bearbeiten">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  onClick={() => setReplyOpen(true)}
                >
                  Antworten
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setForwardOpen(true)}
                >
                  Weiterleiten
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={async () => {
                    setBusy("create-rental");
                    try {
                      await createRentalFromRequest(data.request.id);
                      await load();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Miete anlegen {busy === "create-rental" ? "…" : ""}
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setRejectOpen(true)}
                >
                  Absage – Keine Kapazitäten
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={async () => {
                    const ok = confirm("IP für dieses Ticket blockieren?");
                    if (!ok) return;
                    setBusy("block-ip");
                    try {
                      const r = await blockIpForRequest(data.request.id);
                      alert(`IP blockiert: ${r.ip}`);
                      await load();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  IP blockieren {busy === "block-ip" ? "…" : ""}
                </button>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
                  onClick={async () => {
                    const ok = confirm("Ticket wirklich löschen?");
                    if (!ok) return;
                    setBusy("delete");
                    try {
                      await deleteRequest(data.request.id);
                      navigate("/anfragen");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Löschen {busy === "delete" ? "…" : ""}
                </button>
              </div>
            </Card>

            <Card title="Ticketverlauf" subtitle={`${data.messages.length} Nachrichten`}>
              <div className="grid gap-3">
                {data.messages.length === 0 ? (
                  <div className="text-sm text-slate-600">Noch keine Nachrichten.</div>
                ) : (
                  data.messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                )}
              </div>
            </Card>
          </div>
        )}
      </Card>

      <Modal open={replyOpen} title="Antworten" subtitle="Speichert eine ausgehende Nachricht im Ticketverlauf." onClose={() => setReplyOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!data) return;
            setBusy("reply");
            try {
              const toEmail = (replyForm.toEmail || data.request.customerEmail || "").trim();
              await replyToRequest(data.request.id, {
                toEmail: replyForm.toEmail || undefined,
                subject: replyForm.subject || undefined,
                body: replyForm.body,
              });
              if (replySendEmail && toEmail) {
                await sendMail({
                  to: [toEmail],
                  subject: replyForm.subject || undefined,
                  text: replyForm.body,
                });
              }
              setReplyForm((s) => ({ ...s, body: "" }));
              setReplyOpen(false);
              await load();
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="An (Email)" hint="Optional (Fallback: Kunden-Email)">
            <input
              value={replyForm.toEmail}
              onChange={(e) => setReplyForm((s) => ({ ...s, toEmail: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="kunde@example.com"
            />
          </Field>
          <Field label="Betreff">
            <input
              value={replyForm.subject}
              onChange={(e) => setReplyForm((s) => ({ ...s, subject: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Nachricht">
            <textarea
              value={replyForm.body}
              onChange={(e) => setReplyForm((s) => ({ ...s, body: e.target.value }))}
              className="min-h-36 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="Antwort…"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={replySendEmail} onChange={(e) => setReplySendEmail(e.target.checked)} />
            Per E-Mail senden (SMTP)
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setReplyOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!replyForm.body.trim()}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Speichern {busy === "reply" ? "…" : ""}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={forwardOpen} title="Weiterleiten" subtitle="Speichert eine Weiterleitung im Ticketverlauf." onClose={() => setForwardOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!data) return;
            setBusy("forward");
            try {
              await forwardRequest(data.request.id, {
                toEmail: forwardForm.toEmail,
                subject: forwardForm.subject || undefined,
                body: forwardForm.body,
              });
              if (forwardSendEmail) {
                await sendMail({
                  to: [forwardForm.toEmail],
                  subject: forwardForm.subject || undefined,
                  text: forwardForm.body,
                });
              }
              setForwardForm((s) => ({ ...s, body: "" }));
              setForwardOpen(false);
              await load();
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="An (Email)">
            <input
              value={forwardForm.toEmail}
              onChange={(e) => setForwardForm((s) => ({ ...s, toEmail: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="team@example.com"
            />
          </Field>
          <Field label="Betreff">
            <input
              value={forwardForm.subject}
              onChange={(e) => setForwardForm((s) => ({ ...s, subject: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Nachricht">
            <textarea
              value={forwardForm.body}
              onChange={(e) => setForwardForm((s) => ({ ...s, body: e.target.value }))}
              className="min-h-36 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="Weiterleitung…"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={forwardSendEmail} onChange={(e) => setForwardSendEmail(e.target.checked)} />
            Per E-Mail senden (SMTP)
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setForwardOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!forwardForm.toEmail.trim() || !forwardForm.body.trim()}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Speichern {busy === "forward" ? "…" : ""}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={rejectOpen} title="Absage – Keine Kapazitäten" subtitle="Setzt Status auf abgesagt und loggt eine Systemnachricht." onClose={() => setRejectOpen(false)}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!data) return;
            setBusy("reject");
            try {
              await rejectNoCapacity(data.request.id, rejectNote || undefined);
              setRejectNote("");
              setRejectOpen(false);
              await load();
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="Notiz" hint="Optional">
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="Interne Notiz…"
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setRejectOpen(false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
            >
              Absagen {busy === "reject" ? "…" : ""}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
