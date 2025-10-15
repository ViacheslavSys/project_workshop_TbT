import { Outlet, Link, useLocation } from "react-router-dom";

export default function App() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-semibold text-[var(--color-primary)]">📊 InvestPro</span>
          <div className="flex gap-2">
            <Link className={`px-3 py-1 rounded ${pathname==='/'?'bg-white/10':''}`} to="/">Вход</Link>
            <Link className={`px-3 py-1 rounded ${pathname.startsWith('/chat')?'bg-white/10':''}`} to="/chat">ИИ-помощник</Link>
            <Link className={`px-3 py-1 rounded ${pathname.startsWith('/portfolios')?'bg-white/10':''}`} to="/portfolios">Портфели</Link>
          </div>
        </div>
      </nav>
      <main className="flex-1 mx-auto max-w-6xl w-full p-4">
        <Outlet/>
      </main>
    </div>
  );
}
