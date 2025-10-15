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
    const base = { email: form.email, password: form.password };
    const valid = loginSchema.safeParse(base);
    if (!valid.success) return setError("Проверьте e-mail и пароль");
    // имитация входа
    dispatch(login({ id: crypto.randomUUID(), name: form.name || "Пользователь", email: form.email }));
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-white/10">
        <div className="flex gap-2 mb-4">
          <button className={`px-3 py-1 rounded ${mode==='login'?'bg-white/10':''}`} onClick={()=>setMode("login")}>Вход</button>
          <button className={`px-3 py-1 rounded ${mode==='register'?'bg-white/10':''}`} onClick={()=>setMode("register")}>Регистрация</button>
        </div>

        {mode==="register" && (
          <input className="w-full mb-3 px-3 py-2 rounded bg-black/20 border border-white/10" placeholder="Имя"
                 value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
        )}
        <input className="w-full mb-3 px-3 py-2 rounded bg-black/20 border border-white/10" placeholder="Email"
               value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input type="password" className="w-full mb-3 px-3 py-2 rounded bg-black/20 border border-white/10" placeholder="Пароль"
               value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>

        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <button onClick={submit} className="px-4 py-2 rounded bg-[var(--color-primary)]">Продолжить</button>
        <p className="text-sm text-white/60 mt-3">
          Без регистрации можно пройти цели и риск-профиль — сохраним во временном localStorage.
        </p>
      </div>

      <div className="hidden md:block p-6">
        <h2 className="text-2xl font-semibold text-[var(--color-primary)] mb-2">Инвестируйте с умом</h2>
        <p className="text-white/70">ИИ-помощник под ваши цели, риск-профиль и метрики портфеля.</p>
      </div>
    </div>
  );
}
