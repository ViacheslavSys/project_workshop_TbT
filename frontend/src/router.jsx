import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import AppTest from "./AppTest";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Auth from "./components/Auth";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppTest />,
    children: [
      { index: true, element: <Home /> },
      { path: "chat", element: <Chat /> },
      { path: "auth", element: <Auth /> },
    ],
  },
]);

export default router;
