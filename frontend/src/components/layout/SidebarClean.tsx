import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";

type Props = { onNavigate?: () => void };

export default function Sidebar({ onNavigate }: Props) {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const items = [
    { to: "/portfolios", label: "Портфели", show: true },
    { to: "/chat", label: "Чат", show: true },
    { to: "/account", label: "Личный кабинет", show: !!isAuthenticated },
    { to: "/auth", label: "Вход / Регистрация", show: !isAuthenticated },
  ].filter(i => i.show);

  const initials = (user?.full_name || user?.username || "").split(/\s+/).map(s=>s[0]).join("").slice(0,2).toUpperCase();

  return (
    <div className="h-screen w-64 bg-surface/90 border-r border-border flex flex-col">
      <div className="h-16 flex items-center px-5 border-b border-border justify-between">
        <div className="text-lg font-semibold text-primary">InvestPro</div>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-xs">
              {initials || "•"}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-2 mx-3 my-1 rounded-xl text-sm transition
               ${isActive ? 'bg-white/10 text-text' : 'hover:bg-white/5 text-muted'}`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t border-border">
        <div className="text-xs text-muted">© {new Date().getFullYear()} InvestPro</div>
      </div>
    </div>
  );
}
