import { Outlet, useLocation } from "react-router-dom";
import Layout from "../src/components/layout/Layout";

export default function App() {
  useLocation(); // чтобы обновлять активные ссылки
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
