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
    if (!valid.success) return setError("Введите корректный email и пароль (мин. 6 символов)");
    dispatch(login({ id: crypto.randomUUID(), name: form.name || "Гость", email: form.email }));
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="card-header text-center">Вход в InvestPro</div>
        <div className="card-body">
          <div className="flex gap-2 mb-4 justify-center">
            <button className={`tab ${mode==='login' ? 'tab-active' : ''}`} onClick={()=>setMode("login")}>Вход</button>
            <button className={`tab ${mode==='register' ? 'tab-active' : ''}`} onClick={()=>setMode("register")}>Регистрация</button>
          </div>

          {mode==="register" && (
            <input className="input mb-3" placeholder="Ваше имя"
                   value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          )}
          <input className="input mb-3" placeholder="Email"
                 value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
          <input type="password" className="input mb-3" placeholder="Пароль"
                 value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>

          {error && <div className="text-danger text-sm mb-3 text-center">{error}</div>}
          <button onClick={submit} className="btn w-full">Продолжить</button>
          <p className="text-xs text-muted mt-3 text-center">
            Демонстрационная авторизация: данные сохраняются локально в браузере.
          </p>
        </div>
      </div>
    </div>
  );
}
