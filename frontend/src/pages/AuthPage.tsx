import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { loginUser, registerUser } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const MIN_AGE = 14;

const loginSchema = z.object({
  username: z.string().min(3, "Укажите логин (минимум 3 символа)"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Логин слишком короткий").max(50, "Логин слишком длинный"),
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  firstName: z.string().min(1, "Имя обязательно"),
  lastName: z.string().min(1, "Фамилия обязательна"),
  middleName: z.string().max(50, "Отчество слишком длинное").optional(),
  birthDate: z
    .string()
    .min(1, "Укажите дату рождения")
    .superRefine((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная дата" });
        return;
      }
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age -= 1;
      }
      if (age < MIN_AGE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Вам должно быть не менее ${MIN_AGE} лет`,
        });
      }
    }),
});

type Mode = "login" | "register";

const initialRegisterState = {
  username: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  middleName: "",
  birthDate: "",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message as string;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("next") || "/portfolios";
  const initialMode: Mode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const isLoginMode = mode === "login";
  const submitLabel = useMemo(
    () => (isLoginMode ? "Войти" : "Зарегистрироваться"),
    [isLoginMode],
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(loginForm);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Проверьте введённые данные");
      return;
    }
    try {
      await dispatch(
        loginUser({
          username: parsed.data.username.trim(),
          password: parsed.data.password,
        }),
      ).unwrap();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, "Не удалось выполнить вход"));
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(registerForm);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Проверьте введённые данные");
      return;
    }
    try {
      await dispatch(
        registerUser({
          username: parsed.data.username.trim(),
          email: parsed.data.email.trim(),
          password: parsed.data.password,
          first_name: parsed.data.firstName.trim(),
          last_name: parsed.data.lastName.trim(),
          middle_name: parsed.data.middleName?.trim() || undefined,
          birth_date: parsed.data.birthDate,
        }),
      ).unwrap();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, "Не удалось завершить регистрацию"));
    }
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFormError(null);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="card w-full max-w-2xl">
        <div className="card-header text-center">
          {isLoginMode ? "Вход в аккаунт" : "Регистрация нового пользователя"}
        </div>
        <div className="card-body space-y-6">
          <div className="flex justify-center gap-2">
            <button
              type="button"
              className={`tab ${isLoginMode ? "tab-active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={`tab ${!isLoginMode ? "tab-active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Регистрация
            </button>
          </div>

          {isLoginMode ? (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="text-xs text-muted block mb-1">
                  Логин из кабинета
                </label>
                <input
                  className="input"
                  placeholder="username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Пароль</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="current-password"
                />
              </div>
              {formError && <div className="text-sm text-danger text-center">{formError}</div>}
              <button type="submit" className="btn w-full" disabled={loading}>
                {loading ? "Отправка..." : submitLabel}
              </button>
              <p className="text-xs text-muted text-center">
                Введите логин, который вы использовали при регистрации, и пароль.
              </p>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Логин</label>
                  <input
                    className="input"
                    placeholder="username"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Email</label>
                  <input
                    className="input"
                    placeholder="name@example.com"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Имя</label>
                  <input
                    className="input"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Фамилия</label>
                  <input
                    className="input"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Отчество (опционально)</label>
                  <input
                    className="input"
                    value={registerForm.middleName}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Дата рождения</label>
                  <input
                    type="date"
                    className="input"
                    value={registerForm.birthDate}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Пароль</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Минимум 6 символов"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              {formError && <div className="text-sm text-danger text-center">{formError}</div>}
              <button type="submit" className="btn w-full" disabled={loading}>
                {loading ? "Отправка..." : submitLabel}
              </button>
              <p className="text-xs text-muted text-center">
                После регистрации вы автоматически войдёте в систему и сможете продолжить работу.
              </p>
            </form>
          )}

          <p className="text-[11px] text-muted text-center">
            Отправляя форму вы соглашаетесь на обработку персональных данных и подтверждаете, что вам исполнилось{" "}
            {MIN_AGE} лет.
          </p>
        </div>
      </div>
    </div>
  );
}
