import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { AppProviders } from "./app/providers";
import { appRouter } from "./app/router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <RouterProvider router={appRouter} />
  </AppProviders>
);
