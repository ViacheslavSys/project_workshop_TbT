import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice.ts";

export type ChatMsg = { id: string; type: string; content: unknown; sender: "user"|"ai"; ts: number; };
export interface ChatState { stage: "goals"|"risk"|"portfolio"; messages: ChatMsg[]; typing: boolean; }

export const CHAT_SESSION_STORAGE_KEY = "chat_state";

function createDefaultState(): ChatState {
  return { stage: "goals", messages: [], typing: false };
}

function isStage(value: unknown): value is ChatState["stage"] {
  return value === "goals" || value === "risk" || value === "portfolio";
}

function isChatMsg(value: unknown): value is ChatMsg {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    (candidate.sender === "user" || candidate.sender === "ai") &&
    typeof candidate.ts === "number"
  );
}

function loadInitialState(): ChatState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (!raw) return createDefaultState();

    const parsed = JSON.parse(raw) as Partial<ChatState> | null;
    const messages = Array.isArray(parsed?.messages) ? parsed.messages.filter(isChatMsg) : [];
    const stage = isStage(parsed?.stage) ? parsed?.stage : "goals";

    return { stage, messages, typing: false };
  } catch {
    return createDefaultState();
  }
}

const initialState: ChatState = loadInitialState();

const slice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setStage(state, action:PayloadAction<ChatState["stage"]>) { state.stage = action.payload; },
    pushMessage(state, action:PayloadAction<ChatMsg>) { state.messages = [...state.messages, action.payload]; },
    setMessages(state, action:PayloadAction<ChatMsg[]>) { state.messages = action.payload; },
    setTyping(state, action:PayloadAction<boolean>) { state.typing = action.payload; },
    resetChat() { return createDefaultState(); }
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => createDefaultState());
  }
});
export const { setStage, pushMessage, setMessages, setTyping, resetChat } = slice.actions;
export default slice.reducer;
