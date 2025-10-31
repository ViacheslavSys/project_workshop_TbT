import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  calculatePortfolio,
  clarifyRiskProfile,
  fetchRiskQuestions,
  getAnonymousUserId,
  sendChatAudio,
  sendChatText,
  submitRiskAnswers,
  analyzePortfolio,
  type PortfolioRecommendation,
  type RiskClarifyingQuestion,
  type RiskQuestion,
  type RiskProfileResult,
  
} from "../../api/chat";
import { type RootState } from "../../store/store";
import {
  pushMessage,
  setStage,
  setTyping,
} from "../../store/chatSlice";


type MessageSender = "user" | "ai";

type RiskQuestionMessagePayload = {
  id: number | null;
  text: string;
  options: Array<{ id: string; label: string; value: string }>;
  clarificationCode?: string;
  allowMultiple?: boolean;
};

type RiskResponsePayload =
  | { kind: "question"; questionId: number; answers: string[]; text: string }
  | { kind: "clarification"; code: string; answers: string[]; text: string };

const INITIAL_BOT_MESSAGE =
  "Привет! Давайте сформулируем цель по SMART: расскажите про сумму, сроки, стартовый капитал и зачем вы копите. Я помогу сохранить всё в удобном виде.";
const steps = [
  { id: "goals" as const, label: "Цель по SMART" },
  { id: "risk" as const, label: "Риск-профиль" },
  { id: "portfolio" as const, label: "Инвестпортфель" },
];

const GOAL_SUMMARY_PREFIX = "Отлично! Я понял вашу цель:";
const GOAL_SUMMARY_SUFFIX = "Теперь перейдем к определению вашего риск-профиля.";

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export default function ChatWide() {
  const dispatch = useDispatch();
  const { messages, typing, stage, isAuth } = useSelector((state: RootState) => ({
    messages: state.chat.messages,
    typing: state.chat.typing,
    stage: state.chat.stage,
    isAuth: state.auth.isAuthenticated,
  }));

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [, setPending] = useState(false);
  const [riskQuestions, setRiskQuestions] = useState<RiskQuestion[]>([]);
  const [riskAnswers, setRiskAnswers] = useState<Record<number, string>>({});
  const [currentRiskIndex, setCurrentRiskIndex] = useState<number>(-1);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<RiskClarifyingQuestion[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [portfolioExplanation, setPortfolioExplanation] = useState<string | null>(null);
  const [portfolioExplanationError, setPortfolioExplanationError] = useState<string | null>(null);
  const [portfolioExplanationLoading, setPortfolioExplanationLoading] = useState(false);
  // В разделе с другими useState, добавьте:
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<string | null>(null);
  const [portfolioAnalysisLoading, setPortfolioAnalysisLoading] = useState(false);
  const [portfolioAnalysisError, setPortfolioAnalysisError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const userIdRef = useRef<string>("");
  const initialMessageRef = useRef(false);
  const goalSummaryHandledMessageIdRef = useRef<string | null>(null);
  const portfolioRequestedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    userIdRef.current = getAnonymousUserId();
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing]);

  const appendMessage = useCallback(
    (sender: MessageSender, type: string, content: unknown) => {
      dispatch(
        pushMessage({
          id: crypto.randomUUID(),
          sender,
          type,
          content,
          ts: Date.now(),
        }),
      );
    },
    [dispatch],
  );

  useEffect(() => {
    if (initialMessageRef.current) return;
    if (messages.length > 0) {
      initialMessageRef.current = true;
      return;
    }
    appendMessage("ai", "message", INITIAL_BOT_MESSAGE);
    initialMessageRef.current = true;
  }, [messages, appendMessage]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    const userId = userIdRef.current || getAnonymousUserId();
    userIdRef.current = userId;

    setPortfolioExplanation(null);
    setPortfolioExplanationError(null);
    setPortfolioExplanationLoading(false);

    appendMessage("user", "message", text);
    setDraft("");
    setError(null);
    dispatch(setTyping(true));

    try {
      const response = await sendChatText(userId, text);
      appendMessage("ai", "message", response);
      dispatch(setStage("goals"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось получить ответ от ассистента";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    } finally {
      dispatch(setTyping(false));
    }
    
  };
  
  const requestPortfolioRecommendation = useCallback(async () => {
    if (portfolioRequestedRef.current) return;
    portfolioRequestedRef.current = true;

    const userId = userIdRef.current || getAnonymousUserId();
    userIdRef.current = userId;

    dispatch(setTyping(true));
    setPending(true);
    setError(null);
    setPortfolioAnalysis(null);
    setPortfolioAnalysisError(null);

    try {
      const result = await calculatePortfolio(userId);
      if (result.recommendation) {
        appendMessage("ai", "portfolio_recommendation", result.recommendation);
        
        // Автоматически запускаем анализ после получения портфеля
        setPortfolioAnalysisLoading(true);
        try {
          const analysisResult = await analyzePortfolio(userId);
          setPortfolioAnalysis(analysisResult.analysis);
          
          // Добавляем сообщение с анализом
          appendMessage("ai", "portfolio_analysis", analysisResult.analysis);
        } catch (analysisErr) {
          const analysisMessage = analysisErr instanceof Error ? analysisErr.message : "Не удалось получить анализ портфеля";
          setPortfolioAnalysisError(analysisMessage);
          appendMessage("ai", "message", `Анализ портфеля: ${analysisMessage}`);
        } finally {
          setPortfolioAnalysisLoading(false);
        }
      } else {
        appendMessage(
          "ai",
          "message",
          "Пока не удалось получить инвестиционную рекомендацию. Попробуйте обновить данные или повторить расчёт позже.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось рассчитать портфель.";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
      portfolioRequestedRef.current = false;
    } finally {
      dispatch(setTyping(false));
      setPending(false);
    }
  }, [appendMessage, dispatch]);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recorderChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recorderChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const userId = userIdRef.current || getAnonymousUserId();
        userIdRef.current = userId;
        const rawBlob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        if (!rawBlob.size) {
          setIsRecording(false);
          return;
        }

        let preparedBlob: Blob;
        let preparedFilename: string;
        try {
          const prepared = await prepareAudioForUpload(rawBlob);
          preparedBlob = prepared.blob;
          preparedFilename = prepared.filename;
        } catch (conversionError) {
          const message =
            conversionError instanceof Error
              ? conversionError.message
              : "Не удалось обработать аудиозапись.";
          appendMessage("ai", "message", `Ошибка: ${message}`);
          setError(message);
          setIsRecording(false);
          return;
        }

        try {
          const base64 = await blobToBase64(preparedBlob);
          appendMessage("user", "audio", { mime: preparedBlob.type, data: base64 });
          dispatch(setTyping(true));
          setError(null);

          const response = await sendChatAudio(userId, preparedBlob, preparedFilename);
          appendMessage("ai", "message", response);
          dispatch(setStage("goals"));
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Не удалось обработать аудио сообщение";
          appendMessage("ai", "message", `Ошибка: ${message}`);
          setError(message);
        } finally {
          dispatch(setTyping(false));
          setIsRecording(false);
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось включить запись голоса";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const mapRiskQuestionToPayload = (
    question: RiskQuestion,
  ): RiskQuestionMessagePayload => ({
    id: question.id,
    text: question.text,
    options: question.options.map((option, idx) => {
      const match = option.match(/^\s*([A-Za-zА-Яа-я])\)/);
      const value = match ? match[1].toUpperCase() : String.fromCharCode(65 + idx);
      const cleaned = option.replace(/^\s*[A-Za-zА-Яа-я]\)\s*/, "").trim();
      return {
        id: `${question.id}_${idx}`,
        label: cleaned || option,
        value,
      };
    }),
    allowMultiple: false,
  });

  const mapClarifyingQuestion = (
    question: RiskClarifyingQuestion,
  ): RiskQuestionMessagePayload => ({
    id: null,
    text: question.question,
    clarificationCode: question.code,
    options: question.options.map((option, idx) => {
      const match = option.match(/^\s*([A-Za-zА-Яа-я])\)/);
      const value = match ? match[1].toUpperCase() : String.fromCharCode(65 + idx);
      const cleaned = option.replace(/^\s*[A-Za-zА-Яа-я]\)\s*/, "").trim();
      return {
        id: `${question.code}_${idx}`,
        label: cleaned || option,
        value,
      };
    }),
    allowMultiple: false,
  });

  const enqueueRiskQuestion = useCallback(
    (payload: RiskQuestionMessagePayload) => {
      appendMessage("ai", "risk_question", payload);
    },
    [appendMessage],
  );

  const handleStartRisk = useCallback(async () => {
    portfolioRequestedRef.current = false;
    const userId = userIdRef.current || getAnonymousUserId();
    userIdRef.current = userId;
    setError(null);
    setPending(true);
    setPortfolioExplanation(null);
    setPortfolioExplanationError(null);
    setPortfolioExplanationLoading(false);
    dispatch(setStage("risk"));
    appendMessage("ai", "message", "Запускаю тестирование на риск-профиль.");
    try {
      const questions = await fetchRiskQuestions(userId);
      if (!questions.length) {
        appendMessage("ai", "message", "Пока нет доступных вопросов для теста.");
        setPending(false);
        return;
      }
      setRiskQuestions(questions);
      setRiskAnswers({});
      setCurrentRiskIndex(0);
      setClarifyingQuestions([]);
      setClarificationAnswers({});
      enqueueRiskQuestion(mapRiskQuestionToPayload(questions[0]));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить вопросы теста";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    } finally {
      setPending(false);
    }

  }, [appendMessage, dispatch, enqueueRiskQuestion]);

  useEffect(() => {
    if (stage !== "goals") return;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.sender !== "ai" || message.type !== "message") continue;
      const text =
        typeof message.content === "string"
          ? message.content
          : null;
      if (!text) continue;
      const normalized = text.replace(/\s+/g, " ").trim();
      if (
        !normalized.startsWith(GOAL_SUMMARY_PREFIX) ||
        !normalized.endsWith(GOAL_SUMMARY_SUFFIX)
      ) {
        continue;
      }
      if (goalSummaryHandledMessageIdRef.current === message.id) return;
      goalSummaryHandledMessageIdRef.current = message.id;
      void handleStartRisk();
      return;
    }
  }, [messages, stage, handleStartRisk]);

  // const requestPortfolioRecommendation = useCallback(async () => {
  //   if (portfolioRequestedRef.current) return;
  //   portfolioRequestedRef.current = true;

  //   const userId = userIdRef.current || getAnonymousUserId();
  //   userIdRef.current = userId;

  //   dispatch(setTyping(true));
  //   setPending(true);
  //   setError(null);

  //   try {
  //     const result = await calculatePortfolio(userId);
  //     if (result.recommendation) {
  //       appendMessage("ai", "portfolio_recommendation", result.recommendation);
  //     } else {
  //       appendMessage(
  //         "ai",
  //         "message",
  //         "Пока не удалось получить инвестиционную рекомендацию. Попробуйте обновить данные или повторить расчёт позже.",
  //       );
  //     }
  //   } catch (err) {
  //     const message =
  //       err instanceof Error ? err.message : "Не удалось рассчитать портфель.";
  //     appendMessage("ai", "message", `Ошибка: ${message}`);
  //     setError(message);
  //     portfolioRequestedRef.current = false;
  //   } finally {
  //     dispatch(setTyping(false));
  //     setPending(false);
  //   }
  // }, [appendMessage, dispatch]);

  const finalizeRiskAnswers = async (answers: Record<number, string>) => {
    const userId = userIdRef.current || getAnonymousUserId();
    userIdRef.current = userId;
    dispatch(setTyping(true));
    setPending(true);
    setError(null);

    try {
      const payload = Object.entries(answers).map(([questionId, answer]) => ({
        question_id: Number(questionId),
        answer,
      }));
      const result = await submitRiskAnswers(userId, payload);
      if (result.stage === "clarification_needed") {
        setClarifyingQuestions(result.clarifying_questions);
        setClarificationAnswers({});
        result.clarifying_questions.forEach((clarifying) => {
          enqueueRiskQuestion(mapClarifyingQuestion(clarifying));
        });
      } else {
        await handleRiskResult(result.result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось рассчитать риск-профиль";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    } finally {
      dispatch(setTyping(false));
      setPending(false);
    }
  };

  const finalizeClarifications = async (answers: Record<string, string>) => {
    const userId = userIdRef.current || getAnonymousUserId();
    userIdRef.current = userId;

    dispatch(setTyping(true));
    setPending(true);
    setError(null);

    try {
      const payload = Object.entries(answers).map(([code, answer]) => ({
        code,
        answer,
      }));
      const result = await clarifyRiskProfile(userId, payload);
      if (result.stage === "final") {
        await handleRiskResult(result.result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось учесть уточняющие ответы";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    } finally {
      dispatch(setTyping(false));
      setPending(false);
    }
  };

  const handleRiskResult = async (result: RiskProfileResult) => {
    appendMessage("ai", "risk_result", result);
    dispatch(setStage("portfolio"));
    appendMessage(
      "ai",
      "message",
      "Отлично! Зафиксировал ваш риск-профиль и подбираю инвестиционный план.",
    );
    await requestPortfolioRecommendation();
  };

  const handleRiskAnswer = async (payload: RiskResponsePayload) => {
    if (!payload.answers.length) return;

    appendMessage(
      "user",
      "message",
      `Мой выбор: ${payload.text || payload.answers.join(", ")}`,
    );

    if (payload.kind === "clarification") {
      const updated = { ...clarificationAnswers, [payload.code]: payload.answers[0] };
      setClarificationAnswers(updated);
      const totalClarifications = clarifyingQuestions.length;
      if (Object.keys(updated).length === totalClarifications && totalClarifications > 0) {
        await finalizeClarifications(updated);
      }
      return;
    }

    const updatedAnswers = { ...riskAnswers, [payload.questionId]: payload.answers[0] };
    setRiskAnswers(updatedAnswers);

    const nextIndex = currentRiskIndex + 1;
    if (nextIndex < riskQuestions.length) {
      setCurrentRiskIndex(nextIndex);
      enqueueRiskQuestion(mapRiskQuestionToPayload(riskQuestions[nextIndex]));
    } else {
      await finalizeRiskAnswers(updatedAnswers);
    }
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>ИИ-помощник</div>
        {typing ? (
          <div className="text-xs text-muted">Ассистент думает…</div>
        ) : null}
      </div>
      <div className="card-body">
        <div className="flex gap-4">
          <aside className="hidden w-56 rounded-2xl border border-border bg-white/5 p-3 md:block">
            <div className="mb-2 text-xs text-muted">Этапы</div>
            <nav className="space-y-1">
              {steps.map((item) => (
                <button
                  key={item.id}
                  className={classNames(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5",
                    stage === item.id ? "bg-white/10 text-text" : "text-muted",
                  )}
                  disabled
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex h-[75vh] flex-1 flex-col">
            <div ref={listRef} className="flex-1 overflow-y-auto pr-1 scrollbar-themed">
              <div className="flex flex-col gap-2">
                {messages.map((message) => (
                 <MessageBubble
                  key={message.id}
                  sender={message.sender}
                  type={message.type}
                  content={message.content}
                  isAuth={isAuth}
                  onRiskAnswer={handleRiskAnswer}
                  portfolioExplanation={portfolioExplanation}
                  portfolioExplanationError={portfolioExplanationError}
                  portfolioExplanationLoading={portfolioExplanationLoading}
                  portfolioAnalysis={portfolioAnalysis}
                  portfolioAnalysisError={portfolioAnalysisError}
                  portfolioAnalysisLoading={portfolioAnalysisLoading}
                />
                ))}
                {typing ? (
                  <div className="animate-pulse text-xs text-muted">
                    Ассистент печатает...
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mt-2 text-xs text-danger">
                {error}. Попробуйте еще раз или обновите страницу.
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    const isComposing = (event.nativeEvent as { isComposing?: boolean }).isComposing;
                    if (event.key === "Enter" && !event.shiftKey && !isComposing) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  className="flex-1 w-full resize-none rounded-xl border border-border bg-white/5 px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Опишите вашу инвестиционную цель..."
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 transform items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleSend}
                  disabled={!draft.trim()}
                  aria-label="send message"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M3 3l18 9-18 9 4-9-4-9z" />
                    <path d="M11 12L3 3" />
                    <path d="M11 12l-4 9" />
                  </svg>
                </button>
              </div>

              <button
                className={classNames(
                  "btn-secondary",
                  isRecording ? "opacity-80" : undefined,
                )}
                onClick={() => (isRecording ? stopRecording() : startRecording())}
              >
                {isRecording ? "🟥" : "🎙️"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  sender,
  type,
  content,
  isAuth,
  onRiskAnswer,
  portfolioExplanation,
  portfolioExplanationError,
  portfolioExplanationLoading,
  portfolioAnalysis,
  portfolioAnalysisError,
  portfolioAnalysisLoading,
}: {
  sender: MessageSender;
  type: string;
  content: unknown;
  isAuth: boolean;
  onRiskAnswer?: (payload: RiskResponsePayload) => void;
  portfolioExplanation?: string | null;
  portfolioExplanationError?: string | null;
  portfolioExplanationLoading?: boolean;
  portfolioAnalysis?: string | null;
  portfolioAnalysisError?: string | null;
  portfolioAnalysisLoading?: boolean;
}) {
  const isUser = sender === "user";
  let body: React.ReactNode;

  if (type === "risk_question" && !isUser) {
    body = (
      <RiskFormMessage
        payload={content as RiskQuestionMessagePayload}
        onSubmit={onRiskAnswer}
      />
    );
  } else if (type === "risk_result" && !isUser) {
    body = <RiskResultMessage result={content as RiskProfileResult} />;
  } else if (type === "portfolio_recommendation" && !isUser) {
    body = (
      <PortfolioMessage
        portfolio={content as PortfolioRecommendation | null}
        isAuth={isAuth}
        explanation={portfolioExplanation}
        explanationError={portfolioExplanationError}
        explanationLoading={portfolioExplanationLoading}
        analysis={portfolioAnalysis}
        analysisError={portfolioAnalysisError}
        analysisLoading={portfolioAnalysisLoading}
      />
    );
  } else if (type === "portfolio_analysis" && !isUser) { // ДОБАВЬТЕ ЭТОТ БЛОК
    body = (
      <PortfolioAnalysisMessage 
        analysis={content as string}
      />
    );
  } else if (type === "audio") {
    const audio = content as { data?: string; mime?: string };
    const src = audio?.data
      ? `data:${audio.mime || "audio/webm"};base64,${audio.data}`
      : undefined;
    body = src ? (
      <audio controls className="max-w-full" src={src} />
    ) : (
      <div className="text-xs text-muted">Аудио недоступно</div>
    );
  } else {
    const text =
      typeof content === "string"
        ? content
        : JSON.stringify(content, null, 2);
    body = <div className="whitespace-pre-wrap break-words text-sm">{text}</div>;
  }

  return (
    <div className={classNames("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={classNames(
          "max-w-[80%] rounded-xl border px-3 py-2",
          isUser ? "bg-primary/15 border-transparent" : "bg-white/5 border-border",
        )}
      >
        {body}
      </div>
    </div>
  );
}

function RiskFormMessage({
  payload,
  onSubmit,
}: {
  payload: RiskQuestionMessagePayload;
  onSubmit?: (payload: RiskResponsePayload) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelected([]);
    setSubmitted(false);
  }, [payload.id, payload.clarificationCode]);

  if (!payload) {
    return <div className="text-sm text-muted">Вопрос недоступен.</div>;
  }

  const allowMultiple = !!payload.allowMultiple;

  const toggle = (value: string) => {
    setSelected((prev) => {
      if (allowMultiple) {
        return prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value];
      }
      return prev.includes(value) ? [] : [value];
    });
  };

  const handleSubmit = () => {
    if (!selected.length || submitted) return;
    const selectedLabels = payload.options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label)
      .join(", ");
    setSubmitted(true);
    if (payload.clarificationCode) {
      onSubmit?.({
        kind: "clarification",
        code: payload.clarificationCode,
        answers: selected,
        text: selectedLabels,
      });
    } else if (payload.id !== null) {
      onSubmit?.({
        kind: "question",
        questionId: payload.id,
        answers: selected,
        text: selectedLabels,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase text-muted">
          {payload.clarificationCode ? "Уточняющий вопрос" : "Вопрос теста"}
        </div>
        <div className="mt-1 text-sm font-medium">{payload.text}</div>
      </div>
      <div className="space-y-2">
        {payload.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type={allowMultiple ? "checkbox" : "radio"}
              className="accent-primary"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              disabled={submitted}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div>
        <button className="btn" onClick={handleSubmit} disabled={!selected.length || submitted}>
          Зафиксировать ответ
        </button>
      </div>
    </div>
  );
}

function RiskResultMessage({ result }: { result: RiskProfileResult }) {
  const {
    profile,
    conservative_score,
    moderate_score,
    aggressive_score,
    investment_horizon,
  } = result;

  const profileLabelMap: Record<string, string> = {
    conservative: "Консервативный",
    "консервативный": "Консервативный",
    moderate: "Умеренный",
    "умеренный": "Умеренный",
    aggressive: "Агрессивный",
    "агрессивный": "Агрессивный",
  };

  const normalizedProfile = (() => {
    const value = profile?.trim() ?? "";
    const key = value.toLowerCase();
    return profileLabelMap[key] ??(value || "—");
  })();

  const horizonLabel = investment_horizon?.trim() || "—";

  const rows = [
    { label: "Консервативный", value: conservative_score },
    { label: "Умеренный", value: moderate_score },
    { label: "Агрессивный", value: aggressive_score },
  ];

  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-border bg-white/5 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Риск-профиль
        </span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
          {normalizedProfile}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4 text-sm text-text">
        <div className="text-xs text-muted">
          Горизонт инвестирования:
          <span className="ml-1 text-sm font-medium text-text">{horizonLabel}</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Категория</th>
                <th className="px-4 py-3 text-right font-semibold">Баллы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.label}
                  className={classNames(
                    "bg-transparent text-sm text-text",
                    index !== 0 ? "border-t border-white/10" : undefined,
                  )}
                >
                  <td className="px-4 py-3 text-muted">{row.label}</td>
                  <td className="px-4 py-3 text-right text-base font-semibold text-text">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-white/5 px-4 py-3 text-xs text-muted">
          Мы используем ваш риск-профиль, чтобы подобрать подходящий инвестиционный портфель на
          следующем шаге.
        </div>
      </div>
    </div>
  );
}


function PortfolioMessage({
  portfolio,
  isAuth
}: {
  portfolio: PortfolioRecommendation | null;
  isAuth: boolean;
  onRequestExplanation?: () => void;
  explanation?: string | null;
  explanationError?: string | null;
  explanationLoading?: boolean;
}) {
  if (!portfolio) {
    return <div className="text-sm text-muted">Не удалось получить рекомендации по портфелю.</div>;
  }

  const formatMoney = (value: number, fractionDigits = 0) =>
    `${(Number.isFinite(value) ? value : 0).toLocaleString("ru-RU", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })} руб.`;
  const displayMoney = (value?: number | null, fractionDigits = 0) => formatMoney(value ?? 0, fractionDigits);
  const displayPercent = (value?: number | null) => `${((value ?? 0) * 100).toFixed(1)}%`;
  const displayQuantity = (value?: number | null) =>
    (value ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  const horizonYears = portfolio.investment_term_months / 12;
  const horizonLabels: Record<string, string> = { short: "Короткий", medium: "Средний", long: "Долгий" };
  const riskLabels: Record<string, string> = { conservative: "Консервативный", moderate: "Умеренный", aggressive: "Агрессивный" };
  const horizonLabel = horizonLabels[portfolio.time_horizon] ?? portfolio.time_horizon;
  const riskLabel = riskLabels[portfolio.risk_profile] ?? portfolio.risk_profile;
  const composition = Array.isArray(portfolio.composition) ? portfolio.composition : [];

  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-border bg-white/5 text-text shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Инвестиционный портфель</span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">{riskLabel}</span>
      </div>

      <div className="space-y-4 px-4 py-4 text-sm">
        <div>
          <div className="text-xs uppercase text-muted">SMART-цель</div>
          <div className="mt-1 font-semibold">{portfolio.smart_goal}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryItem label="Целевая сумма" value={displayMoney(portfolio.target_amount)} />
          <SummaryItem label="Стартовый капитал" value={displayMoney(portfolio.initial_capital)} />
          <SummaryItem label="Горизонт инвестирования" value={`${horizonYears.toFixed(1)} года`} />
          <SummaryItem
            label="Ежемесячный взнос"
            value={displayMoney(portfolio.monthly_payment_detail?.monthly_payment)}
          />
          <SummaryItem label="Ожидаемая доходность" value={displayPercent(portfolio.expected_portfolio_return)} />
          <SummaryItem label="Инфляция в расчёте" value={displayPercent(portfolio.annual_inflation_rate)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryItem label="Риск-профиль" value={riskLabel} />
          <SummaryItem label="Инвестиционный горизонт" value={`${horizonLabel} · ${horizonYears.toFixed(1)} года`} />
        </div>

        {composition.length ? (
          <div className="space-y-3">
            <div className="text-xs uppercase text-muted">Структура портфеля</div>
            {composition.map((block) => {
              const assets = Array.isArray(block.assets) ? block.assets : [];
              return (
                <div key={block.asset_type} className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted">Класс активов</div>
                      <div className="text-sm font-semibold text-text">{block.asset_type}</div>
                    </div>
                    <div className="text-xs text-muted">
                      <div>Доля: {displayPercent(block.target_weight)}</div>
                      <div>Стоимость: {displayMoney(block.amount)}</div>
                    </div>
                  </div>

                  {assets.length ? (
                    <div className="overflow-hidden rounded-md border border-white/10">
                      <table className="w-full text-xs md:text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Название</th>
                            <th className="px-3 py-2 text-left font-semibold">Тикер</th>
                            <th className="px-3 py-2 text-right font-semibold">Кол-во</th>
                            <th className="px-3 py-2 text-right font-semibold">Цена</th>
                            <th className="px-3 py-2 text-right font-semibold">Стоимость</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset, idx) => (
                            <tr
                              key={`${asset.ticker || asset.name}-${idx}`}
                              className={classNames(
                                "bg-transparent text-text",
                                idx !== 0 ? "border-t border-white/10" : undefined,
                              )}
                            >
                              <td className="px-3 py-2">{asset.name || "—"}</td>
                              <td className="px-3 py-2 text-muted">{asset.ticker || "—"}</td>
                              <td className="px-3 py-2 text-right">{displayQuantity(asset.quantity)}</td>
                              <td className="px-3 py-2 text-right">{displayMoney(asset.price, 2)}</td>
                              <td className="px-3 py-2 text-right">{displayMoney(asset.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-muted">Нет данных по активам.</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {isAuth ? (
          <div className="rounded-lg bg-white/5 px-4 py-3 text-xs text-muted">
            Вы можете сохранить рекомендацию во вкладке «Портфели», чтобы отслеживать прогресс.
            <div className="pt-2">
              <Link to="/portfolios" className="btn-secondary">
                Открыть мои портфели
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const ACCEPTED_AUDIO_MIME_TYPES = new Map<string, string>([
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/ogg", "ogg"],
  ["audio/flac", "flac"],
  ["audio/x-flac", "flac"],
  ["audio/mp4", "mp4"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"],
]);

type PreparedAudio = { blob: Blob; filename: string };

async function prepareAudioForUpload(original: Blob): Promise<PreparedAudio> {
  const extension = ACCEPTED_AUDIO_MIME_TYPES.get(original.type);
  if (extension) {
    return {
      blob: original,
      filename: `voice-message.${extension}`,
    };
  }

  const wavBlob = await convertBlobToWav(original);
  return { blob: wavBlob, filename: "voice-message.wav" };
}

let sharedAudioContext: AudioContext | null = null;

async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const AudioCtx: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Браузер не поддерживает перекодирование аудио.");
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }

  const ctx = sharedAudioContext;
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const wavBuffer = audioBufferToWav(audioBuffer);

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const format = 1; // PCM

  const samples = buffer.length * numChannels;
  const dataLength = samples * (bitDepth / 8);
  const totalLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  let offset = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  const writeUint32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };

  const writeUint16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };

  writeString("RIFF");
  writeUint32(totalLength - 8);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16);
  writeUint16(format);
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(sampleRate * numChannels * (bitDepth / 8));
  writeUint16(numChannels * (bitDepth / 8));
  writeUint16(bitDepth);
  writeString("data");
  writeUint32(dataLength);

  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel += 1) {
    channelData.push(buffer.getChannelData(channel));
  }

  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      let sample = channelData[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      const integerSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, integerSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function PortfolioAnalysisMessage({ analysis }: { analysis: string }) {
  // Функция для очистки заголовков от **
  const cleanHeaderText = (text: string): string => {
    return text.replace(/\*\*/g, '');
  };

  // Функция для парсинга и рендеринга форматированного текста
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    lines.forEach((line, index) => {
      let content = line.trim();

      // Обработка блоков кода ```
      if (content.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLines = [];
          return;
        } else {
          inCodeBlock = false;
          elements.push(
            <pre key={`code-${index}`} className="bg-gray-900/50 rounded-lg p-4 my-3 overflow-x-auto text-xs border border-gray-700">
              <code className="text-gray-200">
                {codeLines.join('\n')}
              </code>
            </pre>
          );
          return;
        }
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Обработка формул в обратных кавычках (исправленная версия)
      const formulaMatch = content.match(/^`(.*?)`\.?$/);
      if (formulaMatch) {
        const formulaContent = formulaMatch[1].trim();
        
        elements.push(
          <div key={index} className="bg-gray-900/30 rounded-lg p-3 my-3 font-mono text-sm border border-gray-700 text-center">
            {renderInlineFormatting(formulaContent)}
          </div>
        );
        return;
      }

      // Обработка заголовков с цифрами (1. **текст**, 2. **текст** и т.д.)
      const numberedHeaderMatch = content.match(/^(\d+)\.\s+\*\*(.*?)\*\*/);
      if (numberedHeaderMatch) {
        const cleanHeader = cleanHeaderText(numberedHeaderMatch[2]);
        elements.push(
          <h3 key={index} className="text-base font-bold mt-6 mb-3 text-text border-l-4 border-primary pl-3">
            <span className="text-primary mr-2">{numberedHeaderMatch[1]}.</span>
            {cleanHeader}
          </h3>
        );
        return;
      }

      // Обработка обычных заголовков ###
      if (content.startsWith('### ')) {
        const cleanHeader = cleanHeaderText(content.replace('### ', ''));
        elements.push(
          <h3 key={index} className="text-base font-bold mt-6 mb-3 text-text border-l-4 border-primary pl-3">
            {cleanHeader}
          </h3>
        );
        return;
      }

      // Обработка подзаголовков ####
      if (content.startsWith('#### ')) {
        const cleanHeader = cleanHeaderText(content.replace('#### ', ''));
        elements.push(
          <h4 key={index} className="text-sm font-semibold mt-4 mb-2 text-text opacity-90">
            {cleanHeader}
          </h4>
        );
        return;
      }

      // Обработка жирных подзаголовков **текст** (без цифр в начале)
      const boldHeaderMatch = content.match(/^\*\*(.*?)\*\*$/);
      if (boldHeaderMatch && !content.match(/^\d+\./) && content === line.trim()) {
        const cleanHeader = cleanHeaderText(boldHeaderMatch[1]);
        elements.push(
          <h4 key={index} className="text-sm font-semibold mt-4 mb-2 text-text bg-primary/10 px-3 py-2 rounded-lg">
            {cleanHeader}
          </h4>
        );
        return;
      }

      // Обработка разделителей (увеличено расстояние)
      if (content === '---' || content.startsWith('--- ')) {
        elements.push(
          <div key={index} className="my-16 flex items-center"
          style={{ margin: '2rem 0' }}> 
            <div className="flex-1 border-t border-white/20"></div>
            {content.length > 3 && (
              <span className="mx-4 text-xs text-muted uppercase tracking-wide">
                {content.replace('---', '').trim()}
              </span>
            )}
            <div className="flex-1 border-t border-white/20"></div>
          </div>
        );
        return;
      }

      // Обработка формул (строки с = и математическими операциями) - удаляем этот блок
      // так как он конфликтует с обработкой формул в обратных кавычках
      // if (content.includes('=') && (content.includes('×') || content.includes('+') || content.includes('−') || content.includes('(') || content.includes('≈'))) {
      //   elements.push(
      //     <div key={index} className="bg-gray-900/30 rounded-lg p-3 my-2 font-mono text-sm border border-gray-700 text-center">
      //       {renderInlineFormatting(content)}
      //     </div>
      //   );
      //   return;
      // }

      // Обработка списков
      if (content.startsWith('- ') || content.startsWith('• ') || /^\d+\./.test(content)) {
        if (!inList) {
          inList = true;
        }
        
        const listItem = content.replace(/^[-•]\s+/, '').replace(/^\d+\.\s+/, '');
        const isOrdered = /^\d+\./.test(content);
        
        listItems.push(
          <li key={`${index}-item`} className="text-sm leading-6 mb-1 flex items-start">
            <span className="text-primary mr-2 mt-1 flex-shrink-0">
              {isOrdered ? `${content.match(/^\d+/)?.[0]}.` : '•'}
            </span>
            <span className="flex-1">
              {renderInlineFormatting(listItem)}
            </span>
          </li>
        );
        return;
      } else if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`${index}-list`} className="space-y-2 my-3">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }

      // Обработка обычного текста
      if (content && !content.startsWith('- ') && !content.startsWith('• ') && !/^\d+\./.test(content)) {
        elements.push(
          <p key={index} className="text-sm leading-7 mb-3">
            {renderInlineFormatting(content)}
          </p>
        );
      }
    });

    // Добавляем оставшиеся элементы списка
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key="final-list" className="space-y-2 my-3">
          {listItems}
        </ul>
      );
    }

    return elements;
  };

  // Функция для обработки inline-форматирования
  const renderInlineFormatting = (text: string): React.ReactNode => {
    if (!text) return null;

    const elements: React.ReactNode[] = [];
    let currentText = text;
    let key = 0;

    // Обработка жирного текста **текст**
    const processBold = (input: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const boldRegex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(input)) !== null) {
        // Текст до жирного
        if (match.index > lastIndex) {
          parts.push(...processItalic(input.slice(lastIndex, match.index)));
        }

        // Жирный текст
        parts.push(
          <strong key={key++} className="font-bold text-text">
            {processItalic(match[1])}
          </strong>
        );

        lastIndex = match.index + match[0].length;
      }

      // Остаток текста
      if (lastIndex < input.length) {
        parts.push(...processItalic(input.slice(lastIndex)));
      }

      return parts;
    };

    // Обработка курсива *текст*
    const processItalic = (input: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const italicRegex = /\*(.*?)\*/g;
      let lastIndex = 0;
      let match;

      while ((match = italicRegex.exec(input)) !== null) {
        // Текст до курсива
        if (match.index > lastIndex) {
          parts.push(...processEmoji(input.slice(lastIndex, match.index)));
        }

        // Курсив текст
        parts.push(
          <em key={key++} className="italic text-text opacity-90">
            {processEmoji(match[1])}
          </em>
        );

        lastIndex = match.index + match[0].length;
      }

      // Остаток текста
      if (lastIndex < input.length) {
        parts.push(...processEmoji(input.slice(lastIndex)));
      }

      return parts;
    };

    // Функция для обработки эмодзи и специальных символов
    const processEmoji = (input: string): React.ReactNode[] => {
      return input.split(/([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu).map((part, idx) => {
        if (!part) return null;
        
        // Добавляем пробелы после эмодзи для лучшей читаемости
        const isEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(part);
        
        return (
          <span key={`emoji-${idx}`} className={isEmoji ? "inline-block mx-0.5" : ""}>
            {part}
          </span>
        );
      }).filter(Boolean) as React.ReactNode[];
    };

    // Начинаем обработку с жирного текста
    elements.push(...processBold(currentText));

    return elements.length > 0 ? <>{elements}</> : <>{text}</>;
  };

  return (
    <div className="w-full max-w-[780px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-text shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-6 py-4">
        <span className="text-sm font-bold uppercase tracking-wider text-text">
          📊 Анализ портфеля
        </span>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="space-y-1">
          {renderFormattedText(analysis)}
        </div>
        
        <div className="mt-6 rounded-xl bg-gradient-to-r from-primary/10 to-blue-500/10 px-4 py-3 text-sm border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="font-semibold text-text">Автоматический анализ</div>
              <div className="text-muted mt-1">Помогает лучше понять структуру портфеля и потенциальные риски</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}