import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../store/authSlice";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export default function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login"|"register">(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState<string|undefined>();
  const dispatch = useDispatch();

  const submit = () => {
    setError(undefined);
    const valid = loginSchema.safeParse({ email: form.email, password: form.password });
    if (!valid.success) return setError("Неверный email или короткий пароль (мин. 6 символов)");
    const now = new Date().toISOString();
    const uname = (form.name || form.email.split("@")[0] || "user").slice(0, 20);
    dispatch(login({
      id: crypto.randomUUID(),
      username: uname,
      email: form.email,
      full_name: form.name || undefined,
      is_active: true,
      created_at: now,
    } as any));
    navigate("/portfolios");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="card-header text-center">Вход / Регистрация</div>
        <div className="card-body text-center">
          <div className="flex gap-2 mb-4 justify-center">
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

          {error && <div className="text-danger text-sm mb-3 text-center">{error}</div>}
          <button onClick={submit} className="btn w-full">Продолжить</button>
          <p className="text-xs text-muted mt-3 text-center">
            Тестовая авторизация: данные сохраняются только в состоянии приложения.
          </p>
        </div>
      </div>
    </div>
  );
}
