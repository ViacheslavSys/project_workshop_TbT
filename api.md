# Документация API backend

## Общие сведения
- Базовый URL по умолчанию: `http://localhost:8000`
- Ответы возвращаются в формате JSON; успешные сценарии используют HTTP 200, если не указано иначе.
- Аутентификация в текущей версии отсутствует.

## Сводка эндпоинтов
| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/health` | Проверка состояния сервиса и базы данных |
| GET | `/users/` | Получить список пользователей |
| POST | `/users/` | Создать пользователя |
| PUT | `/users/{user_id}` | Обновить пользователя |
| DELETE | `/users/{user_id}` | Удалить пользователя |
| GET | `/assets/` | Получить список активов |
| POST | `/assets/` | Добавить новый актив |
| GET | `/portfolios/` | Получить портфели пользователя |
| POST | `/portfolios/` | Создать портфель |
| DELETE | `/portfolios/{portfolio_id}` | Удалить портфель |
| GET | `/risk-profile/questions` | Получить вопросы риск-профиля |
| POST | `/risk-profile/answers` | Отправить ответы по риск-профилю |
| POST | `/risk-profile/clarify` | Отправить уточняющие ответы |
| GET | `/risk-profile/result` | Получить сохраненный результат риск-профиля |
| POST | `/dialog/chat` | Отправить текст или аудио в диалоговую систему |

---

## Endpoint `/health`
### GET `/health`
- Назначение: проверить доступность приложения и соединение с БД.
- Параметры запроса: отсутствуют.
- Ответ 200: `status = ok`, `database = connected`.
- Ответ при ошибке подключения (HTTP 200): `status = error`, `database = текст исключения`.

---

## Endpoint `/users`
### GET `/users/`
- Назначение: вернуть всех пользователей.
- Параметры запроса: отсутствуют.
- Ответ 200: список объектов `UserOut`.

### POST `/users/`
- Назначение: создать пользователя.
- Тело запроса (`application/json`): `username`, `email`, `password`.
- Ответ 200: объект `UserOut`.

### PUT `/users/{user_id}`
- Назначение: обновить пользователя.
- Параметры пути: `user_id` (int, обязательно).
- Тело запроса (`application/json`): любые из `username`, `email`, `password`.
- Ответ 200: объект `UserOut`.
- Ответ 404: пользователь не найден.

### DELETE `/users/{user_id}`
- Назначение: удалить пользователя.
- Параметры пути: `user_id` (int).
- Ответ 200: сообщение `User deleted successfully`.
- Ответ 404: пользователь не найден.

---

## Endpoint `/assets`
### GET `/assets/`
- Назначение: получить список активов.
- Параметры запроса: отсутствуют.
- Ответ 200: список объектов `AssetOut`.

### POST `/assets/`
- Назначение: создать актив.
- Тело запроса (`application/json`): `ticker`, `name`, `sector`, `sector_type`.
- Ответ 200: объект `AssetOut`.

---

## Endpoint `/portfolios`
### GET `/portfolios/`
- Назначение: вернуть портфели пользователя.
- Параметры запроса: `user_id` (query, int, обязательно).
- Ответ 200: список объектов `PortfolioOut`.

### POST `/portfolios/`
- Назначение: создать портфель.
- Параметры запроса: `user_id` (query, int, обязательно).
- Тело запроса (`application/json`): `investment_amount`, `risk_profile`, `time_horizon`, массив `assets` с парами `asset_id` и `weight`.
- Ответ 200: объект `PortfolioOut`.

### DELETE `/portfolios/{portfolio_id}`
- Назначение: удалить портфель.
- Параметры пути: `portfolio_id` (int).
- Ответ 200: сообщение `Portfolio deleted successfully`.
- Ответ 404: портфель не найден.

---

## Endpoint `/risk-profile`
### GET `/risk-profile/questions`
- Назначение: получить отображаемые вопросы риск-профиля.
- Параметры запроса: отсутствуют.
- Ответ 200: список объектов `RiskQuestion`.

### POST `/risk-profile/answers`
- Назначение: отправить ответы пользователя и получить результат или запрос на уточнение.
- Параметры запроса: `user_id` (query, string, обязательно).
- Тело запроса (`application/json`): массив `RiskAnswer` (пары `question_id`, `answer`).
- Ответ 200 (стадия `final`): словарь со `stage` = `final` и вложенным `result` (`profile`, `conservative_score`, `moderate_score`, `aggressive_score`, `investment_horizon`).
- Ответ 200 (стадия `clarification_needed`): `stage = clarification_needed`, список `clarifying_questions` (элементы с `code`, `question`, `options`), поле `total_questions`.

### POST `/risk-profile/clarify`
- Назначение: отправить уточняющие ответы и получить финальный результат.
- Параметры запроса: `user_id` (query, string, обязательно).
- Тело запроса (`application/json`): массив объектов с `code` и `answer`.
- Ответ 200: структура как для стадии `final` (см. выше).
- Ответ 400: если для пользователя нет сохраненных исходных ответов.

### GET `/risk-profile/result`
- Назначение: получить ранее сохраненный результат риск-профиля.
- Параметры запроса: `user_id` (query, string, обязательно).
- Ответ 200: объект `RiskProfileResult`.
- Ответ 404: результат не найден.

---

## Endpoint `/dialog`
### POST `/dialog/chat`
- Назначение: отправить текстовое сообщение или аудиофайл для обработки Whisper и LLM.
- Формат запроса: `multipart/form-data`.
- Поля формы: `user_id` (string, обязательно), `message` (string, опционально), `audio_file` (file, опционально).
- Поддерживаемые форматы аудио: .mp3, .wav, .m4a, .flac, .ogg, .mp4.
- Правила: необходимо передать хотя бы `message` или `audio_file`; при наличии аудио выполняется транскрибация и дальнейшая отправка в LLM.
- Ответ 200: объект `ChatResponse` с полем `response`.
- Ответ 400: неподдерживаемый формат файла или отсутствие и текста, и аудио.
- Ответ 500: внутренняя ошибка обработки.

---

## Описание моделей
- `UserCreate`: `username` (string), `email` (Email), `password` (string).
- `UserUpdate`: те же поля, все опциональны.
- `UserOut`: `id` (int), `username` (string), `email` (Email), `full_name` (string|null), `is_active` (bool).
- `AssetCreate` / `AssetOut`: `ticker` (string), `name` (string), `sector` (string), `sector_type` (string), плюс `id` (int) и `is_active` (bool) в ответе.
- `PortfolioCreate`: `investment_amount` (float), `risk_profile` (string), `time_horizon` (int), `assets` (массив { `asset_id`: int, `weight`: float }, опционально).
- `PortfolioOut`: поля создания плюс расчетные показатели `expected_return`, `portfolio_risk`, `sharpe_ratio`, `current_cycle_phase`, `created_at`.
- `RiskQuestion`: `id` (int), `text` (string), `options` (массив строк).
- `RiskAnswer`: `question_id` (int), `answer` (string, первая буква выбранного варианта).
- `RiskProfileResult`: `profile` (string), `conservative_score` (int), `moderate_score` (int), `aggressive_score` (int), `investment_horizon` (string|null).
- `ChatResponse`: `response` (string).
