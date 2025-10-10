import { useState } from "react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "../assets/chat.css";

// Массив вопросов с вариантами ответов
const riskQuestions = [
  {
    id: "q1",
    text: "Я готов к колебаниям стоимости активов",
    options: ["Да", "Нет", "Не уверен"]
  },
  {
    id: "q2",
    text: "Я предпочитаю долгосрочные инвестиции",
    options: ["Да", "Нет"]
  },
  {
    id: "q3",
    text: "Я спокойно отношусь к временным убыткам",
    options: ["Да", "Нет", "Иногда"]
  },
  {
    id: "q4",
    text: "Я могу потерять часть капитала ради потенциальной прибыли",
    options: ["Да", "Нет"]
  }
];

export default function RiskSurvey({ onNext, ws }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [answers, setAnswers] = useState({});

  const currentQuestion = riskQuestions[currentIndex];

  const handleAnswer = (answer) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));

    // Отправка на сервер через WebSocket
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "risk_answer",
        questionId: currentQuestion.id,
        answer
      }));
    }

    // Переход к следующему вопросу или завершение
    if (currentIndex < riskQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onNext();
    }
  };

  return (
    <div className="chat-input" style={{ flexDirection: "column", alignItems: "flex-start" }}>
      <h3>Анкетирование риска</h3>
      <p>{currentQuestion.text}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {currentQuestion.options.map((option) => (
          <button key={option} onClick={() => handleAnswer(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}