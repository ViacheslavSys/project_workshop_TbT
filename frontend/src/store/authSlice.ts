import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { ApiError } from "../api/http";
import {
  fetchCurrentUser as apiFetchCurrentUser,
  loginUser as apiLoginUser,
  registerUser as apiRegisterUser,
  type BackendUser,
  type LoginPayload,
  type RegisterUserPayload,
} from "../api/users";
import { loadToken, persistToken } from "./tokenStorage";

export type User = BackendUser;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

type RejectValue = {
  message: string;
  resetAuth?: boolean;
};

type ThunkConfig = {
  state: { auth: AuthState };
  rejectValue: RejectValue;
};

const FALLBACK_ERROR = "Не удалось выполнить запрос";
const persistedToken = loadToken();

const initialState: AuthState = {
  user: null,
  accessToken: persistedToken,
  isAuthenticated: false,
  loading: false,
  error: null,
  initialized: !persistedToken,
};

const toRejectValue = (
  error: unknown,
  fallback: string,
  resetAuth = false,
): RejectValue => ({
  message: error instanceof Error ? error.message : fallback,
  resetAuth,
});

export const loginUser = createAsyncThunk<
  { user: User; token: string },
  LoginPayload,
  ThunkConfig
>("auth/loginUser", async (credentials, { rejectWithValue }) => {
  try {
    const authResponse = await apiLoginUser(credentials);
    if (!authResponse.authenticated || !authResponse.access_token) {
      return rejectWithValue({
        message: authResponse.message || "Неверный логин или пароль",
      });
    }

    const profile = await apiFetchCurrentUser(authResponse.access_token);
    return { user: profile, token: authResponse.access_token };
  } catch (error) {
    return rejectWithValue(
      toRejectValue(error, "Не удалось выполнить вход"),
    );
  }
});

export const registerUser = createAsyncThunk<
  { user: User; token: string },
  RegisterUserPayload,
  ThunkConfig
>("auth/registerUser", async (payload, { rejectWithValue }) => {
  try {
    await apiRegisterUser(payload);
    const authResponse = await apiLoginUser({
      username: payload.username,
      password: payload.password,
    });

    if (!authResponse.authenticated || !authResponse.access_token) {
      return rejectWithValue({
        message:
          authResponse.message || "Регистрация прошла, но войти не удалось",
      });
    }

    const profile = await apiFetchCurrentUser(authResponse.access_token);
    return { user: profile, token: authResponse.access_token };
  } catch (error) {
    return rejectWithValue(
      toRejectValue(error, "Не удалось завершить регистрацию"),
    );
  }
});

export const fetchCurrentUser = createAsyncThunk<
  User,
  void,
  ThunkConfig
>("auth/fetchCurrentUser", async (_, { getState, rejectWithValue }) => {
  const token = getState().auth.accessToken;
  if (!token) {
    return rejectWithValue({
      message: "Отсутствует токен авторизации",
      resetAuth: true,
    });
  }

  try {
    return await apiFetchCurrentUser(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return rejectWithValue({
        message: "Сессия истекла. Авторизуйтесь снова.",
        resetAuth: true,
      });
    }

    return rejectWithValue(
      toRejectValue(error, "Не удалось получить профиль"),
    );
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.accessToken = null;
      state.error = null;
      state.initialized = true;
      persistToken(null);
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.token;
        state.isAuthenticated = true;
        state.initialized = true;
        state.error = null;
        persistToken(action.payload.token);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error =
          action.payload?.message ||
          action.error.message ||
          FALLBACK_ERROR;
        if (!state.accessToken) {
          state.user = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.token;
        state.isAuthenticated = true;
        state.initialized = true;
        state.error = null;
        persistToken(action.payload.token);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error =
          action.payload?.message ||
          action.error.message ||
          FALLBACK_ERROR;
        if (!state.accessToken) {
          state.user = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.initialized = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error =
          action.payload?.message ||
          action.error.message ||
          FALLBACK_ERROR;
        if (action.payload?.resetAuth) {
          state.user = null;
          state.isAuthenticated = false;
          state.accessToken = null;
          persistToken(null);
        }
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
