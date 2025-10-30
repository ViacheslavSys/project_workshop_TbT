# Документация API backend

## Общие сведения
- Базовый URL для локальной разработки: `http://localhost:8000`.
- API не требует авторизации; по умолчанию используется формат ответов `application/json` (исключение — multipart запрос в `/dialog/chat`).
- Ошибочные ответы возвращают JSON с полем `detail`.
- Для работы диалоговых, риск- и портфельных сценариев необходим Redis. Данные кешируются с ключами вида `user:{user_id}:*`.
- Интерактивная документация FastAPI доступна по адресу `http://localhost:8000/docs`.

## Сводка эндпоинтов
| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/health` | Проверка состояния приложения и подключения к БД |
| GET | `/users/` | Получить список пользователей |
| POST | `/users/` | Создать пользователя |
| PUT | `/users/{user_id}` | Обновить данные пользователя |
| DELETE | `/users/{user_id}` | Удалить пользователя |
| GET | `/assets/` | Получить список активов |
| POST | `/assets/` | Добавить актив |
| POST | `/portfolios/calculate` | Рассчитать портфель на основе целей пользователя |
| POST | `/portfolios/create` | Сохранить портфель (заглушка) и вернуть расчет |
| GET | `/risk-profile/questions` | Получить вопросы профиля риска |
| POST | `/risk-profile/answers` | Отправить ответы профиля риска |
| POST | `/risk-profile/clarify` | Ответить на уточняющие вопросы |
| GET | `/risk-profile/result` | Получить сохраненный результат профиля риска |
| POST | `/dialog/chat` | Общение с LLM/Whisper, сохранение целей пользователя |

## Поток работы с ассистентом
1. Клиент вызывает `POST /dialog/chat`, передавая `user_id` и текст/аудио. LLM-сервис сохраняет цель инвестирования (`term`, `sum`, `capital`, `reason`) в Redis.
2. После сохранения целей можно вызывать `POST /risk-profile/answers` и, при необходимости, `POST /risk-profile/clarify`. Результат сохраняется в `user:{user_id}:risk_result`.
3. Когда цель пользователя записана, `POST /portfolios/calculate` и `POST /portfolios/create` используют те же данные из Redis для расчета рекомендаций.

---

## Эндпоинты

### `/health`
#### GET `/health`
- Назначение: проверить доступность приложения и БД.
- Параметры: нет.
- Ответы:
  - 200 OK — `{"status": "ok", "database": "connected"}` при успешном подключении.
  - 200 OK — `{"status": "error", "database": "<описание ошибки>"}` если проверка соединения завершается исключением (исключение не пробрасывается наружу).

### `/users`
#### GET `/users/`
- Назначение: получить список всех пользователей.
- Ответ 200 OK — массив `UserOut`.

#### POST `/users/`
- Назначение: создать пользователя.
- Тело запроса (`application/json`):
  ```json
  {
    "username": "string",
    "email": "user@example.com",
    "password": "string"
  }
  ```
- Ответ 200 OK — объект `UserOut`.
- Возможные ошибки: нарушение уникальности `username`/`email` приведет к ошибке БД (500).

#### PUT `/users/{user_id}`
- Назначение: обновить данные пользователя.
- Путь: `user_id` — целое число.
- Тело запроса (`application/json`): любые поля из `username`, `email`, `password`.
- Ответ 200 OK — объект `UserOut`.
- Ответ 404 — `{"detail": "User not found"}` если пользователь отсутствует.

#### DELETE `/users/{user_id}`
- Назначение: удалить пользователя.
- Ответ 200 OK — `{"message": "User deleted successfully"}`.
- Ответ 404 — `{"detail": "User not found"}`.

### `/assets`
#### GET `/assets/`
- Назначение: получить все активы.
- Ответ 200 OK — массив `AssetOut`.

#### POST `/assets/`
- Назначение: добавить актив.
- Тело запроса (`application/json`):
  ```json
  {
    "ticker": "string",
    "name": "string",
    "sector": "string",
    "sector_type": "string"
  }
  ```
- Ответ 200 OK — объект `AssetOut`.

### `/portfolios`
> Для обоих эндпоинтов требуется, чтобы `POST /dialog/chat` ранее сохранил цель инвестирования в ключе `user:{user_id}:llm_goal`. При отсутствии данных сервис возвращает 400 с пояснением.

#### POST `/portfolios/calculate`
- Назначение: выполнить расчет рекомендованного портфеля для пользователя.
- Тело запроса (`application/json`):
  ```json
  {
    "user_id": "string"
  }
  ```
- Ответ 200 OK — `PortfolioCalculationResponse`.
- Ответы об ошибках:
  - 400 — при отсутствии сохраненной цели или если входные данные некорректны.
  - 500 — любые неожиданные ошибки из сервиса расчета.

#### POST `/portfolios/create`
- Назначение: сохранить рассчитанный портфель (создание пока реализовано как заглушка) и вернуть расчет.
- Тело запроса (`application/json`):
  ```json
  {
    "user_id": "string",
    "portfolio_name": "string"
  }
  ```
- Ответ 200 OK —
  ```json
  {
    "message": "Портфель успешно сохранен",
    "portfolio_id": "generated_id",
    "calculation": { ... PortfolioCalculationResponse ... }
  }
  ```
  Реальный `portfolio_id` пока не генерируется и возвращается значение-заглушка.
- Ответы 400/500 аналогичны `POST /portfolios/calculate`.

### `/risk-profile`
#### GET `/risk-profile/questions`
- Назначение: получить список вопросов профиля риска.
- Ответ 200 OK — массив `RiskQuestion`. Возвращаются только вопросы без флага `hidden`.

#### POST `/risk-profile/answers`
- Назначение: передать ответы пользователя на вопросы.
- Параметры запроса: `user_id` (query, string).
- Тело запроса (`application/json`): массив `RiskAnswer`.
  ```json
  [
    {"question_id": 1, "answer": "A"},
    {"question_id": 2, "answer": "B"}
  ]
  ```
- Ответы:
  - 200 OK — `{"stage": "final", "result": RiskProfileResult}` если противоречий нет. Результат кешируется в `user:{user_id}:risk_result`.
  - 200 OK — `{"stage": "clarification_needed", "clarifying_questions": [...], "total_questions": N}` если обнаружены противоречия; ответы сохраняются для последующего уточнения.
  - 400 — если цель от LLM не получена либо данные противоречивы и не могут быть обработаны.

#### POST `/risk-profile/clarify`
- Назначение: ответить на уточняющие вопросы.
- Параметры запроса: `user_id` (query, string).
- Тело запроса (`application/json`):
  ```json
  [
    {"code": "low_risk_buy_dip", "answer": "A"}
  ]
  ```
- Ответ 200 OK — `{"stage": "final", "result": RiskProfileResult}`.
- Ответ 400 — если нет сохраненных ответов для уточнения.

#### GET `/risk-profile/result`
- Назначение: получить сохраненный результат профиля риска.
- Параметры запроса: `user_id` (query, string).
- Ответ 200 OK — `RiskProfileResult`.
- Ответ 404 — если результат не найден.

### `/dialog`
#### POST `/dialog/chat`
- Назначение: отправить текст или аудиосообщение ассистенту, получить ответ и, при наличии структурированных данных, сохранить цель инвестирования в Redis.
- Формат запроса: `multipart/form-data`.
  - `user_id` — обязательное поле `string`.
  - `message` — опциональное поле `string`.
  - `audio_file` — опциональный файл (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.mp4`).
- Необходимо передать хотя бы `message` или `audio_file`, иначе вернется 400.
- Ответ 200 OK — `ChatResponse` с полем `response`.
- Поведение:
  - если передан `audio_file`, используется Whisper для транскрипции;
  - ответ LLM сохраняется в историю переписки в Redis (`user:{user_id}:chat_history`);
  - если LLM вернул JSON с полями `term`, `sum`, `capital`, `reason`, данные сохраняются в `user:{user_id}:llm_goal` и используются портфельным сервисом.
- Ответы 400 — при неверном формате файла или отсутствии входного сообщения.
- Ответ 500 — при ошибках в обработке аудио или запросе к LLM.

---

## Схемы данных

| Схема | Описание |
| --- | --- |
| `UserCreate` | `username`, `email`, `password`. |
| `UserUpdate` | Любые из `username`, `email`, `password`. |
| `UserOut` | `id`, `username`, `email`, `full_name` (nullable), `is_active`. |
| `AssetCreate` | `ticker`, `name`, `sector`, `sector_type`. |
| `AssetOut` | `id`, `ticker`, `name`, `sector`, `sector_type`, `is_active`. |
| `PortfolioCalculationRequest` | `user_id`. |
| `PortfolioCreate` | `user_id`, `portfolio_name`. |
| `PortfolioCalculationResponse` | `target_amount`, `initial_capital`, `investment_term_months`, `annual_inflation_rate`, `future_value_with_inflation`, `recommendation`. |
| `PortfolioRecommendation` | `target_amount`, `initial_capital`, `investment_term_months`, `annual_inflation_rate`, `future_value_with_inflation`, `risk_profile`, `time_horizon`, `smart_goal`, `total_investment`, `expected_portfolio_return`, `composition`, `monthly_payment_detail`. |
| `PortfolioComposition` | `asset_type`, `target_weight`, `actual_weight`, `amount`, `assets` (`AssetAllocation`). |
| `AssetAllocation` | `name`, `type`, `ticker`, `quantity`, `price`, `weight`, `amount`, `expected_return`. |
| `MonthlyPaymentDetail` | `monthly_payment`, `future_capital`, `total_months`, `monthly_rate`, `annuity_factor`. |
| `RiskQuestion` | `id`, `text`, `options`. |
| `RiskAnswer` | `question_id`, `answer`. |
| `ClarificationQuestion` | `code`, `question`, `options`. |
| `ClarificationAnswer` | `code`, `answer`. |
| `RiskProfileResult` | `profile`, `conservative_score`, `moderate_score`, `aggressive_score`, `investment_horizon`. |
| `ChatResponse` | `response`. |

