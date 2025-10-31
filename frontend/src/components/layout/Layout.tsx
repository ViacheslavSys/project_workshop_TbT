import { type PropsWithChildren } from "react";
import Sidebar from "./SidebarClean";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen w-full bg-bg text-text">
      {/* Fixed vertical navigation */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-surface/90 border-r border-border backdrop-blur">
        <Sidebar />
      </aside>

      {/* Centered content area */}
      <div className="ml-64">
        <header className="sticky top-0 z-20 bg-bg/60 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="text-lg font-semibold text-primary">InvestPro</div>
            <div className="text-xs text-muted">v0.1</div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] py-8">
          <div className="max-w-7xl mx-auto px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

