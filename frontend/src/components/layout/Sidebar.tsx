import { NavLink } from "react-router-dom";

type Props = { onNavigate?: () => void };

const nav = [
  { to: "/", label: "Вход" , icon: "👤" },
  { to: "/chat", label: "ИИ-помощник", icon: "🤖" },
  { to: "/portfolios", label: "Портфели", icon: "📈" },
];

export default function Sidebar({ onNavigate }: Props) {
  return (
    <div className="h-screen w-80 bg-surface border-r border-border flex flex-col">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <div className="text-lg font-semibold text-primary">📊 InvestPro</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-2.5 mx-3 my-1 rounded-xl
               text-sm transition border border-transparent
               ${isActive ? 'bg-white/10 border-border' : 'hover:bg-white/5 text-muted'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t border-border">
        <div className="text-xs text-muted">v0.1 • тёмная тема</div>
      </div>
    </div>
  );
}
