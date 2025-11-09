import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../app/store/hooks";
import { pushMessage, setTyping } from "../store/chatSlice";
import type { ChatMessage } from "../store/chatSlice";
import { getAnonymousUserId } from "../../../shared/utils/anonymousUser";
import { sendChatMessage } from "../api/chatApi";

export default function ChatView() {
  const messages = useAppSelector((s) => s.chat.messages) as ChatMessage[];
  const typing = useAppSelector((s) => s.chat.typing);
  const authUserId = useAppSelector((s) => s.auth.user?.id);
  const userId = authUserId ?? getAnonymousUserId();
  const dispatch = useAppDispatch();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !typing, [input, typing]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, typing]);

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setError(null);
    setInput("");
    const userMsg = { id: crypto.randomUUID(), type: "message", content: text, sender: "user" as const, ts: Date.now() };
    dispatch(pushMessage(userMsg));
    dispatch(setTyping(true));
    try {
      const reply = await sendChatMessage(userId, text);
      const aiMsg = { id: crypto.randomUUID(), type: "message", content: reply, sender: "ai" as const, ts: Date.now() };
      dispatch(pushMessage(aiMsg));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка запроса";
      setError(msg);
    } finally {
      dispatch(setTyping(false));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void onSend();
    }
  };

  return (
    <div className="grid grid-rows-[1fr_auto] h-[70vh] gap-3">
      <div ref={listRef} className="card overflow-y-auto">
        <div className="card-header">Чат с ассистентом</div>
        <div className="card-body space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted">Начните диалог — отправьте первое сообщение.</div>
          )}
          {messages.map((m: ChatMessage) => (
            <div key={m.id} className={`max-w-[80%] ${m.sender === 'user' ? 'ml-auto text-right' : ''}`}>
              <div className={`inline-block px-3 py-2 rounded-xl border ${m.sender === 'user' ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-border'}`}>
                <div className="whitespace-pre-wrap text-sm">{String(m.content)}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="text-xs text-muted">Ассистент печатает…</div>
          )}
          {error && (
            <div className="text-xs text-danger">{error}</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-end gap-2">
            <textarea
              className="input flex-1 min-h-[44px]"
              placeholder="Напишите сообщение и нажмите Enter"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="btn" disabled={!canSend} onClick={onSend}>Отправить</button>
          </div>
          <div className="text-[11px] text-muted mt-1">Shift+Enter — перенос строки</div>
        </div>
      </div>
    </div>
  );
}
