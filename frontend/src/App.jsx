import { Outlet, Link } from "react-router-dom";
import './theme-dark.css';

export default function App() {
  return (
    <div className="main_page">
      <header>
        <nav className="main_nav">
          <Link to="/">Главная</Link>
          <Link to="/chat">Помощник</Link>
        </nav>
      </header>

      <main>
        <Outlet /> {/* Здесь отображаются страницы */}
      </main>
    </div>
  );
}
