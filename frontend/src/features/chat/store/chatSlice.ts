import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ChatStage = "goals" | "risk" | "portfolio";

export type ChatMessage = {
  id: string;
  type: string;
  content: unknown;
  sender: "user" | "ai";
  ts: number;
};

type ChatState = {
  messages: ChatMessage[];
  typing: boolean;
  stage: ChatStage;
};

const initialState: ChatState = {
  messages: [],
  typing: false,
  stage: "goals",
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    pushMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    setTyping: (state, action: PayloadAction<boolean>) => {
      state.typing = action.payload;
    },
    setStage: (state, action: PayloadAction<ChatStage>) => {
      state.stage = action.payload;
    },
  },
});

export const { pushMessage, setTyping, setStage } = chatSlice.actions;
export default chatSlice.reducer;

