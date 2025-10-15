import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { pushMessage, setTyping } from "../store/chatSlice";

export const useWebSocket = (url: string) => {
  const ws = useRef<WebSocket | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    ws.current = new WebSocket(url);
    ws.current.onopen = () => {};
    ws.current.onclose = () => {};
    ws.current.onerror = () => {};
    ws.current.onmessage = (e) => {
      const message = JSON.parse(e.data);
      dispatch(pushMessage({ id: crypto.randomUUID(), type: message.type, content: message.content, sender: "ai", ts: Date.now() }));
      dispatch(setTyping(false));
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
