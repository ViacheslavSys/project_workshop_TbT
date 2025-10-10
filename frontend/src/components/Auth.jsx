import React, { useState } from "react";
import "../theme-dark.css";
import "../assets/Auth.css"

export default function Auth() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Регистрация:", form);
    alert(`Регистрация успешна для ${form.email}`);
  };

  const handleYandexLogin = () => {
    // Здесь можно подключить реальный OAuth через Яндекс
    window.location.href =
      "https://passport.yandex.ru/auth?origin=yourapp"; // пример
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <h2>Создать аккаунт</h2>
        <p className="text-secondary">Заполните данные для регистрации</p>

        <form onSubmit={handleSubmit} className="register-form">
          <label>
            Имя
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>

          <button type="submit" className="btn btn--primary">
            Зарегистрироваться
          </button>
        </form>

        <div className="divider">
          <span>или</span>
        </div>

        <button className="btn btn--yandex" onClick={handleYandexLogin}>
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/8/88/Yandex_icon.svg"
            alt="Yandex"
            className="yandex-icon"
          />
          Войти через Яндекс
        </button>
      </div>
    </div>
  );
}
