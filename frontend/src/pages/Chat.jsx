import React, { useState, useRef, useEffect } from "react";
import {
  MessageList,
  Message,
  MessageInput
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "./chat.css"; 
import {WaveSurferTelegram} from "../utils/AudioVisual"

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
    ws.current = new WebSocket("ws://127.0.0.1:8000/ws");

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
      ws.current.send(text);
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
      /*addMessage("user", "Аудиосообщение", true); */
      addMessage("user", WaveSurferTelegram(audioBlob), true); 
      sendAudioToServer(audioBlob);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  // ==== Отправка аудио ====
  const sendAudioToServer = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob, "recording.wav");

    try {
      const response = await fetch("http://127.0.0.1:8000/upload-audio", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Сервер сохранил файл:", data);
    } catch (error) {
      console.error("Ошибка при отправке аудио:", error);
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
                  message: msg.isAudio ? msg : msg.text,
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
          <RiskSurvey onNext={() => setStage("Состав портфеля")} />
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

// ==== Компонент поля ввода ====
function ChatInput({ onSend, isRecording, toggleRecording }) {
  const [input, setInput] = useState("");

  return (
    <div className="chat-input">
      <button className="voice-button" onClick={toggleRecording}>
        {isRecording ? "⏹️" : "🎙️"}
      </button>
      <input
        type="text"
        placeholder="Введите сообщение..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !onSend(input) && setInput("")}
      />
      <button onClick={() => !onSend(input) && setInput("")}>Отправить</button>
    </div>
  );
}

// ==== Компонент анкетирования риска ====
function RiskSurvey({ onNext }) {
  const [answers, setAnswers] = useState({
    q1: false,
    q2: false,
    q3: false,
  });

  const toggle = (key) => {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="chat-input" style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <h3>Анкетирование риска</h3>
      <label>
        <input type="checkbox" checked={answers.q1} onChange={() => toggle("q1")} />  
        Я готов к колебаниям стоимости активов
      </label>
      <label>
        <input type="checkbox" checked={answers.q2} onChange={() => toggle("q2")} />  
        Я предпочитаю долгосрочные инвестиции
      </label>
      <label>
        <input type="checkbox" checked={answers.q3} onChange={() => toggle("q3")} />  
        Я спокойно отношусь к временным убыткам
      </label>
      <button style={{ marginTop: "1rem" }} onClick={onNext}>
        Далее
      </button>
    </div>
  );
}
