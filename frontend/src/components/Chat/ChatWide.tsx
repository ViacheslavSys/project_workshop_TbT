import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../../store/store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { setMessages } from "../../store/chatSlice";
import { Link } from "react-router-dom";

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const WS_URL = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000/ws";
const steps = [
  { id: "goals", label: "Определение целей" },
  { id: "risk", label: "Риск‑профиль" },
  { id: "portfolio", label: "Создание портфеля" },
] as const;

export default function ChatWide() {
  const dispatch = useDispatch();
  const { messages, typing, stage, isAuth } = useSelector((s: RootState) => ({
    messages: s.chat.messages,
    typing: s.chat.typing,
    stage: s.chat.stage,
    isAuth: s.auth.isAuthenticated,
  }));

  const { sendMessage } = useWebSocket(WS_URL);

  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing]);

  // Ре-гидратация истории из sessionStorage
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem("chat_history");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) dispatch(setMessages(arr));
      }
    } catch {}
  }, [dispatch]);

  // Сохранение истории
  useEffect(() => {
    try { sessionStorage.setItem("chat_history", JSON.stringify(messages)); } catch {}
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    if (text === "/risk") {
      sendMessage({}, "start_risk");
      setDraft("");
      return;
    }
    sendMessage(text, "message");
    setDraft("");
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const base64 = await blobToBase64(blob);
      sendMessage({ mime: "audio/webm", data: base64 }, "audio");
      setIsRecording(false);
    };
    mr.start();
    setIsRecording(true);
  };
  const stopRecording = () => mediaRecorderRef.current?.stop();

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>Chat Assistant</div>
        {typing && <div className="text-xs text-muted">Assistant is typing...</div>}
      </div>
      <div className="card-body">
        <div className="flex gap-4">
          {/* Боковое меню этапов */}
          <aside className="w-56 hidden md:block bg-white/5 border border-border rounded-2xl p-3">
            <div className="text-xs text-muted mb-2">Этапы</div>
            <nav className="space-y-1">
              {steps.map((st) => (
                <button
                  key={st.id}
                  className={classNames(
                    "w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition",
                    stage === st.id ? "bg-white/10 text-text" : "text-muted"
                  )}
                  onClick={() => { if (st.id === "risk") sendMessage({}, "start_risk"); }}
                >
                  {st.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Столбец чата */}
          <div className="flex-1 flex flex-col h-[70vh]">
            <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    sender={m.sender}
                    type={m.type}
                    content={m.content}
                    isAuth={isAuth}
                    onRiskAnswer={(qid, answers)=>sendMessage({ questionId: qid, answers }, "risk_answer", { echo: false })}
                  />
                ))}
              </div>
            </div>

            {stage !== "risk" && (
              <div className="mt-3 flex items-end gap-2">
                <button
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={classNames(
                    "h-11 w-11 rounded-full border border-border grid place-items-center",
                    isRecording ? "bg-danger/30 text-danger" : "bg-black/20 text-muted hover:text-text"
                  )}
                >
                  {isRecording ? "■" : "🎤"}
                </button>

                <textarea
                  placeholder='Type your message... (или введите "/risk")'
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={2}
                  className="input min-h-10 max-h-36 flex-1 resize-y"
                />

                <button onClick={handleSend} className="btn">Send</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ sender, type, content, isAuth, onRiskAnswer }: { sender: "user" | "ai"; type: string; content: unknown; isAuth?: boolean; onRiskAnswer?: (qid:string, answers:string[])=>void }) {
  const isUser = sender === "user";
  let body: React.ReactNode;
  if (type === "risk_questions" && content && typeof content === "object") {
    body = <RiskFormMessage payload={content as any} onSubmit={onRiskAnswer}/>;
  } else if (type === "risk_result" && content && typeof content === "object") {
    body = <RiskResultMessage payload={content as any} />;
  } else if (type === "portfolio_recommendation" && content && typeof content === "object") {
    const p = (content as any).portfolio || (content as any);
    body = <PortfolioMessage portfolio={p} isAuth={!!isAuth} />;
  } else if (type === "audio" && content && typeof content === "object" && (content as any).data) {
    const c = content as { data: string; mime?: string };
    const src = `data:${c.mime || "audio/webm"};base64,${c.data}`;
    body = <audio controls src={src} className="max-w-full" />;
  } else {
    const text = typeof content === "string" ? content : JSON.stringify(content);
    body = <div className="whitespace-pre-wrap break-words">{text}</div>;
  }
  return (
    <div className={classNames("flex", isUser ? "justify-end" : "justify-start")}> 
      <div className={classNames("max-w-[80%] px-3 py-2 rounded-xl border", isUser ? "bg-primary/15 border-transparent" : "bg-white/5 border-border")}>
        {body}
      </div>
    </div>
  );
}

function RiskFormMessage({ payload, onSubmit }:{ payload: any; onSubmit?: (qid: string, answers: string[])=>void }){
  const q = Array.isArray(payload?.questions) && payload.questions.length ? payload.questions[0] : undefined;
  const [checked, setChecked] = useState<string[]>([]);
  if (!q) return <div className="text-sm text-muted">Нет доступных вопросов.</div>;
  const toggle = (id:string) => {
    setChecked(prev => {
      if (q.multiSelect) return prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id];
      return prev.includes(id) ? [] : [id];
    });
  };
  return (
    <div>
      <div className="font-medium mb-2">{q.question || "Выберите вариант"}</div>
      <div className="space-y-2">
        {q.options?.map((opt:any)=> (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-blue-500" checked={checked.includes(opt.id)} onChange={()=>toggle(opt.id)} />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <button className="btn" onClick={()=> onSubmit?.(q.id, checked)} disabled={!checked.length}>Отправить</button>
      </div>
    </div>
  );
}

function RiskResultMessage({ payload }:{ payload: any }){
  const score = Number(payload?.score ?? 0);
  const profile = String(payload?.profile ?? "—");
  const band = score <= 35 ? "Низкий" : score <= 65 ? "Умеренный" : "Высокий";
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted">Ваш риск‑профиль</div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded-lg bg-white/10 border border-border text-sm">{profile}</span>
        <span className="text-xs text-muted">({band}, {score} / 100)</span>
      </div>
      <div className="h-2 bg-white/10 rounded overflow-hidden">
        <div className="h-2 bg-primary" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function PortfolioMessage({ portfolio, isAuth }: { portfolio: any; isAuth: boolean }) {
  const id = portfolio?.id;
  const detailHref = id ? `/portfolios/${id}` : "/portfolios";
  return (
    <div className="relative">
      <div className="space-y-2">
        <div className="text-lg font-semibold">{portfolio?.name || "Портфель"}</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted">Сумма</div>
            <div className="text-text text-base font-semibold">
              {isAuth ? `$${Number(portfolio?.totalValue || 0).toLocaleString()}` : "••••••"}
            </div>
          </div>
          <div>
            <div className="text-muted">Ожид. доходность</div>
            <div className="text-base font-semibold">
              {isAuth ? `${Number(portfolio?.expectedReturn || 0).toFixed(1)}%` : "•••%"}
            </div>
          </div>
          <div>
            <div className="text-muted">Риск‑уровень</div>
            <div className="text-base font-semibold">{isAuth ? portfolio?.riskLevel || "—" : "••••"}</div>
          </div>
          <div>
            <div className="text-muted">Активов</div>
            <div className="text-base font-semibold">{isAuth ? (portfolio?.assets?.length ?? 0) : "••"}</div>
          </div>
        </div>
        {isAuth ? (
          <div className="pt-2">
            <Link to={detailHref} className="btn">Подробнее</Link>
          </div>
        ) : null}
      </div>

      {!isAuth && (
        <div className="absolute inset-0 backdrop-blur-sm bg-black/30 grid place-items-center rounded-xl">
          <div className="text-center">
            <div className="mb-2">Войдите или зарегистрируйтесь, чтобы сохранить портфель</div>
            <div className="flex items-center justify-center gap-2">
              <Link to="/" className="btn">Войти</Link>
              <Link to="/?mode=register" className="tab">Регистрация</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const b64 = res.split(",")[1] || "";
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

