import { useState } from "react";
import { useDispatch } from "react-redux";
import { login } from "../store/authSlice";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export default function AuthPage() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState<string|undefined>();
  const dispatch = useDispatch();

  const submit = () => {
    setError(undefined);
    const valid = loginSchema.safeParse({ email: form.email, password: form.password });
    if (!valid.success) return setError("Проверьте e-mail и пароль");
    dispatch(login({ id: crypto.randomUUID(), name: form.name || "Пользователь", email: form.email }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card">
        <div className="card-header">Доступ к аккаунту</div>
        <div className="card-body">
          <div className="flex gap-2 mb-4">
            <button className={`tab ${mode==='login' ? 'tab-active' : ''}`} onClick={()=>setMode("login")}>Вход</button>
            <button className={`tab ${mode==='register' ? 'tab-active' : ''}`} onClick={()=>setMode("register")}>Регистрация</button>
          </div>

          {mode==="register" && (
            <input className="input mb-3" placeholder="Имя"
                   value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          )}
          <input className="input mb-3" placeholder="Email"
                 value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
          <input type="password" className="input mb-3" placeholder="Пароль"
                 value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>

          {error && <div className="text-danger text-sm mb-3">{error}</div>}
          <button onClick={submit} className="btn">Продолжить</button>
          <p className="text-xs text-muted mt-3">
            Без регистрации можно пройти цели и риск-профиль — сохраним во временном localStorage.
          </p>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="card h-full">
          <div className="card-body flex flex-col justify-center">
            <h2 className="text-2xl font-semibold text-primary mb-2">Инвестируйте с умом</h2>
            <p className="text-muted">ИИ-помощник под ваши цели, риск-профиль и метрики портфеля.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
