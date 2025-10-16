import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ChatMsg = { id: string; type: string; content: unknown; sender: "user"|"ai"; ts: number; };
interface ChatState { stage: "goals"|"risk"|"portfolio"; messages: ChatMsg[]; typing: boolean; }
const initialState: ChatState = { stage: "goals", messages: [], typing: false };

const slice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setStage(s, a:PayloadAction<ChatState["stage"]>) { s.stage = a.payload; },
    pushMessage(s, a:PayloadAction<ChatMsg>) { s.messages.push(a.payload); },
    setMessages(s, a:PayloadAction<ChatMsg[]>) { s.messages = a.payload; },
    setTyping(s, a:PayloadAction<boolean>) { s.typing = a.payload; },
    resetChat() { return initialState; }
  }
});
export const { setStage, pushMessage, setMessages, setTyping, resetChat } = slice.actions;
export default slice.reducer;
