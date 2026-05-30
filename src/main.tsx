import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

function renderFatal(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? "" : "";
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#f8fafc;color:#0f172a;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <div style="max-width:900px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 1px 2px rgba(15,23,42,.06)">
        <div style="font-size:14px;font-weight:700">Fehler beim Starten der App</div>
        <div style="margin-top:8px;font-size:13px;color:#334155">Bitte Browser-Konsole öffnen (F12) und diese Meldung schicken.</div>
        <div style="margin-top:16px;background:#fff1f2;border:1px solid #fecdd3;border-radius:16px;padding:16px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#be123c">Error</div>
          <div style="margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;white-space:pre-wrap;color:#881337">${message}</div>
        </div>
        ${stack ? `<pre style="margin-top:16px;max-height:40vh;overflow:auto;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:16px;padding:16px;font-size:11px;color:#334155;white-space:pre-wrap">${stack}</pre>` : ""}
      </div>
    </div>
  `;
}

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element #root not found");
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (e) {
  renderFatal(e);
}
