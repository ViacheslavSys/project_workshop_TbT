import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { type RootState } from "../../store/store";
import { useWebSocket } from "../../hooks/useWebSocket";

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const WS_URL = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:8000/ws"; // set VITE_WS_URL in .env

export default function ChatWide() {
  const { messages, typing } = useSelector((s: RootState) => ({
    messages: s.chat.messages,
    typing: s.chat.typing,
  }));

  const { sendMessage } = useWebSocket(WS_URL);

  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing]);

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

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>Chat Assistant</div>
        {typing && <div className="text-xs text-muted">Assistant is typing…</div>}
      </div>
      <div className="card-body">
        <div className="flex flex-col h-[70vh]">
          <div ref={listRef} className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <MessageBubble key={m.id} sender={m.sender} type={m.type} content={m.content} />
              ))}
            </div>
          </div>

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
              placeholder="Type your message…"
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
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ sender, type, content }: { sender: "user" | "ai"; type: string; content: unknown }) {
  const isUser = sender === "user";
  let body: React.ReactNode;
  if (type === "audio" && content && typeof content === "object" && (content as any).data) {
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
