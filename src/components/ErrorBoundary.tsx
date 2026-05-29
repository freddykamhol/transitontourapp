import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: unknown | null;
  info?: { componentStack?: string | null };
};

function formatError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { name: "Error", message: typeof err === "string" ? err : JSON.stringify(err) };
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  private onWindowError = (event: ErrorEvent) => {
    this.setState({ error: event.error ?? new Error(event.message) });
  };

  private onUnhandledRejection = (event: PromiseRejectionEvent) => {
    this.setState({ error: event.reason ?? new Error("Unhandled promise rejection") });
  };

  componentDidMount() {
    window.addEventListener("error", this.onWindowError);
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onWindowError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.setState({ error, info: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const e = formatError(this.state.error);
    return (
      <div className="min-h-dvh bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold tracking-tight">Fehler beim Laden der App</div>
          <div className="mt-2 text-sm text-slate-700">
            Bitte öffne die Browser-Konsole (F12) und schicke mir die Fehlermeldung.
          </div>
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">{e.name}</div>
            <div className="mt-1 break-words font-mono text-xs text-rose-900">{e.message}</div>
          </div>
          {e.stack ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-700">
              {e.stack}
            </pre>
          ) : null}
          {this.state.info?.componentStack ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-700">
              {this.state.info.componentStack}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
