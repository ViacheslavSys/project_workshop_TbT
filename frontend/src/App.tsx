import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { flushPendingPortfolioSaves } from "./shared/pendingPortfolioSaves";
import { syncUserIdentity } from "./shared/userIdentity";
import { fetchCurrentUser } from "./store/authSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";

export default function App() {
  useLocation();
  const dispatch = useAppDispatch();
  const { accessToken, initialized, isAuthenticated } = useAppSelector((state) => ({
    accessToken: state.auth.accessToken,
    initialized: state.auth.initialized,
    isAuthenticated: state.auth.isAuthenticated,
  }));

  useEffect(() => {
    if (!initialized && accessToken) {
      void dispatch(fetchCurrentUser());
    }
  }, [accessToken, initialized, dispatch]);

  useEffect(() => {
    void syncUserIdentity(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    let cancelled = false;
    const flush = async () => {
      try {
        await flushPendingPortfolioSaves(accessToken);
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to save pending portfolios", error);
        }
      }
    };

    void flush();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
