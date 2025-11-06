import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice.ts";
import chat, { CHAT_SESSION_STORAGE_KEY } from "./chatSlice.ts";
import portfolio from "./portfolioSlice.ts";

const store = configureStore({
  reducer: { auth, chat, portfolio }
});

if (typeof window !== "undefined") {
  store.subscribe(() => {
    const { chat: chatState } = store.getState();
    try {
      const payload = JSON.stringify({
        stage: chatState.stage,
        messages: chatState.messages
      });
      sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, payload);
    } catch {
      // Ignore persistence errors (private mode, quota exceeded, etc.)
    }
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
