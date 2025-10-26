import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type User = { id: string; name: string; email: string } | null;
interface AuthState { user: User; isAuthenticated: boolean; }
const initialState: AuthState = { user: null, isAuthenticated: false };

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(state, action: PayloadAction<User>) { state.user = action.payload; state.isAuthenticated = !!action.payload; },
    logout(state) { state.user = null; state.isAuthenticated = false; }
  }
});
export const { login, logout } = slice.actions;
export default slice.reducer;
