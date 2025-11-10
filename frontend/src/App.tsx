import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout";
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

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
