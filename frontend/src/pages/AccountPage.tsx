import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "../store/store";
import { logout, login } from "../store/authSlice";
import { Link, useNavigate } from "react-router-dom";

export default function AccountPage(){
  const { user, isAuthenticated } = useSelector((s:RootState)=> s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const loginDemo = () => {
    const now = new Date().toISOString();
    dispatch(login({
      id: crypto.randomUUID(),
      username: "demo_user",
      email: "demo@example.com",
      full_name: "Demo User",
      is_active: true,
      created_at: now,
    } as any));
    navigate('/portfolios');
  };

  const handleDelete = () => {
    if (confirm('Удалить аккаунт? Это действие необратимо.')) {
      try { sessionStorage.clear(); localStorage.clear(); } catch {}
      dispatch(logout());
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card">
          <div className="card-header text-center">Личный кабинет</div>
          <div className="card-body text-center">
            <p className="text-sm text-muted mb-4">Вы не авторизованы. Войдите или зарегистрируйтесь, чтобы просмотреть профиль.</p>
            <div className="flex gap-2 justify-center">
              <Link to="/auth" className="btn">Перейти к входу</Link>
              <button onClick={loginDemo} className="tab">Войти как Demo</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const created = user.created_at ? new Date(user.created_at) : null;
  const statusBadge = (
    <span className={`px-2 py-0.5 rounded text-xs border ${user.is_active ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`}>
      {user.is_active ? 'Активен' : 'Неактивен'}
    </span>
  );

  const name = user.full_name || user.username;
  const initials = (name || "").split(/\s+/).map(s=>s[0]).join("").slice(0,2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto grid gap-4">
      <div className="card">
        <div className="card-header text-center">Личный кабинет</div>
        <div className="card-body text-center">
          <div className="grid place-items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/10 grid place-items-center text-lg font-medium">
              {initials || '•'}
            </div>
            <div>
              <div className="text-xl font-semibold">{name || 'Пользователь'}</div>
              <div className="text-sm text-muted">{user.email}</div>
            </div>
            <div>{statusBadge}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">Имя пользователя</div>
              <div className="text-sm">{user.username}</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-white/5">
              <div className="text-xs text-muted mb-1">На платформе с</div>
              <div className="text-sm">{created ? created.toLocaleDateString() : '—'}</div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button className="tab" onClick={()=>dispatch(logout())}>Выйти</button>
            <button className="px-4 py-2 text-sm rounded-xl border border-danger text-danger hover:bg-danger/10 transition" onClick={handleDelete}>Удалить аккаунт</button>
          </div>
        </div>
      </div>
    </div>
  );
}
