import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import PortfolioPage from "../pages/PortfolioPage";
import PortfolioDetailPage from "../pages/PortfolioDetailPage";
import AuthPage from "../pages/AuthPage";
import AccountPage from "../pages/AccountPage";
import ChatPage from "../pages/ChatPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <Layout><Navigate to="/chat" replace /></Layout>,
  },
  {
    path: "/portfolios",
    element: <Layout><PortfolioPage /></Layout>,
  },
  {
    path: "/chat",
    element: <Layout><ChatPage /></Layout>,
  },
  {
    path: "/portfolios/:id",
    element: <Layout><PortfolioDetailPage /></Layout>,
  },
  {
    path: "/auth",
    element: <Layout><AuthPage /></Layout>,
  },
  {
    path: "/account",
    element: <Layout><AccountPage /></Layout>,
  },
  // catch-all
  {
    path: "*",
    element: <Layout><Navigate to="/portfolios" replace /></Layout>,
  },
]);
