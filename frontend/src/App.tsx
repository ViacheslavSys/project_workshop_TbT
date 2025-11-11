import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
import { syncUserIdentity } from "./shared/userIdentity";
import { fetchCurrentUser } from "./store/authSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";

export default function App() {
  useLocation();
  const dispatch = useAppDispatch();
  const { accessToken, initialized } = useAppSelector((state) => ({
    accessToken: state.auth.accessToken,
    initialized: state.auth.initialized,
  }));

  useEffect(() => {
    if (!initialized && accessToken) {
      void dispatch(fetchCurrentUser());
    }
  }, [accessToken, initialized, dispatch]);

  useEffect(() => {
    void syncUserIdentity(accessToken);
  }, [accessToken]);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
