import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { flushPendingPortfolioSaves } from "../shared/pendingPortfolioSaves";
import { loginUser, registerUser } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import userAgreementRaw from "../../administrative_documents/user_agreement.txt?raw";
const MIN_AGE = 14;
type AgreementParagraph =
  | { kind: "text"; text: string }
  | { kind: "subpoint"; label: string; text: string }
  | { kind: "list-item"; text: string };
type AgreementSection = {
  heading: string;
  paragraphs: AgreementParagraph[];
};
type AgreementContent = {
  title: string;
  subtitle: string;
  introduction: string[];
  sections: AgreementSection[];
};
const SECTION_HEADING_REGEX = /^\d+\.\s/;
const SUB_POINT_REGEX = /^\d+(?:\.\d+)+\./;
const LIST_ITEM_REGEX = /^[\-\u2022\u2013\u2014•—]\s*/;
const AGREEMENT_CONTENT = parseAgreementContent(userAgreementRaw);
function parseAgreementContent(raw: string): AgreementContent {
  const normalizedLines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim());
  const firstLineIndex = normalizedLines.findIndex((line) => line.length > 0);
  const title = firstLineIndex >= 0 ? normalizedLines[firstLineIndex] : "";
  let subtitleIndex = firstLineIndex + 1;
  while (
    subtitleIndex < normalizedLines.length &&
    !normalizedLines[subtitleIndex]
  ) {
    subtitleIndex += 1;
  }
  const subtitle =
    subtitleIndex < normalizedLines.length
      ? normalizedLines[subtitleIndex]
      : "";
  const bodyLines = normalizedLines.slice(subtitleIndex + 1);
  const entries: string[] = [];
  let buffer: string[] = [];
  const flushBuffer = () => {
    if (buffer.length) {
      entries.push(buffer.join(" "));
      buffer = [];
    }
  };
  bodyLines.forEach((line) => {
    if (!line) {
      flushBuffer();
      return;
    }
    if (
      SECTION_HEADING_REGEX.test(line) ||
      SUB_POINT_REGEX.test(line) ||
      LIST_ITEM_REGEX.test(line)
    ) {
      flushBuffer();
      entries.push(line);
      return;
    }
    buffer.push(line);
  });
  flushBuffer();
  const introduction: string[] = [];
  const sections: AgreementSection[] = [];
  let currentSection: AgreementSection | null = null;
  let hasSection = false;
  entries.forEach((entry) => {
    if (SECTION_HEADING_REGEX.test(entry)) {
      hasSection = true;
      currentSection = { heading: entry, paragraphs: [] };
      sections.push(currentSection);
      return;
    }
    if (!hasSection) {
      introduction.push(entry);
      return;
    }
    if (!currentSection) {
      currentSection = { heading: "", paragraphs: [] };
      sections.push(currentSection);
    }
    if (SUB_POINT_REGEX.test(entry)) {
      const labelMatch = entry.match(SUB_POINT_REGEX);
      const label = labelMatch ? labelMatch[0].replace(/\.$/, "") : "";
      const textPart = entry
        .slice(labelMatch ? labelMatch[0].length : 0)
        .trim();
      currentSection.paragraphs.push({
        kind: "subpoint",
        label,
        text: textPart,
      });
      return;
    }
    if (LIST_ITEM_REGEX.test(entry)) {
      const textPart = entry.replace(LIST_ITEM_REGEX, "").trim();
      currentSection.paragraphs.push({ kind: "list-item", text: textPart });
      return;
    }
    currentSection.paragraphs.push({ kind: "text", text: entry });
  });
  return {
    title,
    subtitle,
    introduction,
    sections,
  };
}
const loginSchema = z.object({
  username: z.string().min(3, "Укажите логин (минимум 3 символа)"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});
const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Логин слишком короткий")
    .max(50, "Логин слишком длинный"),
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Некорректная дата",
        });
        return;
      }
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < date.getDate())
      ) {
        age -= 1;
      }
      if (age < MIN_AGE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Вам должно быть не менее ${MIN_AGE} лет`,
        });
      }
    }),
  agreementAccepted: z.boolean().refine((value) => value, {
    message: "Подтвердите, что вы ознакомились с пользовательским соглашением",
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
  agreementAccepted: false,
};
const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as any).message === "string"
  ) {
    return (error as any).message as string;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};
function renderSectionParagraphs(section: AgreementSection) {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < section.paragraphs.length; index += 1) {
    const paragraph = section.paragraphs[index];
    if (paragraph.kind === "list-item") {
      const listItems = [paragraph.text];
      while (
        index + 1 < section.paragraphs.length &&
        section.paragraphs[index + 1].kind === "list-item"
      ) {
        listItems.push(section.paragraphs[index + 1].text);
        index += 1;
      }
      nodes.push(
        <ul
          key={`${section.heading}-list-${index}`}
          className="list-disc pl-5 text-sm leading-relaxed space-y-1 text-muted"
        >
          {listItems.map((item, itemIndex) => (
            <li key={`${section.heading}-list-${index}-${itemIndex}`}>
              {item}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (paragraph.kind === "subpoint") {
      nodes.push(
        <p
          key={`${section.heading}-${paragraph.label}`}
          className="text-sm leading-relaxed"
        >
          <span className="font-semibold text-primary">{paragraph.label}</span>{" "}
          {paragraph.text}
        </p>,
      );
      continue;
    }
    nodes.push(
      <p
        key={`${section.heading}-text-${index}`}
        className="text-sm leading-relaxed"
      >
        {paragraph.text}
      </p>,
    );
  }
  return nodes;
}
export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("next") || "/portfolios";
  const initialMode: Mode =
    searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [isAgreementModalOpen, setAgreementModalOpen] = useState(false);
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
  const isRegisterSubmitDisabled = loading || !registerForm.agreementAccepted;
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(loginForm);
    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Проверьте введённые данные",
      );
      return;
    }
    try {
      const payload = await dispatch(
        loginUser({
          username: parsed.data.username.trim(),
          password: parsed.data.password,
        }),
      ).unwrap();
      if (payload.token) {
        try {
          await flushPendingPortfolioSaves(payload.token);
        } catch (flushError) {
          // eslint-disable-next-line no-console
          console.error("Failed to save portfolio after login", flushError);
        }
      }
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
      setFormError(
        parsed.error.issues[0]?.message ?? "Проверьте введённые данные",
      );
      return;
    }
    try {
      const payload = await dispatch(
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
      if (payload.token) {
        try {
          await flushPendingPortfolioSaves(payload.token);
        } catch (flushError) {
          // eslint-disable-next-line no-console
          console.error("Failed to save portfolio after registration", flushError);
        }
      }
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
    <>
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
                    onChange={(e) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    autoComplete="current-password"
                  />
                </div>
                {formError && (
                  <div className="text-sm text-danger text-center">
                    {formError}
                  </div>
                )}
                <button type="submit" className="btn w-full" disabled={loading}>
                  {loading ? "Отправка..." : submitLabel}
                </button>
                <p className="text-xs text-muted text-center">
                  Введите логин, который вы использовали при регистрации, и
                  пароль.
                </p>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Логин
                    </label>
                    <input
                      className="input"
                      placeholder="username"
                      value={registerForm.username}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Email
                    </label>
                    <input
                      className="input"
                      placeholder="name@example.com"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Фамилия
                    </label>
                    <input
                      className="input"
                      value={registerForm.lastName}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Отчество (опционально)
                    </label>
                    <input
                      className="input"
                      value={registerForm.middleName}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          middleName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">
                      Дата рождения
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={registerForm.birthDate}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          birthDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Минимум 6 символов"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-muted/30 bg-muted/10 p-3">
                  <input
                    id="agreement-checkbox"
                    type="checkbox"
                    className="mt-1"
                    checked={registerForm.agreementAccepted}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        agreementAccepted: e.target.checked,
                      }))
                    }
                  />
                  <label
                    htmlFor="agreement-checkbox"
                    className="text-xs text-muted leading-relaxed"
                  >
                    Подтверждаю, что ознакомился с пользовательским соглашением.{" "}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => setAgreementModalOpen(true)}
                    >
                      Ознакомиться с пользовательским соглашением
                    </button>
                  </label>
                </div>
                {formError && (
                  <div className="text-sm text-danger text-center">
                    {formError}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isRegisterSubmitDisabled}
                  aria-disabled={isRegisterSubmitDisabled}
                  title={
                    isRegisterSubmitDisabled
                      ? "Подтвердите ознакомление с пользовательским соглашением"
                      : undefined
                  }
                >
                  {loading ? "Отправка..." : submitLabel}
                </button>
                <p className="text-xs text-muted text-center">
                  После регистрации вы автоматически войдёте в систему и сможете
                  продолжить работу.
                </p>
              </form>
            )}
            <p className="text-[11px] text-muted text-center">
              Отправляя форму вы соглашаетесь на обработку персональных данных и
              подтверждаете, что вам исполнилось {MIN_AGE} лет.
            </p>
          </div>
        </div>
      </div>
      {isAgreementModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Пользовательское соглашение"
        >
          <div className="card w-full max-w-4xl max-h-[90vh]">
            <div className="card-header flex items-center justify-between gap-4">
              <span>Пользовательское соглашение</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAgreementModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
            <div className="card-body h-[70vh] p-0">
              <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
                <div>
                  <div className="text-lg font-semibold">
                    {AGREEMENT_CONTENT.title}
                  </div>
                  {AGREEMENT_CONTENT.subtitle && (
                    <div className="text-xs text-muted mt-1">
                      {AGREEMENT_CONTENT.subtitle}
                    </div>
                  )}
                </div>
                {AGREEMENT_CONTENT.introduction.map((paragraph, index) => (
                  <p key={`intro-${index}`} className="text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                {AGREEMENT_CONTENT.sections.map((section, sectionIndex) => (
                  <section
                    key={section.heading || `section-${sectionIndex}`}
                    className="space-y-2"
                  >
                    {section.heading && (
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                        {section.heading}
                      </h3>
                    )}
                    <div className="space-y-2">
                      {renderSectionParagraphs(section)}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
