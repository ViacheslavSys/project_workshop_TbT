import { type PropsWithChildren, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./SidebarClean";

export default function Layout({ children }: PropsWithChildren) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full bg-bg text-text">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-border bg-surface/90 backdrop-blur md:block">
        <Sidebar />
      </aside>

      {/* Mobile navigation drawer */}
      <div className="md:hidden">
        <div
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
            mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`fixed left-0 top-0 z-50 h-full w-72 max-w-[80%] border-r border-border bg-surface/95 backdrop-blur transition-transform duration-200 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="relative h-full">
            <Sidebar
              onNavigate={() => setMobileNavOpen(false)}
              className="border-r-0"
            />
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg/80 text-text hover:bg-white/5"
              onClick={() => setMobileNavOpen(false)}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l10 10M15 5l-10 10" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/80 text-text hover:bg-white/5 focus-visible:outline-none md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h14M3 10h14M3 14h14" />
                </svg>
              </button>
              <div className="text-lg font-semibold text-primary">InvestPro</div>
            </div>
            <div className="hidden text-xs text-muted sm:block">v0.1</div>
          </div>
        </header>

        <main className="flex-1 py-6 sm:py-8">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

