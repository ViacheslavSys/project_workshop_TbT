import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice.ts";
import chat from "./chatSlice.ts";
import portfolio from "./portfolioSlice.ts";

const store = configureStore({
  reducer: { auth, chat, portfolio }
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;
