import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { rentalPartyName, type Rental } from "../../domain/rental";
import { getRentalSignaturePackage, sendMail } from "../../api/portalApi";
import { deleteRental, getRental, getRentalStatus, markReturned, updateRental } from "../../storage/rentalRepo";
import RentalForm from "./components/RentalForm";
import { sendRentalDocumentsMail } from "./rentalMail";
import {
  buildDamageListPdf,
  buildInvoicePdf,
  buildRentalContractPdf,
  downloadDamageListPdf,
  downloadInvoicePdf,
  downloadRentalContractPdf,
} from "./rentalDocs";
import { formatDateTime, formatEur, rentalPillClass, statusLabel } from "./rentalUi";

function Pill(props: { text: string; className: string }) {
  return <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", props.className].join(" ")}>{props.text}</span>;
}

function Modal(props: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{props.title}</div>
            <div className="mt-1 text-xs text-slate-500">Schnellansicht</div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Schließen
          </button>
        </div>
        <div className="p-5">{props.children}</div>
      </div>
    </div>
  );
}

function mailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

function isRunning(r: Rental): boolean {
  const meta = getRentalStatus(r, new Date());
  return meta.status === "laufend" && !r.actualReturnAt;
}

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,\n;]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  return await arrayBufferToBase64(await file.arrayBuffer());
}

function downloadBase64File(filename: string, contentBase64: string, contentType: string): void {
  const bytes = Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function VermietungDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const rentalId = params.rentalId ?? "";
  const [editing, setEditing] = useState(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("edit") === "1";
  });
  const [showTenant, setShowTenant] = useState(false);
  const [docTab, setDocTab] = useState<"vertrag" | "schaden" | "rechnung">("vertrag");
  const [protectedOpen, setProtectedOpen] = useState<{ doc: "vertrag" | "schaden" | "rechnung" } | null>(null);
  const [protectedPassword, setProtectedPassword] = useState("");
  const [sendOpen, setSendOpen] = useState<{ doc: "vertrag" | "schaden" | "rechnung" } | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string>("");
  const [bundleSendBusy, setBundleSendBusy] = useState(false);
  const [bundleSendError, setBundleSendError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [sendForm, setSendForm] = useState<{
    toCustomer: boolean;
    toUser: boolean;
    toOther: boolean;
    otherEmails: string;
    subject: string;
    body: string;
  }>({
    toCustomer: true,
    toUser: false,
    toOther: false,
    otherEmails: "",
    subject: "",
    body: "",
  });

  const rental = useMemo(() => getRental(rentalId), [rentalId]);
  const meta = useMemo(() => (rental ? getRentalStatus(rental, new Date()) : null), [rental]);
  const running = rental ? isRunning(rental) : false;
  const signedContract = rental?.contractWorkflow?.signedContract;

  useEffect(() => {
    if (!rental) return;
    let cancelled = false;
    getRentalSignaturePackage(rental.id)
      .then((data) => {
        if (cancelled || !data.signedContract) return;
        if (rental.contractWorkflow?.signedContract?.signedAt === data.signedContract.signedAt) return;
        updateRental(rental.id, {
          contractWorkflow: {
            ...rental.contractWorkflow,
            digitalSignatures: data.signedContract.digitalSignatures,
            signedContract: data.signedContract,
          },
        });
        navigate(0);
      })
      .catch(() => {
        // Signature package may not exist yet for older rentals.
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, rental]);

  const docDefs = useMemo(() => {
    if (!rental) return [];
    return [
      {
        id: "vertrag" as const,
        title: "Vertrag",
        filename: `mietvertrag-${rental.id}.pdf`,
        build: () => buildRentalContractPdf(rental),
        download: () => downloadRentalContractPdf(rental),
      },
      {
        id: "schaden" as const,
        title: "Schadensliste",
        filename: `schadensliste-${rental.id}.pdf`,
        build: () => buildDamageListPdf(rental),
        download: () => downloadDamageListPdf(rental),
      },
      {
        id: "rechnung" as const,
        title: "Rechnung",
        filename: `rechnung-${rental.id}.pdf`,
        build: () => buildInvoicePdf(rental),
        download: () => downloadInvoicePdf(rental),
      },
    ] as const;
  }, [rental]);

  if (!rental) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight">Nicht gefunden</h2>
        <p className="mt-2 text-sm text-slate-600">Diese Vermietung existiert nicht (mehr).</p>
        <div className="mt-4">
          <Link to="/vermietungen" className="text-sm font-semibold text-slate-900 hover:underline">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  const statusText = meta?.overdue ? "Überfällig" : statusLabel(meta?.status ?? "laufend");
  const tenantName = rentalPartyName(rental.tenant);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight">{tenantName || "Vermietung"}</h2>
              <Pill text={statusText} className={rentalPillClass(rental)} />
              <span className="text-xs text-slate-500">{rental.id}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {rental.vehicle.label} • {formatDateTime(rental.startAt)} → {formatDateTime(rental.endAt)}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowTenant(true)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Mieter anzeigen
            </button>
            <a
              href={mailto(
                rental.tenant.email,
                `Vermietung ${rental.id} – ${rental.vehicle.licensePlate ?? ""}`.trim(),
                `Hallo ${tenantName},\n\nkurzes Update zu deiner Vermietung (${rental.id}).\n\nViele Grüße`,
              )}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              E-Mail senden
            </a>
            <button
              type="button"
              onClick={() => downloadRentalContractPdf(rental)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Mietvertrag
            </button>
            <button
              type="button"
              disabled={bundleSendBusy}
              onClick={async () => {
                setBundleSendBusy(true);
                setBundleSendError("");
                try {
                  const result = await sendRentalDocumentsMail(rental);
                  updateRental(rental.id, {
                    contractWorkflow: {
                      ...rental.contractWorkflow,
                      lastSentAt: new Date().toISOString(),
                      lastMessageId: result.messageId,
                      lastError: "",
                    },
                  });
                  navigate(0);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Versand fehlgeschlagen";
                  updateRental(rental.id, {
                    contractWorkflow: {
                      ...rental.contractWorkflow,
                      lastError: message,
                    },
                  });
                  setBundleSendError(message);
                } finally {
                  setBundleSendBusy(false);
                }
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unterlagen erneut senden {bundleSendBusy ? "…" : ""}
            </button>
            <button
              type="button"
              onClick={() => downloadInvoicePdf(rental)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Rechnung
            </button>
          </div>
        </div>

        {bundleSendError || rental.contractWorkflow?.lastSentAt || rental.contractWorkflow?.lastError ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {rental.contractWorkflow?.lastSentAt ? (
              <div>
                Unterlagen zuletzt versendet: <span className="font-semibold text-slate-900">{formatDateTime(rental.contractWorkflow.lastSentAt)}</span>
              </div>
            ) : null}
            {bundleSendError || rental.contractWorkflow?.lastError ? (
              <div className="mt-1 font-semibold text-rose-700">Mailversand: {bundleSendError || rental.contractWorkflow?.lastError}</div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1 text-xs text-slate-600">
            <div>
              Zahlung: <span className="font-semibold text-slate-900">{formatEur(rental.payment.totalEur)}</span> • Status:{" "}
              <span className="font-semibold text-slate-900">{rental.payment.status}</span>
            </div>
            {rental.actualReturnAt ? (
              <div>
                Rückgabe: <span className="font-semibold text-slate-900">{formatDateTime(rental.actualReturnAt)}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!rental.actualReturnAt ? (
              <button
                type="button"
                onClick={() => {
                  markReturned(rental.id);
                  navigate(0);
                }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"
              >
                Als zurückgegeben markieren
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm("Vermietung wirklich löschen?")) return;
                deleteRental(rental.id);
                navigate("/vermietungen");
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm hover:bg-slate-50"
            >
              Löschen
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Dokumente</h3>
            <p className="mt-1 text-xs text-slate-500">Vertrag, Schadensliste und Rechnung als PDF.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {docDefs.map((d) => (
              <button
                key={d.id}
                type="button"
                className={[
                  "inline-flex items-center rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition",
                  docTab === d.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                onClick={() => setDocTab(d.id)}
              >
                {d.title}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {docDefs
            .filter((d) => d.id === docTab)
            .map((d) => (
              <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
                    <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{d.filename}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => d.download()}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        setProtectedPassword("");
                        setProtectedOpen({ doc: d.id });
                      }}
                    >
                      Geschützter Download
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                      onClick={() => {
                        setSendError("");
                        setSendForm((s) => ({
                          ...s,
                          subject: s.subject || `Vermietung ${rental.id} – ${d.title}`,
                          body:
                            s.body ||
                            `Hallo ${tenantName},\n\nanbei die Unterlagen zu deiner Vermietung (${rental.id}).\n\nViele Grüße`,
                        }));
                        setSendOpen({ doc: d.id });
                      }}
                    >
                      Versand per E-Mail
                    </button>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <div className="grid gap-1 text-xs font-semibold text-slate-600">
                    <div>
                      Fahrzeug: <span className="font-semibold text-slate-900">{rental.vehicle.label}</span>
                    </div>
                    <div>
                      Zeitraum:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatDateTime(rental.startAt)} → {formatDateTime(rental.endAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-3 text-[11px] text-slate-500">„Geschützter Download“ ist aktuell ein Passwort-Dialog vor dem Download (kein PDF-Passwort).</div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Unterschriebener Vertrag</h3>
            <p className="mt-1 text-xs text-slate-500">Digital signierter Vertrag oder papierhaft unterschriebener Upload.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            Upload
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={uploadBusy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                setUploadBusy(true);
                try {
                  const contentBase64 = await fileToBase64(file);
                  updateRental(rental.id, {
                    contractWorkflow: {
                      ...rental.contractWorkflow,
                      signedContract: {
                        filename: file.name,
                        contentBase64,
                        contentType: file.type || "application/pdf",
                        uploadedAt: new Date().toISOString(),
                        signedAt: new Date().toISOString(),
                        source: "paper",
                      },
                    },
                  });
                  navigate(0);
                } finally {
                  setUploadBusy(false);
                }
              }}
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {signedContract ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{signedContract.filename}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Signiert: {formatDateTime(signedContract.signedAt)} • Quelle: {signedContract.source === "paper" ? "Papierform" : "Digital"}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => downloadBase64File(signedContract.filename, signedContract.contentBase64, signedContract.contentType)}
              >
                Unterschriebenen Vertrag herunterladen
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Noch kein unterschriebener Vertrag hinterlegt.</div>
          )}
        </div>
      </section>

      {editing ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Bearbeiten</h3>
              <p className="mt-1 text-xs text-slate-500">
                Wenn bereits laufend: Nur Zeitraum Rückgabe, Zusatzfahrer, Zusatzleistungen, Versicherung.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Schließen
            </button>
          </div>

          <div className="mt-5">
            <RentalForm
              mode="edit"
              initial={rental}
              submitLabel="Änderungen speichern"
              onCancel={() => setEditing(false)}
              readOnlyKeys={
                running
                  ? {
                      tenant: true,
                      vehicle: true,
                      startAt: true,
                      payment: true,
                    }
                  : undefined
              }
              onSubmit={(value) => {
                const patch = {
                  startAt: value.startAt,
                  endAt: value.endAt,
                  tenant: value.tenant,
                  vehicle: value.vehicle,
                  additionalDrivers: value.additionalDrivers,
                  insurance: value.insurance,
                  addons: value.addons,
                  payment: value.payment,
                  reminderWorkflow: {
                    ...rental.reminderWorkflow,
                    attachmentSelections: value.reminderAttachmentSelections,
                  },
                  internalNotes: value.internalNotes,
                };

                if (running) {
                  updateRental(rental.id, {
                    endAt: patch.endAt,
                    additionalDrivers: patch.additionalDrivers,
                    addons: patch.addons,
                    insurance: patch.insurance,
                    reminderWorkflow: patch.reminderWorkflow,
                    internalNotes: patch.internalNotes,
                  });
                } else {
                  updateRental(rental.id, patch);
                }
                setEditing(false);
                navigate(0);
              }}
            />
          </div>
        </section>
      ) : null}

      <Modal
        title="Geschützter Download"
        open={Boolean(protectedOpen)}
        onClose={() => {
          setProtectedOpen(null);
          setProtectedPassword("");
        }}
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!protectedOpen) return;
            const def = docDefs.find((x) => x.id === protectedOpen.doc);
            if (!def) return;
            if (!protectedPassword.trim()) return;
            await def.download();
            setProtectedOpen(null);
            setProtectedPassword("");
          }}
        >
          <div className="text-sm text-slate-700">Passwort eingeben, um den Download zu starten.</div>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Passwort</span>
            <input
              type="password"
              value={protectedPassword}
              onChange={(e) => setProtectedPassword(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
              placeholder="••••••••"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setProtectedOpen(null)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!protectedPassword.trim()}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download starten
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Versand per E-Mail"
        open={Boolean(sendOpen)}
        onClose={() => {
          setSendOpen(null);
          setSendError("");
          setSendBusy(false);
        }}
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sendOpen) return;
            const def = docDefs.find((x) => x.id === sendOpen.doc);
            if (!def) return;

            const to: string[] = [];
            if (sendForm.toCustomer && rental.tenant.email) to.push(rental.tenant.email);
            if (sendForm.toOther) to.push(...splitEmails(sendForm.otherEmails));
            if (to.length === 0) {
              setSendError("Bitte Empfänger auswählen.");
              return;
            }

            setSendBusy(true);
            setSendError("");
            try {
              const pdf = await def.build();
              const buf = pdf.output("arraybuffer") as ArrayBuffer;
              const contentBase64 = await arrayBufferToBase64(buf);
              await sendMail({
                to,
                subject: sendForm.subject || `Vermietung ${rental.id} – ${def.title}`,
                text: sendForm.body || "",
                attachments: [{ filename: def.filename, contentBase64, contentType: "application/pdf" }],
              });
              setSendOpen(null);
            } catch (err) {
              setSendError(err instanceof Error ? err.message : "Versand fehlgeschlagen");
            } finally {
              setSendBusy(false);
            }
          }}
        >
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Empfänger</div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={sendForm.toCustomer} onChange={(e) => setSendForm((s) => ({ ...s, toCustomer: e.target.checked }))} />
              Kunde ({rental.tenant.email || "keine E-Mail"})
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-400">
              <input type="checkbox" checked={sendForm.toUser} disabled onChange={() => {}} />
              Benutzer (Platzhalter)
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={sendForm.toOther} onChange={(e) => setSendForm((s) => ({ ...s, toOther: e.target.checked }))} />
              Andere
            </label>
            {sendForm.toOther ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-600">E-Mails (kommagetrennt)</span>
                <textarea
                  value={sendForm.otherEmails}
                  onChange={(e) => setSendForm((s) => ({ ...s, otherEmails: e.target.value }))}
                  className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
                  placeholder="a@example.com, b@example.com"
                />
              </label>
            ) : null}
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Betreff</span>
            <input
              value={sendForm.subject}
              onChange={(e) => setSendForm((s) => ({ ...s, subject: e.target.value }))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Nachricht</span>
            <textarea
              value={sendForm.body}
              onChange={(e) => setSendForm((s) => ({ ...s, body: e.target.value }))}
              className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            />
          </label>

          {sendError ? <div className="text-sm font-semibold text-rose-700">{sendError}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setSendOpen(null)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={sendBusy}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Senden {sendBusy ? "…" : ""}
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Mieter" open={showTenant} onClose={() => setShowTenant(false)}>
        <div className="grid gap-4 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mieter</div>
            <div className="mt-2 font-semibold text-slate-900">{tenantName}</div>
            <div className="mt-1 text-xs text-slate-600">{rental.tenant.email}</div>
            {rental.tenant.phone ? <div className="mt-1 text-xs text-slate-600">{rental.tenant.phone}</div> : null}
            {rental.tenant.addressLine1 ? <div className="mt-2 text-xs text-slate-600">{rental.tenant.addressLine1}</div> : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Zusatzfahrer</div>
            {rental.additionalDrivers.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">Keine Zusatzfahrer.</div>
            ) : (
              <div className="mt-2 grid gap-2">
                {rental.additionalDrivers.map((d, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">{rentalPartyName(d) || `Zusatzfahrer #${idx + 1}`}</div>
                    {d.email ? <div className="mt-1 text-xs text-slate-600">{d.email}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
