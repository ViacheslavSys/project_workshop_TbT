import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { pushMessage, setTyping, setStage } from "../store/chatSlice";

export const useWebSocket = (url: string) => {
  const ws = useRef<WebSocket | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    ws.current = new WebSocket(url);
    ws.current.onopen = () => {};
    ws.current.onclose = () => {};
    ws.current.onerror = () => {};
    ws.current.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        const msg = {
          id: m.id || crypto.randomUUID(),
          type: m.type,
          content: m.content,
          sender: (m.sender === "user" || m.sender === "ai") ? m.sender : "ai",
          ts: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
        };
        // Stage switching aligned with test API
        if (msg.type === "risk_questions") dispatch(setStage("risk"));
        if (msg.type === "risk_result" || msg.type === "portfolio_recommendation") dispatch(setStage("portfolio"));
        if (msg.type === "goal_discussion" || msg.type === "message") dispatch(setStage("goals"));
        dispatch(pushMessage(msg));
      } catch {
        // ignore parse errors
      } finally {
        dispatch(setTyping(false));
      }
    };
    return () => ws.current?.close();
  }, [url, dispatch]);

  const sendMessage = (content:unknown, type="message") => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, content, timestamp: Date.now() }));
      dispatch(pushMessage({ id: crypto.randomUUID(), type, content, sender:"user", ts: Date.now() }));
      dispatch(setTyping(true));
    }
  };
  return { sendMessage };
};
