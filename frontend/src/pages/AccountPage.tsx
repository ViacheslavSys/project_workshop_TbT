import { Link, useNavigate } from "react-router-dom";
import { fetchCurrentUser, logout } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function AccountPage() {
  const { user, isAuthenticated, loading, error, initialized } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    dispatch(logout());
    navigate("/auth");
  };

  const handleRefresh = () => {
    void dispatch(fetchCurrentUser());
  };

  const handleResetLocal = () => {
    if (!window.confirm("Очистить локальные данные и выйти из аккаунта?")) {
      return;
    }
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      /* ignore */
    }
    dispatch(logout());
  };

  if (!initialized && loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted">
        Загружаем профиль...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card">
          <div className="card-header text-center">Авторизация</div>
          <div className="card-body text-center space-y-4">
            <p className="text-sm text-muted">
              Чтобы увидеть данные профиля, войдите в аккаунт или зарегистрируйтесь. После авторизации все сервисы
              InvestPro станут доступны полностью.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="btn">
                Перейти к форме входа
              </Link>
              <Link to="/auth?mode=register" className="tab">
                Создать новый профиль
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ") || user.username;
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || user.username.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto grid gap-4">
      <div className="card">
        <div className="card-header text-center">Мой профиль</div>
        <div className="card-body space-y-6">
          <div className="grid place-items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 grid place-items-center text-xl font-semibold">
              {initials}
            </div>
            <div className="text-center space-y-1">
              <div className="text-2xl font-semibold">{fullName}</div>
              <div className="text-sm text-muted">{user.email}</div>
            </div>
            <span
              className={`px-3 py-0.5 text-xs rounded-full border ${
                user.is_active ? "border-green-500 text-green-400" : "border-red-500 text-red-400"
              }`}
            >
              {user.is_active ? "Активен" : "Деактивирован"}
            </span>
          </div>

          {error && <div className="text-sm text-danger text-center">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Логин</div>
              <div className="text-sm">{user.username}</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Email</div>
              <div className="text-sm">{user.email}</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Дата рождения</div>
              <div className="text-sm">{formatDate(user.birth_date)}</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Возраст</div>
              <div className="text-sm">{user.age} лет</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Дата регистрации</div>
              <div className="text-sm">{formatDate(user.created_at)}</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Статус</div>
              <div className="text-sm">
                {user.is_active ? "Профиль активен" : "Профиль отключён"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="tab" onClick={handleRefresh} disabled={loading}>
              {loading ? "Обновляем..." : "Обновить данные"}
            </button>
            <button type="button" className="btn" onClick={handleLogout}>
              Выйти
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-xl border border-danger text-danger hover:bg-danger/10 transition"
              onClick={handleResetLocal}
            >
              Очистить локальные данные
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
