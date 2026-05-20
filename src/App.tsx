export default function App() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold tracking-wide text-zinc-400">transitontourapp</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">React + Tailwind</h1>
          <p className="max-w-2xl text-base text-zinc-300">
            Starter-Projekt mit Vite, React (TypeScript) und Tailwind.
          </p>
        </header>

        <main className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href="https://react.dev"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold">React Docs</p>
            <p className="mt-1 text-sm text-zinc-300">Komponenten, Hooks, Patterns.</p>
          </a>
          <a
            href="https://tailwindcss.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold">Tailwind Docs</p>
            <p className="mt-1 text-sm text-zinc-300">Utility-First Styling.</p>
          </a>
        </main>
      </div>
    </div>
  );
}
