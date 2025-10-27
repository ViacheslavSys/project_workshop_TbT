import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";

type Props = { onNavigate?: () => void };

export default function Sidebar({ onNavigate }: Props) {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const items = [
    { to: "/chat", label: "ИИ-помощник", show: true },
    { to: "/portfolios", label: "Портфели", show: true },
    { to: "/account", label: "Мой профиль", show: Boolean(isAuthenticated) },
    { to: "/auth", label: "Вход / Регистрация", show: !isAuthenticated },
  ].filter((item) => item.show);

  const initials = (user?.full_name || user?.username || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-surface/90">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <div className="text-lg font-semibold text-primary">InvestPro</div>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs">
              {initials || "?"}
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group mx-3 my-1 flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition ${
                isActive ? "bg-white/10 text-text" : "text-muted hover:bg-white/5"
              }`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-4 text-xs text-muted">
        © {new Date().getFullYear()} InvestPro
      </div>
    </div>
  );
}

