import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login as loginAction } from "../store/authSlice";
import { z } from "zod";
import { initFakeUsers, login as fakeLogin, register as fakeRegister } from "../lib/fakeAuth";

const schema = z.object({ email: z.string().email(), password: z.string().min(3) });

export default function AuthPage() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState<string|undefined>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  useEffect(() => {
    initFakeUsers();
    const m = sp.get("mode");
    if (m === "register") setMode("register");
  }, [sp]);

  const submit = () => {
    setError(undefined);
    const valid = schema.safeParse({ email: form.email, password: form.password });
    if (!valid.success) return setError("Введите корректный email и пароль (минимум 3 символа)");
    try {
      const user = mode === "login"
        ? fakeLogin(form.email.trim(), form.password)
        : fakeRegister(form.name.trim() || form.email.split("@")[0], form.email.trim(), form.password);
      dispatch(loginAction({ id: user.id, name: user.name, email: user.email }));
      navigate("/chat");
    } catch (e:any) {
      setError(e?.message || "Ошибка авторизации");
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="card-header text-center">Вход в InvestPro</div>
        <div className="card-body">
          <div className="flex gap-2 mb-4 justify-center">
            <button className={`tab ${mode==='login' ? 'tab-active' : ''}`} onClick={()=>setMode("login")}>Войти</button>
            <button className={`tab ${mode==='register' ? 'tab-active' : ''}`} onClick={()=>setMode("register")}>Зарегистрироваться</button>
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

          <div className="text-xs text-muted mt-4 space-y-1">
            <div className="text-center">Демо-доступ: <span className="font-mono">test@mail.ru / 123</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

