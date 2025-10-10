import { Outlet, Link, useLocation } from "react-router-dom";
import "./assets/AppTest.css";

export default function App() {
  const location = useLocation();

  return (
    <div className="app-layout">
      {/* ==== ЛЕВАЯ ПАНЕЛЬ НАВИГАЦИИ ==== */}
      <aside className="sidebar">
        <div className="sidebar__logo">
          <span className="sidebar__icon">💼</span>
          <span className="sidebar__title">InvestPro</span>
        </div>

        <nav className="sidebar__nav">
          <Link
            to="/"
            className={`sidebar__link ${
              location.pathname === "/" ? "active" : ""
            }`}
          >
            🏠 Главная
          </Link>

          <Link
            to="/chat"
            className={`sidebar__link ${
              location.pathname === "/chat" ? "active" : ""
            }`}
          >
            🤖 Помощник
          </Link>

          <Link
            to="/portfolio"
            className={`sidebar__link ${
              location.pathname === "/portfolio" ? "active" : ""
            }`}
          >
            📊 Портфели
          </Link>
        </nav>
      </aside>

      {/* ==== ОСНОВНОЙ КОНТЕНТ ==== */}
      <div className="main-content">
        <header className="main-header">
          <h1 className="page-title">
            {location.pathname === "/"
              ? "Главная"
              : location.pathname === "/chat"
              ? "ИИ-помощник"
              : location.pathname === "/portfolio"
              ? "Ваши портфели"
              : "Регистрация"}
          </h1>

          <button className="btn-login">Войти / Регистрация</button>
        </header>

        <main className="content">
          <Outlet /> {/* сюда рендерятся вложенные страницы */}
        </main>
      </div>
    </div>
  );
}
