import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  calculatePortfolio,
  clarifyRiskProfile,
  fetchRiskQuestions,
  sendChatAudio,
  sendChatText,
  submitRiskAnswers,
  type ChatBackendResponse,
  type PortfolioRecommendation,
  type RiskClarifyingQuestion,
  type RiskQuestion,
  type RiskProfileResult,
  
} from "../../api/chat";
import { clearUserCache, fetchUserPortfolios } from "../../api/portfolios";
import {
  enqueuePendingPortfolioSave,
  flushPendingPortfolioSaves,
} from "../../shared/pendingPortfolioSaves";
import { MAX_SAVED_PORTFOLIOS } from "../../shared/portfolioLimits";
import { getCanonicalUserId } from "../../shared/userIdentity";
import { PortfolioLimitModal } from "../PortfolioLimitModal";
import { type RootState } from "../../store/store";
import {
  pushMessage,
  resetChat,
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
  questionNumber?: number;
  questionTotal?: number;
};

type RiskResponsePayload =
  | { kind: "question"; questionId: number; answers: string[]; text: string }
  | { kind: "clarification"; code: string; answers: string[]; text: string };


const RISK_STATE_STORAGE_KEY = "chat_risk_state";

type PersistedRiskState = {
  riskQuestions: RiskQuestion[];
  riskAnswers: Record<number, string>;
  currentRiskIndex: number;
  clarifyingQuestions: RiskClarifyingQuestion[];
  clarificationAnswers: Record<string, string>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRiskQuestionValue(value: unknown): value is RiskQuestion {
  if (!isPlainRecord(value)) return false;
  if (typeof value.id !== "number" || typeof value.text !== "string") return false;
  if (!isStringArray(value.options)) return false;
  if ("hidden" in value && value.hidden !== undefined && typeof value.hidden !== "boolean") return false;
  return true;
}

function isRiskClarifyingQuestionValue(value: unknown): value is RiskClarifyingQuestion {
  if (!isPlainRecord(value)) return false;
  if (typeof value.code !== "string" || typeof value.question !== "string") return false;
  return isStringArray(value.options);
}

function normalizeNumberKeyRecord(source: Record<string, unknown>): Record<number, string> {
  const result: Record<number, string> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value !== "string") return;
    const numeric = Number(key);
    if (Number.isNaN(numeric)) return;
    result[numeric] = value;
  });
  return result;
}

function normalizeStringRecord(source: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === "string") {
      result[key] = value;
    }
  });
  return result;
}

function loadPersistedRiskState(): PersistedRiskState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RISK_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return null;

    const questionsRaw = Array.isArray(parsed.riskQuestions) ? parsed.riskQuestions : [];
    const clarifyingRaw = Array.isArray(parsed.clarifyingQuestions) ? parsed.clarifyingQuestions : [];
    const answersRaw = isPlainRecord(parsed.riskAnswers) ? parsed.riskAnswers : {};
    const clarificationAnswersRaw = isPlainRecord(parsed.clarificationAnswers)
      ? parsed.clarificationAnswers
      : {};

    const riskQuestions = questionsRaw.filter(isRiskQuestionValue);
    const clarifyingQuestions = clarifyingRaw.filter(isRiskClarifyingQuestionValue);
    const riskAnswers = normalizeNumberKeyRecord(answersRaw);
    const clarificationAnswers = normalizeStringRecord(clarificationAnswersRaw);

    const currentRiskIndex = typeof parsed.currentRiskIndex === "number"
      ? parsed.currentRiskIndex
      : (riskQuestions.length ? 0 : -1);

    return {
      riskQuestions,
      riskAnswers,
      currentRiskIndex,
      clarifyingQuestions,
      clarificationAnswers,
    };
  } catch {
    return null;
  }
}

function persistRiskState(state: PersistedRiskState | null) {
  if (typeof window === "undefined") return;
  try {
    if (!state) {
      sessionStorage.removeItem(RISK_STATE_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(RISK_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore persistence errors */
  }
}

const INITIAL_BOT_MESSAGE = `Привет! Я помогу оформить цель по SMART.
1. Сколько хотите накопить.
2. К какому сроку нужна сумма.
3. Какой стартовый капитал уже есть.
4. Зачем копите — на что именно.
Ответьте по пунктам, и я сохраню их для вас.`;
const steps = [
  { id: "goals" as const, label: "Цель по SMART" },
  { id: "risk" as const, label: "Риск-профиль" },
  { id: "portfolio" as const, label: "Инвестпортфель" },
];

const GOAL_SUMMARY_PREFIX = "Отлично! Я понял вашу цель:";
const GOAL_SUMMARY_SUFFIX = "Теперь перейдем к определению вашего риск-профиля.";

type SmartGoalProgress = {
  term: boolean;
  sum: boolean;
  reason: boolean;
  capital: boolean;
};

const DEFAULT_SMART_PROGRESS: SmartGoalProgress = {
  term: false,
  sum: false,
  reason: false,
  capital: false,
};

const SMART_CHECKLIST_ITEMS: Array<{ key: keyof SmartGoalProgress; label: string }> = [
  { key: "sum", label: "Сумма цели" },
  { key: "term", label: "Срок достижения" },
  { key: "capital", label: "Стартовый капитал" },
  { key: "reason", label: "Зачем копите" },
];

function classNames(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export default function ChatWide() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, typing, stage, isAuth, authUserId, accessToken } = useSelector((state: RootState) => ({
    messages: state.chat.messages,
    typing: state.chat.typing,
    stage: state.chat.stage,
    isAuth: state.auth.isAuthenticated,
    authUserId: state.auth.user?.id,
    accessToken: state.auth.accessToken,
  }));

  const persistedRiskState = useMemo(loadPersistedRiskState, []);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [, setPending] = useState(false);
  const [riskQuestions, setRiskQuestions] = useState<RiskQuestion[]>(() =>
    persistedRiskState?.riskQuestions ?? []
  );
  const [riskAnswers, setRiskAnswers] = useState<Record<number, string>>(() =>
    persistedRiskState?.riskAnswers ?? {}
  );
  const [currentRiskIndex, setCurrentRiskIndex] = useState<number>(() =>
    persistedRiskState?.currentRiskIndex ?? -1
  );
  const [clarifyingQuestions, setClarifyingQuestions] = useState<RiskClarifyingQuestion[]>(() =>
    persistedRiskState?.clarifyingQuestions ?? []
  );
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>(() =>
    persistedRiskState?.clarificationAnswers ?? {}
  );
  const [smartProgress, setSmartProgress] = useState<SmartGoalProgress>(
    () => ({ ...DEFAULT_SMART_PROGRESS }),
  );

  useEffect(() => {
    if (stage !== "risk") {
      persistRiskState(null);
      return;
    }
    persistRiskState({
      riskQuestions,
      riskAnswers,
      currentRiskIndex,
      clarifyingQuestions,
      clarificationAnswers,
    });
  }, [
    stage,
    riskQuestions,
    riskAnswers,
    currentRiskIndex,
    clarifyingQuestions,
    clarificationAnswers,
  ]);

  const [portfolioExplanation, setPortfolioExplanation] = useState<string | null>(null);
  const [portfolioExplanationError, setPortfolioExplanationError] = useState<string | null>(null);
  const [portfolioExplanationLoading, setPortfolioExplanationLoading] = useState(false);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [portfolioCountLoading, setPortfolioCountLoading] = useState(false);
  const [isPortfolioLimitModalOpen, setIsPortfolioLimitModalOpen] = useState(false);
  const hasPortfolioRecommendation = useMemo(
    () => messages.some((message) => message.type === "portfolio_recommendation"),
    [messages],
  );
  const isRiskSurveyActive = stage === "risk";

  useEffect(() => {
    if (stage === "goals" && messages.length === 0) {
      setRiskQuestions([]);
      setRiskAnswers({});
      setCurrentRiskIndex(-1);
      setClarifyingQuestions([]);
      setClarificationAnswers({});
    }
  }, [stage, messages.length]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const userIdRef = useRef<string>("");
  const initialMessageRef = useRef(false);
  const goalSummaryHandledMessageIdRef = useRef<string | null>(null);
  const portfolioRequestedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<BlobPart[]>([]);
  const refreshPortfolioCount = useCallback(async () => {
    if (!isAuth || !accessToken) {
      setPortfolioCount(null);
      return;
    }
    setPortfolioCountLoading(true);
    try {
      const portfolios = await fetchUserPortfolios(accessToken);
      setPortfolioCount(portfolios.length);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to load saved portfolios", err);
    } finally {
      setPortfolioCountLoading(false);
    }
  }, [isAuth, accessToken]);

  useEffect(() => {
    userIdRef.current = getCanonicalUserId(authUserId);
  }, [authUserId]);

  useEffect(() => {
    void refreshPortfolioCount();
  }, [refreshPortfolioCount]);

  const resolveUserId = useCallback(() => {
    const resolved = userIdRef.current || getCanonicalUserId(authUserId);
    userIdRef.current = resolved;
    return resolved;
  }, [authUserId]);

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

  const applySmartProgress = useCallback(
    (payload: Partial<SmartGoalProgress> | null | undefined) => {
      if (!payload) return;
      setSmartProgress((prev) => ({
        term: payload.term ?? prev.term,
        sum: payload.sum ?? prev.sum,
        reason: payload.reason ?? prev.reason,
        capital: payload.capital ?? prev.capital,
      }));
    },
    [setSmartProgress],
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

  const handleStartNewPortfolio = useCallback(() => {
    if (!isAuth) {
      return;
    }

    if (portfolioCount !== null && portfolioCount >= MAX_SAVED_PORTFOLIOS) {
      setIsPortfolioLimitModalOpen(true);
      return;
    }

    if (accessToken) {
      void clearUserCache(accessToken).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to clear chat cache", err);
      });
    }

    setIsPortfolioLimitModalOpen(false);
    persistRiskState(null);
    setDraft("");
    setError(null);
    setIsRecording(false);
    setPending(false);
    setPortfolioExplanation(null);
    setPortfolioExplanationError(null);
    setPortfolioExplanationLoading(false);
    setRiskQuestions([]);
    setRiskAnswers({});
    setCurrentRiskIndex(-1);
    setClarifyingQuestions([]);
    setClarificationAnswers({});
    setSmartProgress({ ...DEFAULT_SMART_PROGRESS });
    recorderChunksRef.current = [];
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore stop errors */
      }
    }
    portfolioRequestedRef.current = false;
    goalSummaryHandledMessageIdRef.current = null;
    initialMessageRef.current = false;
    dispatch(resetChat());
  }, [
    accessToken,
    dispatch,
    isAuth,
    portfolioCount,
    setPending,
  ]);

  const shouldStartNewFromLocation = Boolean(
    (location.state as { startNewPortfolio?: boolean } | null)?.startNewPortfolio,
  );

  useEffect(() => {
    if (!shouldStartNewFromLocation) return;
    handleStartNewPortfolio();
    navigate(`${location.pathname}${location.search}`, { replace: true });
  }, [handleStartNewPortfolio, location.pathname, location.search, navigate, shouldStartNewFromLocation]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    const userId = resolveUserId();

    setPortfolioExplanation(null);
    setPortfolioExplanationError(null);
    setPortfolioExplanationLoading(false);

    appendMessage("user", "message", text);
    setDraft("");
    setError(null);
    dispatch(setTyping(true));

    try {
      const response: ChatBackendResponse = await sendChatText(userId, text);
      applySmartProgress(response);
      appendMessage("ai", "message", response.response);
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

    const userId = resolveUserId();

    dispatch(setTyping(true));
    setPending(true);
    setError(null);

    try {
      const result = await calculatePortfolio(userId);
      if (result.recommendation) {
        appendMessage("ai", "portfolio_recommendation", result.recommendation);
        const recommendationWithId = result.recommendation as { portfolio_id?: string | number; id?: string | number } | null;
        const portfolioId =
          recommendationWithId?.portfolio_id ?? recommendationWithId?.id ?? null;
        if (portfolioId) {
          appendMessage("ai", "portfolio_analysis_link", { portfolioId: String(portfolioId) });
        }

        const normalizedUserId = userId.trim();
        if (normalizedUserId) {
          enqueuePendingPortfolioSave({
            sessionUserId: normalizedUserId,
            portfolioName: buildPendingPortfolioName(result.recommendation),
            createdAt: Date.now(),
          });

          if (accessToken) {
            void flushPendingPortfolioSaves(accessToken)
              .then(() => refreshPortfolioCount())
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error("Failed to flush pending portfolio saves", err);
              });
          }
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
  }, [accessToken, appendMessage, dispatch, refreshPortfolioCount, resolveUserId]);

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
        const userId = resolveUserId();
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

          const response: ChatBackendResponse = await sendChatAudio(
            userId,
            preparedBlob,
            preparedFilename,
          );
          applySmartProgress(response);
          appendMessage("ai", "message", response.response);
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
    questionNumber?: number,
    questionTotal?: number,
  ): RiskQuestionMessagePayload => ({
    id: question.id,
    text: question.text,
    questionNumber,
    questionTotal,
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

  const getQuestionProgress = (
    questions: RiskQuestion[],
    index: number,
  ): { number?: number; total?: number } => {
    if (index < 0 || index >= questions.length) {
      return { number: undefined, total: undefined };
    }
    let total = 0;
    let number: number | undefined;
    for (let idx = 0; idx < questions.length; idx += 1) {
      if (questions[idx]?.hidden) continue;
      total += 1;
      if (idx === index) {
        number = total;
      }
    }
    const target = questions[index];
    if (!target || target.hidden) {
      return { number: undefined, total };
    }
    return { number, total };
  };

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
    const userId = resolveUserId();
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
      const initialProgress = getQuestionProgress(questions, 0);
      enqueueRiskQuestion(
        mapRiskQuestionToPayload(
          questions[0],
          initialProgress.number,
          initialProgress.total,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить вопросы теста";
      appendMessage("ai", "message", `Ошибка: ${message}`);
      setError(message);
    } finally {
      setPending(false);
    }

  }, [appendMessage, dispatch, enqueueRiskQuestion, resolveUserId]);

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

  //   const userId = resolveUserId();

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
    const userId = resolveUserId();
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
    const userId = resolveUserId();

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
      const nextProgress = getQuestionProgress(riskQuestions, nextIndex);
      enqueueRiskQuestion(
        mapRiskQuestionToPayload(
          riskQuestions[nextIndex],
          nextProgress.number,
          nextProgress.total,
        ),
      );
    } else {
      await finalizeRiskAnswers(updatedAnswers);
    }
  };

  return (
    <>
    <div className="card flex h-[calc(100dvh - 112px)] flex-col md:h-auto">
      <div className="card-header flex flex-wrap items-center justify-between gap-3">
        <div>ИИ-помощник</div>
        <div className="flex flex-wrap items-center gap-2">
          {isAuth ? (
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={handleStartNewPortfolio}
              disabled={portfolioCountLoading}
            >
              Создать новый портфель
            </button>
          ) : null}
        </div>
      </div>
      <div className="card-body flex flex-1 min-h-0 flex-col">
        <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row">
          <aside className="hidden w-56 rounded-2xl border border-border bg-white/5 p-3 md:block">
            <div className="mb-2 text-xs text-muted">Этапы</div>
            <nav className="space-y-2">
              {steps.map((item, index) => {
                const isActive = stage === item.id;
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      className={classNames(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5",
                        isActive ? "bg-white/10 text-text" : "text-muted",
                      )}
                      disabled
                    >
                      <span
                        className={classNames(
                          "text-xs font-semibold",
                          isActive ? "text-primary" : "text-muted",
                        )}
                      >
                        {index + 1}.
                      </span>
                      <span>{item.label}</span>
                    </button>
                    {item.id === "goals" ? (
                      <SmartGoalChecklist progress={smartProgress} />
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="relative flex w-full flex-1 min-h-0 flex-col md:h-[70vh] lg:h-[75vh]">
            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 pb-24 scrollbar-themed sm:pb-0"
            >
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
                  riskAnswers={riskAnswers}
                  clarificationAnswers={clarificationAnswers}
                />
                ))}
                {typing ? (
                  <div className="animate-pulse text-xs text-muted">
                    Ассистент печатает...
                  </div>
                ) : null}
              </div>
            </div>

            {isRiskSurveyActive ? null : hasPortfolioRecommendation ? (
              isAuth ? (
                <div className="sticky bottom-0 left-0 right-0 z-10 flex flex-col gap-2 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur sm:static sm:mt-3 sm:flex-row sm:items-center sm:border-t-0 sm:bg-transparent sm:pb-0 sm:pt-0">
                  <button
                    type="button"
                    className="btn w-full sm:w-auto"
                    onClick={handleStartNewPortfolio}
                    disabled={portfolioCountLoading}
                  >
                    Создать новый портфель
                  </button>
                </div>
              ) : null
            ) : (
              <div className="sticky bottom-0 left-0 right-0 z-10 flex flex-col gap-2 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur sm:static sm:mt-3 sm:flex-row sm:items-center sm:border-t-0 sm:bg-transparent sm:pb-0 sm:pt-0">
                {error ? (
                  <div className="text-xs text-danger">
                    {error}. Попробуйте еще раз или обновите страницу.
                  </div>
                ) : null}
                <div className="relative w-full flex-1">
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
                    className="min-h-[3.5rem] w-full resize-none rounded-xl border border-border bg-white/5 px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary sm:min-h-0"
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
                  type="button"
                  className={classNames(
                    "group relative flex w-full items-center justify-center gap-3 rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-left text-sm font-semibold text-primary shadow-sm transition sm:w-auto sm:justify-start",
                    "hover:bg-primary/15 hover:shadow-[0_8px_24px_rgba(34,211,238,0.15)] focus:outline-none focus:ring-2 focus:ring-primary/60",
                    isRecording ? "border-primary bg-primary/20 text-white shadow-[0_0_0_4px_rgba(34,211,238,0.15)]" : undefined,
                  )}
                  onClick={() => (isRecording ? stopRecording() : startRecording())}
                  aria-pressed={isRecording}
                  aria-label={isRecording ? "Остановить запись" : "Записать голосовое сообщение"}
                >
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition group-hover:scale-[1.04] group-active:scale-95">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                      <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
                      <path d="M12 19v3" />
                    </svg>
                    {isRecording ? (
                      <span className="absolute inset-0 rounded-full border-2 border-white/50 opacity-80 animate-ping" aria-hidden="true" />
                    ) : null}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <PortfolioLimitModal
      open={isPortfolioLimitModalOpen}
      onClose={() => setIsPortfolioLimitModalOpen(false)}
    />
    </>
  );
}

function SmartGoalChecklist({ progress }: { progress: SmartGoalProgress }) {
  return (
    <ul className="ml-6 space-y-1 text-xs">
      {SMART_CHECKLIST_ITEMS.map((item) => {
        const done = progress[item.key];
        return (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className={classNames(
                "h-2.5 w-2.5 rounded-full",
                done ? "bg-primary" : "bg-border",
              )}
              aria-hidden="true"
            />
            <span className={classNames("leading-tight", done ? "text-text" : "text-muted")}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
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
  riskAnswers,
  clarificationAnswers,
}: {
  sender: MessageSender;
  type: string;
  content: unknown;
  isAuth: boolean;
  onRiskAnswer?: (payload: RiskResponsePayload) => void;
  portfolioExplanation?: string | null;
  portfolioExplanationError?: string | null;
  portfolioExplanationLoading?: boolean;
  riskAnswers?: Record<number, string>;
  clarificationAnswers?: Record<string, string>;
}) {
  const isUser = sender === "user";
  let body: React.ReactNode;

  if (type === "risk_question" && !isUser) {
    const payload = content as RiskQuestionMessagePayload;
    const preselected = useMemo(() => {
      if (payload.clarificationCode && clarificationAnswers) {
        const value = clarificationAnswers[payload.clarificationCode];
        return value ? [value] : [];
      }
      if (payload.id !== null && riskAnswers) {
        const value = riskAnswers[payload.id];
        return value ? [value] : [];
      }
      return [];
    }, [payload.id, payload.clarificationCode, riskAnswers, clarificationAnswers]);
    body = (
      <RiskFormMessage
        payload={payload}
        onSubmit={onRiskAnswer}
        preselected={preselected}
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
      />
    );
  } else if (type === "portfolio_analysis_link" && !isUser) {
    const payload = (content as { portfolioId?: string | number } | null);
    const portfolioId =
      typeof payload?.portfolioId === "number" || typeof payload?.portfolioId === "string"
        ? String(payload.portfolioId)
        : typeof content === "string" || typeof content === "number"
          ? String(content)
          : null;
    body = portfolioId ? (
      <Link to={`/portfolios/${portfolioId}`} className="btn">
        Перейти к детальной аналитике
      </Link>
    ) : (
      <div className="text-sm text-muted">Детальная аналитика доступна на странице портфеля.</div>
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
  preselected,
}: {
  payload: RiskQuestionMessagePayload;
  onSubmit?: (payload: RiskResponsePayload) => void;
  preselected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(() => preselected ?? []);
  const [submitted, setSubmitted] = useState(() => Boolean(preselected?.length));

  useEffect(() => {
    const initial = preselected && preselected.length ? [...preselected] : [];
    setSelected(initial);
    setSubmitted(initial.length > 0);
  }, [payload.id, payload.clarificationCode, preselected]);

  if (!payload) {
    return <div className="text-sm text-muted">Вопрос недоступен.</div>;
  }

  const allowMultiple = !!payload.allowMultiple;
  const questionPrefix =
    payload.questionNumber === undefined
      ? null
      : payload.questionTotal
        ? `${payload.questionNumber}/${payload.questionTotal}`
        : String(payload.questionNumber);
  const questionTitle = questionPrefix ? `${questionPrefix}. ${payload.text}` : payload.text;
  const submitAnswers = (answers: string[]) => {
    if (!answers.length) {
      return;
    }
    const selectedLabels = payload.options
      .filter((option) => answers.includes(option.value))
      .map((option) => option.label)
      .join(", ");
    setSubmitted(true);
    if (payload.clarificationCode) {
      onSubmit?.({
        kind: "clarification",
        code: payload.clarificationCode,
        answers,
        text: selectedLabels,
      });
    } else if (payload.id !== null) {
      onSubmit?.({
        kind: "question",
        questionId: payload.id,
        answers,
        text: selectedLabels,
      });
    }
  };

  const toggle = (value: string) => {
    if (submitted) {
      return;
    }
    const next = allowMultiple
      ? selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
      : selected.includes(value)
        ? []
        : [value];

    setSelected(next);

    if (next.length) {
      submitAnswers(next);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase text-muted">
          {payload.clarificationCode ? "Уточняющий вопрос" : "Вопрос теста"}
        </div>
        <div className="mt-1 text-sm font-medium">{questionTitle}</div>
      </div>
      <div className="space-y-2">
        {payload.options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <label
              key={option.id}
              className={classNames(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                isSelected
                  ? "border-primary/70 bg-primary/15 text-primary"
                  : "border-transparent bg-white/5 hover:bg-white/10",
              )}
            >
              <input
                type={allowMultiple ? "checkbox" : "radio"}
                className="accent-primary"
                checked={isSelected}
                onChange={() => toggle(option.value)}
                disabled={submitted}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
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
    return profileLabelMap[key] ?? (value || "-");
  })();

  const horizonLabel = investment_horizon?.trim() || "-";

  const rows = [
    { label: "Консервативный", value: conservative_score },
    { label: "Умеренный", value: moderate_score },
    { label: "Агрессивный", value: aggressive_score },
  ];

  return (
    <div className="w-full max-w-[520px] rounded-lg border border-border/60 bg-white/5 px-4 py-4 text-sm text-text">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Риск-профиль</span>
        <span className="text-base font-semibold text-text">{normalizedProfile}</span>
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <span className="text-xs uppercase text-muted">Инвестиционный горизонт</span>
        <span className="text-sm font-medium text-text">{horizonLabel}</span>
      </div>

      <dl className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs uppercase text-muted">{row.label}</dt>
            <dd className="text-sm font-semibold text-text">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-muted">
        Мы учитываем ваш риск-профиль, подбирая рекомендации по дальнейшим шагам.
      </p>
    </div>
  );
}



function PortfolioMessage({
  portfolio,
  isAuth,
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

  const portfolioId =
    typeof portfolio.portfolio_id === "string" || typeof portfolio.portfolio_id === "number"
      ? String(portfolio.portfolio_id)
      : typeof portfolio.id === "string" || typeof portfolio.id === "number"
        ? String(portfolio.id)
        : null;

  const formatMoney = (value: number, fractionDigits = 0) =>
    `${(Number.isFinite(value) ? value : 0).toLocaleString("ru-RU", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })} руб.`;
  const displayMoney = (value?: number | null, fractionDigits = 0) => formatMoney(value ?? 0, fractionDigits);
  const displayPercent = (value?: number | null) => `${((value ?? 0) * 100).toFixed(1)}%`;

  const horizonYears = portfolio.investment_term_months / 12;
  const horizonLabels: Record<string, string> = { short: "Короткий", medium: "Средний", long: "Долгий" };
  const riskLabels: Record<string, string> = { conservative: "Консервативный", moderate: "Умеренный", aggressive: "Агрессивный" };
  const horizonLabel = horizonLabels[portfolio.time_horizon] ?? portfolio.time_horizon;
  const riskLabel = riskLabels[portfolio.risk_profile] ?? portfolio.risk_profile;

  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-xl border border-border bg-white/5 text-text shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/10 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Инвестиционный портфель</span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">{riskLabel}</span>
      </div>

      <div className="space-y-4 px-4 py-4 text-sm">
        {portfolio.smart_goal ? (
          <div>
            <div className="text-xs uppercase text-muted">SMART-цель</div>
            <div className="mt-1 font-semibold">{portfolio.smart_goal}</div>
          </div>
        ) : null}

        <div className="space-y-4">
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
        </div>

        <div className="pt-2">
          {isAuth ? (
            <Link
              to={portfolioId ? `/portfolios/${portfolioId}` : "/portfolios"}
              className="btn w-full md:w-auto"
            >
              Перейти к сохранённым портфелям
            </Link>
          ) : (
            <div className="space-y-3">
              <Link to="/auth" className="btn w-full md:w-auto">
                Зарегистрируйтесь, чтобы сохранить и просмотреть портфель
              </Link>
              <LockedPortfolioPreview />
            </div>
          )}
        </div>
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



function LockedPortfolioPreview() {
  const primaryCards = ["target", "capital", "term"];
  const secondaryCards = ["risk", "allocation"];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-white/5 p-4">
      <div className="relative z-0 space-y-4" aria-hidden="true">
        <div className="grid gap-3 md:grid-cols-3 blur-sm select-none">
          {primaryCards.map((token) => (
            <div key={token} className="rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="h-2 w-20 rounded-full bg-white/25" />
              <div className="mt-3 h-6 rounded-md bg-white/40" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 blur-sm select-none">
          {secondaryCards.map((token) => (
            <div key={token} className="rounded-lg border border-white/5 bg-white/5 p-3 space-y-2">
              <div className="h-2 w-28 rounded-full bg-white/25" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-5 rounded bg-white/35" />
                <div className="h-5 rounded bg-white/35" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-bg/30 via-bg/60 to-bg/80 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative z-20 mt-4 flex flex-col items-center gap-2 text-center text-xs font-medium text-muted">
        <svg
          className="h-5 w-5 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p>Детальная аналитика доступна после регистрации</p>
      </div>
    </div>
  );
}
function buildPendingPortfolioName(
  portfolio?: PortfolioRecommendation | null,
): string {
  const fallbackName = "Инвестпортфель";
  if (!portfolio) {
    return fallbackName;
  }

  const smartGoal =
    typeof portfolio.smart_goal === "string"
      ? portfolio.smart_goal.trim().replace(/\s+/g, " ")
      : "";
  if (smartGoal) {
    return smartGoal.length > 120 ? `${smartGoal.slice(0, 117)}...` : smartGoal;
  }

  const riskLabels: Record<string, string> = {
    conservative: "Консервативный",
    moderate: "Умеренный",
    aggressive: "Агрессивный",
  };

  const riskKey =
    typeof portfolio.risk_profile === "string"
      ? portfolio.risk_profile.trim().toLowerCase()
      : "";
  const riskLabel = riskKey ? riskLabels[riskKey] ?? portfolio.risk_profile : "";

  return riskLabel ? `${fallbackName} - ${riskLabel}` : fallbackName;
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
