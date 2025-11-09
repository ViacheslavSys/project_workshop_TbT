import { NavLink } from "react-router-dom";
import { useAppSelector } from "../../app/store/hooks";

type Props = { onNavigate?: () => void };

const NAV_ITEMS = [
  { to: "/chat", label: "Чат с ассистентом", authOnly: null },
  { to: "/portfolios", label: "Портфели", authOnly: null },
  { to: "/account", label: "Мой профиль", authOnly: true },
  { to: "/auth", label: "Вход / регистрация", authOnly: false },
] as const;

export default function Sidebar({ onNavigate }: Props) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const initials = (user?.full_name || user?.username || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const items = NAV_ITEMS.filter((item) => {
    if (item.authOnly === null) return true;
    return item.authOnly ? isAuthenticated : !isAuthenticated;
  });

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
        {"\u00A9"} {new Date().getFullYear()} InvestPro
      </div>
    </div>
  );
}
