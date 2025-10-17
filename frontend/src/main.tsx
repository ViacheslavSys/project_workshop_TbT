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

const router = createBrowserRouter([
  { path: "/", element: <App /> , children: [
    { index: true, element: <AuthPage/> },
    { path: "auth", element: <AuthPage/> },
    { path: "chat", element: <ChatPage/> },
    { path: "portfolios", element: <PortfolioPage/> },
    { path: "portfolios/:id", element: <PortfolioDetailPage/> },
  ]},
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router}/>
    </Provider>
  </React.StrictMode>
);



