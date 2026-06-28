import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { navItems, type NavItem } from "../nav";
import { listRequests } from "../api/portalApi";
import { runDueRentalReminders } from "../pages/rentals/rentalReminderScheduler";
import { latestRelease } from "../releaseNotes";

const defaultBrand = "Transit on Tour!";
const changelogSeenKey = `tot.changelog.seen.${latestRelease.id}`;

function shouldShowChangelog(): boolean {
  try {
    return localStorage.getItem(changelogSeenKey) !== "1";
  } catch {
    return true;
  }
}

function getBrandText(): string {
  const brand = (import.meta.env.VITE_PORTAL_BRAND as string | undefined)?.trim();
  return brand && brand.length > 0 ? brand : defaultBrand;
}

function getPageTitle(pathname: string, items: NavItem[]): string {
  if (pathname === "/") return "Dashboard";
  const match = items.find((item) => `/${item.to}` === pathname);
  if (pathname.startsWith("/fahrzeug")) return "Inventar";
  return match?.label ?? "Seite";
}

export default function AppLayout() {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname, navItems);
  const brandText = getBrandText();
  const [newRequestCount, setNewRequestCount] = useState<number | null>(null);
  const [showChangelog, setShowChangelog] = useState(shouldShowChangelog);

  const navBadges = useMemo(() => {
    return {
      anfragen: newRequestCount,
    } as Record<string, number | null>;
  }, [newRequestCount]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const items = await listRequests({ status: "neu", limit: 500 });
        if (!alive) return;
        setNewRequestCount(items.length);
      } catch {
        if (!alive) return;
        setNewRequestCount(null);
      }
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    void runDueRentalReminders();
    const t = window.setInterval(() => {
      void runDueRentalReminders();
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  function closeChangelog(): void {
    try {
      localStorage.setItem(changelogSeenKey, "1");
    } catch {
      // Popup wird trotzdem geschlossen, wenn der Browser Speicher blockiert.
    }
    setShowChangelog(false);
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="flex min-h-dvh">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/80 px-4 py-5 backdrop-blur lg:block">
          <div className="px-2 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verwaltung</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="text-sm font-semibold tracking-tight text-slate-900">{brandText}</div>
              <div className="text-xs text-slate-500">Vermietungsportal</div>
            </div>
          </div>
          <nav className="grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to === "/" ? "/" : `/${item.to}`}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "group relative rounded-2xl px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")
                }
              >
                <span className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-slate-900 opacity-0 transition group-aria-[current=page]:opacity-100" />
                <span className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-slate-500 transition group-hover:text-slate-700 group-aria-[current=page]:text-slate-900" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.to !== "/" && navBadges[item.to] && navBadges[item.to]! > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {navBadges[item.to]! > 99 ? "99+" : navBadges[item.to]}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-4 backdrop-blur sm:px-6">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">{pageTitle}</h1>
                <p className="mt-0.5 truncate text-xs text-slate-500">Verwaltungsportal Autovermietung</p>
              </div>

              <div className="shrink-0 text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-slate-900" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-900">Admin</span>
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 pb-24 sm:px-6 lg:pb-6">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/80 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1 px-2 py-1.5">
          {navItems.map((item) => (
            <NavLink
              key={`mobile-${item.to}`}
              to={item.to === "/" ? "/" : `/${item.to}`}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-semibold leading-none transition",
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      "relative grid h-9 w-10 place-items-center rounded-2xl transition",
                      isActive ? "bg-slate-900 text-white shadow-sm" : "bg-transparent",
                    ].join(" ")}
                  >
                    <item.icon className={["h-5 w-5 transition", isActive ? "scale-105" : "scale-100"].join(" ")} />
                    {item.to !== "/" && navBadges[item.to] && navBadges[item.to]! > 0 ? (
                      <span className="absolute right-2 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[9px] font-bold text-white">
                        {navBadges[item.to]! > 99 ? "99+" : navBadges[item.to]}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={[
                      "max-w-full truncate transition hidden sm:block",
                      isActive ? "text-slate-900" : "text-slate-600",
                    ].join(" ")}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {showChangelog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Neu im Portal · {latestRelease.date}</div>
              <h2 id="release-notes-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                {latestRelease.title}
              </h2>
            </div>
            <div className="px-5 py-5">
              <ul className="grid gap-3 text-sm text-slate-700">
                {latestRelease.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-900" aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Dieser Hinweis erscheint pro Gerät/Browser einmal je Release.
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeChangelog}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
