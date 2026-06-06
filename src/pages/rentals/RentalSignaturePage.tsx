import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { RentalDigitalSignature, RentalSignedContract, RentalSignerKey } from "../../domain/rental";
import type { Rental } from "../../domain/rental";
import { getPublicRentalSignaturePackage, prepareRentalSignaturePackage, savePublicRentalSignature } from "../../api/portalApi";
import { getRental, updateRental } from "../../storage/rentalRepo";
import { buildSignedRentalContractPdf, downloadRentalContractPdf } from "./rentalDocs";
import { formatDateTime } from "./rentalUi";

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) return true;
  }
  return false;
}

function downloadBase64File(filename: string, contentBase64: string, contentType: string): void {
  const bytes = Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function signerFromSearch(value: string | null): RentalSignerKey | null {
  if (value === "2" || value === "tenant2") return "tenant2";
  if (value === "1" || value === "tenant1") return "tenant1";
  return null;
}

function signerNumber(signer: RentalSignerKey): string {
  return signer === "tenant2" ? "2" : "1";
}

function signerLabel(signer: RentalSignerKey): string {
  return signer === "tenant2" ? "2. Mieter" : "1. Mieter";
}

function signerName(rental: Rental, signer: RentalSignerKey): string {
  const party = signer === "tenant2" ? rental.additionalDrivers[0] : rental.tenant;
  return party?.name?.trim() || signerLabel(signer);
}

function signatureUrl(rentalId: string, signer: RentalSignerKey): string {
  return `/signieren/${encodeURIComponent(rentalId)}?mieter=${signerNumber(signer)}`;
}

export default function RentalSignaturePage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rentalId = params.rentalId ?? "";
  const requestedSigner = signerFromSearch(searchParams.get("mieter") ?? searchParams.get("signer"));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [completedContract, setCompletedContract] = useState<RentalSignedContract | null>(null);
  const [rental, setRental] = useState<Rental | null>(() => getRental(rentalId));
  const [loading, setLoading] = useState(true);
  const [selectedSigner, setSelectedSigner] = useState<RentalSignerKey | null>(requestedSigner);
  const [askSecondSigner, setAskSecondSigner] = useState(false);
  const signedContract = completedContract ?? rental?.contractWorkflow?.signedContract;
  const digitalSignatures = signedContract?.digitalSignatures ?? rental?.contractWorkflow?.digitalSignatures ?? [];

  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.6;
    context.strokeStyle = "#0f172a";
  };

  useEffect(() => {
    let cancelled = false;
    getPublicRentalSignaturePackage(rentalId)
      .then((data) => {
        if (cancelled) return;
        setRental(data.rental);
        setCompletedContract(data.signedContract);
      })
      .catch(() => {
        if (cancelled) return;
        const localRental = getRental(rentalId);
        setRental(localRental);
        if (localRental) {
          void prepareRentalSignaturePackage(localRental).catch(() => {
            // Local fallback keeps admin testing usable until the API package exists.
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rentalId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvas(canvas);
    const observer = new ResizeObserver(() => {
      setupCanvas(canvas);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [loading, signedContract, version]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">Mietvertrag wird geladen</h1>
          <p className="mt-2 text-sm text-slate-600">Einen Moment bitte.</p>
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">Mietvertrag nicht gefunden</h1>
          <p className="mt-2 text-sm text-slate-600">Der Signaturlink ist ungültig oder diese Miete ist in diesem Browser nicht verfügbar.</p>
        </div>
      </div>
    );
  }

  const hasSecondTenant = Boolean(rental.additionalDrivers[0]?.name || rental.additionalDrivers[0]?.email);
  const activeSigner = selectedSigner ?? (hasSecondTenant ? null : "tenant1");
  const tenant1Signature = digitalSignatures.find((signature) => signature.signer === "tenant1");
  const tenant2Signature = digitalSignatures.find((signature) => signature.signer === "tenant2");
  const activeSignerSigned = activeSigner ? digitalSignatures.some((signature) => signature.signer === activeSigner) : false;
  const allRequiredSigned = Boolean(tenant1Signature && (!hasSecondTenant || tenant2Signature));

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const p = point(event);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(p.x, p.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    events.forEach((pointerEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      context.lineTo(pointerEvent.clientX - rect.left, pointerEvent.clientY - rect.top);
      context.stroke();
    });
  };

  const stop = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released by the browser.
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    setError("");
  };

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <main className="mx-auto grid max-w-3xl gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Digitale Signatur</div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">Mietvertrag unterschreiben</h1>
              <p className="mt-2 text-sm text-slate-600">
                {rental.vehicle.label} · {formatDateTime(rental.startAt)} bis {formatDateTime(rental.endAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadRentalContractPdf(rental)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Vertrag ansehen
            </button>
          </div>

          {digitalSignatures.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-900">{allRequiredSigned ? "Der Mietvertrag ist vollständig signiert." : "Signaturstatus"}</div>
              <div className="mt-2 grid gap-1 text-xs text-emerald-800">
                <div>1. Mieter: {tenant1Signature ? `signiert am ${formatDateTime(tenant1Signature.signedAt)}` : "offen"}</div>
                {hasSecondTenant ? <div>2. Mieter: {tenant2Signature ? `signiert am ${formatDateTime(tenant2Signature.signedAt)}` : "offen"}</div> : null}
              </div>
              {signedContract ? (
                <button
                  type="button"
                  onClick={() => downloadBase64File(signedContract.filename, signedContract.contentBase64, signedContract.contentType)}
                  className="mt-3 rounded-2xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Signierten Vertrag herunterladen
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {!allRequiredSigned ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!activeSigner ? (
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Wer unterschreibt?</h2>
                <p className="mt-1 text-xs text-slate-500">Bitte auswählen, welche Mietpartei jetzt unterschreibt.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={Boolean(tenant1Signature)}
                    onClick={() => {
                      setSelectedSigner("tenant1");
                      setSearchParams({ mieter: "1" });
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    1. Mieter
                    <span className="mt-1 block text-xs font-normal text-slate-500">{signerName(rental, "tenant1")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(tenant2Signature)}
                    onClick={() => {
                      setSelectedSigner("tenant2");
                      setSearchParams({ mieter: "2" });
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    2. Mieter
                    <span className="mt-1 block text-xs font-normal text-slate-500">{signerName(rental, "tenant2")}</span>
                  </button>
                </div>
              </div>
            ) : activeSignerSigned ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-sm font-semibold tracking-tight">{signerLabel(activeSigner)} hat bereits unterschrieben.</h2>
                <p className="mt-1 text-xs text-slate-500">Dieser Signaturlink ist für diese Mietpartei nicht erneut nutzbar.</p>
                {hasSecondTenant && activeSigner === "tenant1" && !tenant2Signature && askSecondSigner ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">Soll der 2. Mieter direkt jetzt unterschreiben?</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAskSecondSigner(false);
                          setSigned(false);
                          setAccepted(false);
                          setSelectedSigner("tenant2");
                          setSearchParams({ mieter: "2" });
                          setVersion((value) => value + 1);
                        }}
                        className="rounded-2xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-800"
                      >
                        Ja, 2. Mieter unterschreibt
                      </button>
                      <button
                        type="button"
                        onClick={() => setAskSecondSigner(false)}
                        className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                      >
                        Nein, später per Mail-Link
                      </button>
                    </div>
                  </div>
                ) : hasSecondTenant && activeSigner === "tenant1" && !tenant2Signature ? (
                  <Link
                    to={signatureUrl(rental.id, "tenant2")}
                    className="mt-3 inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    Link für 2. Mieter öffnen
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
            <h2 className="text-sm font-semibold tracking-tight">Unterschrift {signerLabel(activeSigner)}</h2>
            <p className="mt-1 text-xs text-slate-500">{signerName(rental, activeSigner)} unterschreibt jetzt verbindlich.</p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <canvas
                ref={canvasRef}
                className="block h-52 w-full touch-none bg-white"
                style={{ touchAction: "none" }}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={stop}
                onPointerCancel={stop}
                aria-label="Unterschriftenfeld"
              />
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">Unterschrift Mieter</div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
              <span>Ich habe den Mietvertrag gelesen und unterschreibe diesen verbindlich digital.</span>
            </label>

            {error ? <div className="mt-3 text-sm font-semibold text-rose-700">{error}</div> : null}
            {signed ? <div className="mt-3 text-sm font-semibold text-emerald-700">Signatur gespeichert.</div> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  clear();
                  setVersion((v) => v + 1);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Neu unterschreiben
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const canvas = canvasRef.current;
                  if (!canvas || !canvasHasInk(canvas)) {
                    setError("Bitte zuerst unterschreiben.");
                    return;
                  }
                  if (!accepted) {
                    setError("Bitte die verbindliche Signatur bestätigen.");
                    return;
                  }
                  setBusy(true);
                  setError("");
                  try {
                    const signedAt = new Date().toISOString();
                    const currentSignature: RentalDigitalSignature = {
                      signer: activeSigner,
                      signerName: signerName(rental, activeSigner),
                      signatureDataUrl: canvas.toDataURL("image/png"),
                      signedAt,
                    };
                    const nextSignatures = [...digitalSignatures.filter((signature) => signature.signer !== activeSigner), currentSignature];
                    const pdf = buildSignedRentalContractPdf(rental, nextSignatures);
                    const contentBase64 = await arrayBufferToBase64(pdf.output("arraybuffer") as ArrayBuffer);
                    const signedContractValue: RentalSignedContract = {
                      filename: `mietvertrag-signiert-${rental.id}.pdf`,
                      contentBase64,
                      contentType: "application/pdf",
                      uploadedAt: signedAt,
                      signedAt,
                      source: "digital",
                      digitalSignatures: nextSignatures,
                    };
                    await savePublicRentalSignature(rental.id, signedContractValue);
                    if (getRental(rental.id)) {
                      updateRental(rental.id, {
                        contractWorkflow: {
                          ...rental.contractWorkflow,
                          digitalSignatures: nextSignatures,
                          signedContract: signedContractValue,
                        },
                      });
                    }
                    setCompletedContract(signedContractValue);
                    setSigned(true);
                    if (activeSigner === "tenant1" && hasSecondTenant && !tenant2Signature) setAskSecondSigner(true);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "";
                    setError(message === "not_found" ? "Dieser Signaturlink ist noch nicht vorbereitet. Bitte den Versand der Mietunterlagen erneut auslösen." : message || "Signatur konnte nicht gespeichert werden.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vertrag signieren {busy ? "…" : ""}
              </button>
            </div>
              </>
            )}
          </section>
        ) : null}

        <div className="text-center">
          <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            Zur Portalübersicht
          </Link>
        </div>
      </main>
    </div>
  );
}
