import { Outlet, useLocation } from "react-router-dom";
import Layout from "../src/components/layout/Layout";

export default function App() {
  useLocation(); // поддерживаем актуальное состояние активных ссылок
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
