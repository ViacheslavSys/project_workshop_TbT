import React, { useState } from "react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "../assets/chat.css";

// ==== Компонент поля ввода ====
export default function ChatInput({ onSend, isRecording, toggleRecording }) {
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