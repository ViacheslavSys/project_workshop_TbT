import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import store from "./store/store.ts";
import "./index.css";
import App from "./App";
import AuthPage from "./pages/AuthPage.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import PortfolioDetailPage from "./pages/PortfolioDetailPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> , children: [
    { path: "chat", element: <ChatPage/> },
    { path: "auth", element: <AuthPage/> },
    { path: "portfolios", element: <PortfolioPage/> },
    { path: "portfolios/:id", element: <PortfolioDetailPage/> },
    { path: "account", element: <AccountPage/> },
    { index: true, element: <ChatPage/> },
  ]},
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router}/>
    </Provider>
  </React.StrictMode>
);



