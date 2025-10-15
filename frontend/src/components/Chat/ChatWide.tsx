import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../../store/store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { setMessages } from "../../store/chatSlice";

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const WS_URL = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000/ws"; // set VITE_WS_URL in .env

export default function ChatWide() {
  const dispatch = useDispatch();
  const { messages, typing, stage } = useSelector((s: RootState) => ({
    messages: s.chat.messages,
    typing: s.chat.typing,
    stage: s.chat.stage,
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

  // Rehydrate history from sessionStorage once
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem("chat_history");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          dispatch(setMessages(arr));
        }
      }
    } catch {}
  }, [dispatch]);

  // Persist history on change
  useEffect(() => {
    try { sessionStorage.setItem("chat_history", JSON.stringify(messages)); } catch {}
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
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

  const stopRecording = () => { mediaRecorderRef.current?.stop(); };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>Chat Assistant</div>
        {typing && <div className="text-xs text-muted">Assistant is typing...</div>}
      </div>
      <div className="card-body">
        <div className="flex flex-col h-[70vh]">
          <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  sender={m.sender}
                  type={m.type}
                  content={m.content}
                  onRiskAnswer={(qid, answers)=>sendMessage({ questionId: qid, answers }, "risk_answer")}
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
              placeholder="Type your message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="input min-h-10 max-h-36 flex-1 resize-y"
            />

            <button onClick={handleSend} className="btn">Send</button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ sender, type, content, onRiskAnswer }: { sender: "user" | "ai"; type: string; content: unknown; onRiskAnswer?: (qid:string, answers:string[])=>void }) {
  const isUser = sender === "user";
  let body: React.ReactNode;
  if (type === "risk_questions" && content && typeof content === "object") {
    body = <RiskFormMessage payload={content as any} onSubmit={onRiskAnswer}/>;
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
      <div
        className={classNames(
          "max-w-[80%] px-3 py-2 rounded-xl border",
          isUser ? "bg-primary/15 border-transparent" : "bg-white/5 border-border"
        )}
      >
        {body}
      </div>
    </div>
  );
}

function RiskFormMessage({ payload, onSubmit }:{ payload: any; onSubmit?: (qid: string, answers: string[])=>void }){
  const q = Array.isArray(payload?.questions) && payload.questions.length ? payload.questions[0] : undefined;
  const [checked, setChecked] = useState<string[]>([]);
  if (!q) return <div className="text-sm text-muted">No questions available.</div>;
  const toggle = (id:string) => {
    setChecked(prev => {
      if (q.multiSelect) return prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id];
      return prev.includes(id) ? [] : [id];
    });
  };
  return (
    <div>
      <div className="font-medium mb-2">{q.question || "Select options"}</div>
      <div className="space-y-2">
        {q.options?.map((opt:any)=> (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-blue-500" checked={checked.includes(opt.id)} onChange={()=>toggle(opt.id)} />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <button className="btn" onClick={()=> onSubmit?.(q.id, checked)} disabled={!checked.length}>Submit</button>
      </div>
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

