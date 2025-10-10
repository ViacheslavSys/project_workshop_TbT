import React, { useState, useRef, useEffect } from "react";
import {
  MessageList,
  Message
} from "@chatscope/chat-ui-kit-react";
import ChatInput from "../components/ChatInput";
import RiskSurvey from "../components/RiskSurvey"
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "../assets/chat.css";

export default function ChatBot() {
  const [stage, setStage] = useState("SMART цель");
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Здравствуйте! Давайте определим вашу SMART цель." },
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const ws = useRef(null); // WebSocket

  const stages = [
    "SMART цель",
    "Анкетирование риска",
    "Состав портфеля",
    "Подтверждение портфеля",
  ];

  // ==== Подключение к WebSocket ====
  useEffect(() => {
    ws.current = new WebSocket("ws://127.0.0.1:8086/ws");

    ws.current.onopen = () => {
      console.log("WebSocket подключен");
    };

    ws.current.onmessage = (event) => {
      addMessage("bot", event.data);
    };

    ws.current.onclose = () => {
      console.log("WebSocket отключен");
    };

    return () => ws.current.close();
  }, []);

  // ==== Добавление сообщений ====
  const addMessage = (sender, text, isAudio = false) => {
    setMessages((prev) => [...prev, { sender, text, isAudio }]);
  };

  // ==== Отправка текстового сообщения ====
  const handleSend = (text) => {
    if (!text.trim()) return;
    addMessage("user", text);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "text", text }));
    }

    if (stage === "Цель накопления" && messages.length > 3) {
      addMessage(
        "bot",
        "Цель: купить квартиру\nСумма: 5 млн ₽\nГоризонт: 3 года\nВсё верно?"
      );
      setStage("Анкетирование риска");
    } else if (stage === "Анкетирование риска") {
      addMessage("bot", "Определим ваш риск-профиль");
    } else {
      addMessage("bot", "Ждем ответ от сервера...");
    }
  };

  // ==== Голосовой ввод ====
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunks.current = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
      addMessage("user", "Аудиосообщение", true);
      sendAudioToServer(audioBlob);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  // ==== Отправка аудио ====
  const sendAudioToServer = async (blob) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const arrayBuffer = await blob.arrayBuffer();
      // Можно обернуть в JSON с типом "audio" и массивом байтов
      const audioMessage = JSON.stringify({
        type: "audio",
        data: Array.from(new Uint8Array(arrayBuffer))
      });
      ws.current.send(audioMessage);
      console.log("Аудио отправлено через WebSocket");
    }
  };

  return (
    <div className="main_page">
      {/* ==== Боковая панель ==== */}
      <aside className="sidebar">
        <h2>Этапы</h2>
        <ul>
          {stages.map((item) => (
            <li
              key={item}
              className={stage === item ? "active" : ""}
              onClick={() => setStage(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {/* ==== Окно чата ==== */}
      <div className="chat-container">
        <div className="chat-messages">
          <MessageList>
            {messages.map((msg, idx) => (
              <Message
                key={idx}
                model={{
                  message: msg.text,
                  sentTime: "just now",
                  direction: msg.sender === "user" ? "outgoing" : "incoming",
                  position: "single",
                }}
              />
            ))}
          </MessageList>
        </div>

        {/* ==== Этап анкетирования ==== */}
        {stage === "Анкетирование риска" ? (
          <RiskSurvey onNext={() => setStage("Состав портфеля")} ws={ws} />
        ) : (
          <ChatInput
            onSend={handleSend}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
          />
        )}
      </div>
    </div>
  );
}