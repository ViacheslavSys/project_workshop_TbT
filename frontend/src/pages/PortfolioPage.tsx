import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PortfolioRecommendation } from "../api/chat";
import { calculatePortfolio } from "../api/chat";
import { useAppSelector } from "../store/hooks";

const MAX_VISIBLE_PORTFOLIOS = 3;

const riskLabels: Record<string, string> = {
  conservative: "Консервативный",
  moderate: "Умеренный",
  aggressive: "Агрессивный",
};

const horizonLabels: Record<string, string> = {
  short: "Краткосрочный",
  medium: "Среднесрочный",
  long: "Долгосрочный",
};

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const userId = user?.id ? String(user.id) : null;
  const [portfolios, setPortfolios] = useState<PortfolioRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setPortfolios([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    calculatePortfolio(userId)
      .then((response) => {
        if (!active) return;
        const recommendationPayload =
          response.recommendation as
            | PortfolioRecommendation
            | PortfolioRecommendation[]
            | null
            | undefined;
        const next = Array.isArray(recommendationPayload)
          ? recommendationPayload
          : recommendationPayload
            ? [recommendationPayload]
            : [];
        setPortfolios(next);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось загрузить портфели. Попробуйте позже.";
        setError(message);
        setPortfolios([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const visiblePortfolios = useMemo(
    () => portfolios.slice(0, MAX_VISIBLE_PORTFOLIOS),
    [portfolios],
  );

  const handleCardClick = (portfolio: PortfolioRecommendation, index: number) => {
    const portfolioId =
      (portfolio as { portfolio_id?: string | number; id?: string | number }).portfolio_id ??
      (portfolio as { id?: string | number }).id ??
      `${index}`;

    navigate(`/portfolios/${portfolioId}`, {
      state: {
        portfolio,
        origin: "portfolio-list",
      },
    });
  };

  if (!isAuthenticated || !userId) {
    return <PortfolioEmptyState />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        Собираем ваши инвестиционные рекомендации...
      </div>
    );
  }

  if (!visiblePortfolios.length) {
    return <PortfolioEmptyState error={error} isAuthenticated />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Ваши портфели</h1>
        <p className="text-sm text-muted">
          Мы сохранили свежие рекомендации — выберите любой портфель, чтобы посмотреть детали и расчёты.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiblePortfolios.map((portfolio, index) => (
          <PortfolioMiniCard
            key={`${portfolio.smart_goal}-${index}`}
            portfolio={portfolio}
            index={index}
            onClick={() => handleCardClick(portfolio, index)}
          />
        ))}
      </div>
    </div>
  );
}

function PortfolioEmptyState({
  error,
  isAuthenticated = false,
}: {
  error?: string | null;
  isAuthenticated?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card text-center">
        <div className="card-header text-lg font-semibold">
          Пока нет сохранённых портфелей
        </div>
        <div className="card-body space-y-4 text-sm text-muted">
          <p>
            {isAuthenticated
              ? "Пройдите короткий диалог с советником, и мы сформируем ваши персональные портфели."
              : "Авторизуйтесь и создайте первый портфель вместе с AI‑советником."}
          </p>
          {error ? (
            <div className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-danger">
              {error}
            </div>
          ) : null}
          <div>
            <Link to="/chat" className="btn">
              Создать портфель
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioMiniCard({
  portfolio,
  index,
  onClick,
}: {
  portfolio: PortfolioRecommendation;
  index: number;
  onClick: () => void;
}) {
  const horizonYears = (portfolio.investment_term_months ?? 0) / 12 || 0;
  const riskLabel =
    riskLabels[portfolio.risk_profile] ?? portfolio.risk_profile ?? "Не указан";
  const horizonLabel =
    horizonLabels[portfolio.time_horizon] ??
    portfolio.time_horizon ??
    "Не указан";

  const ensureFiniteNumber = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const formatMoney = (value?: number | null, digits = 0) =>
    `${ensureFiniteNumber(value).toLocaleString("ru-RU", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })} ₽`;

  const formatPercent = (value?: number | null) =>
    `${((value ?? 0) * 100).toFixed(1)}%`;

  const monthlyPayment =
    portfolio.monthly_payment_detail?.monthly_payment ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card text-left transition hover:-translate-y-0.5 hover:border-primary/60 focus-visible:-translate-y-0.5 focus-visible:border-primary focus-visible:outline-none"
    >
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs uppercase text-muted">SMART-цель #{index + 1}</div>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            {riskLabel}
          </span>
        </div>
        <div>
          <div className="text-sm text-muted">Цель</div>
          <div className="text-lg font-semibold">{portfolio.smart_goal}</div>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Целевая сумма</dt>
            <dd className="font-semibold">{formatMoney(portfolio.target_amount)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Ожидаемая доходность</dt>
            <dd className="font-semibold">
              {formatPercent(portfolio.expected_portfolio_return)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Горизонт</dt>
            <dd className="font-semibold">
              {horizonLabel} · {horizonYears.toFixed(1)} г.
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Ежемесячный взнос</dt>
            <dd className="font-semibold">{formatMoney(monthlyPayment)}</dd>
          </div>
        </dl>
        <div className="flex items-center justify-between text-sm font-medium text-primary">
          Смотреть детали
          <span aria-hidden="true">→</span>
        </div>
      </div>
    </button>
  );
}
