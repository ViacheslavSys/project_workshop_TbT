import { type PropsWithChildren, useState } from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-bg text-text flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:block sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Sidebar (mobile drawer) */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-80 bg-surface border-r border-border transition-transform
                      ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar (mobile+tablet) */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface border-b border-border">
          <div className="container-app h-14 flex items-center justify-between">
            <button aria-label="Открыть меню"
                    onClick={() => setOpen(true)}
                    className="h-9 w-9 grid place-items-center rounded-lg bg-white/5">
              ☰
            </button>
            <div className="text-base font-semibold text-primary">📊 InvestPro</div>
            <div className="h-9 w-9" />
          </div>
        </header>

        <main className="flex-1 py-6">
          <div className="container-app">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
