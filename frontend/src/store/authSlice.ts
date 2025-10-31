import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type User = {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  is_active?: boolean;
  created_at?: string; // ISO
} | null;

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
