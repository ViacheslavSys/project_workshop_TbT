import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import store from "./store/store.ts";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "./index.css";
import App from "./App";
import AuthPage from "./pages/AuthPage.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> , children: [
    { index: true, element: <AuthPage/> },
    { path: "chat", element: <ChatPage/> },
    { path: "portfolios", element: <PortfolioPage/> },
  ]},
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router}/>
    </Provider>
  </React.StrictMode>
);
