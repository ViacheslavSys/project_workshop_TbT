import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PortfolioSummary } from "../api/portfolios";
import { fetchUserPortfolios } from "../api/portfolios";
import { PortfolioLimitModal } from "../components/PortfolioLimitModal";
import { MAX_SAVED_PORTFOLIOS } from "../shared/portfolioLimits";
import { resetChat } from "../store/chatSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const riskLabels: Record<string, string> = {
  conservative: "Консервативный",
  moderate: "Умеренный",
  aggressive: "Агрессивный",
};

const formatMoney = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ₽`;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "—";
  }
  return new Date(timestamp).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getRiskLabel = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const normalized = value.trim().toLowerCase();
  return riskLabels[normalized] ?? value;
};

export default function PortfolioPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, accessToken } = useAppSelector((state) => ({
    isAuthenticated: state.auth.isAuthenticated,
    accessToken: state.auth.accessToken,
  }));
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLimitModalOpen, setLimitModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setPortfolios([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchUserPortfolios(accessToken)
      .then((items) => {
        if (!active) return;
        setPortfolios(items);
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
  }, [isAuthenticated, accessToken]);

  const handleCardClick = (portfolio: PortfolioSummary) => {
    navigate(`/portfolios/${portfolio.id}`, {
      state: {
        summary: portfolio,
        origin: "portfolio-list",
      },
    });
  };

  const handleCreatePortfolio = () => {
    if (loading) {
      return;
    }
    if (portfolios.length >= MAX_SAVED_PORTFOLIOS) {
      setLimitModalOpen(true);
      return;
    }
    dispatch(resetChat());
    navigate("/chat", { state: { startNewPortfolio: true } });
  };

  const limitModal = (
    <PortfolioLimitModal
      open={isLimitModalOpen}
      onClose={() => setLimitModalOpen(false)}
    />
  );

  if (!isAuthenticated || !accessToken) {
    return (
      <>
        <PortfolioEmptyState />
        {limitModal}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="flex min-h-[50vh] items-center justify-center text-muted">
          Загружаем ваши портфели...
        </div>
        {limitModal}
      </>
    );
  }

  if (!portfolios.length) {
    return (
      <>
        <PortfolioEmptyState
          error={error}
          isAuthenticated
          onCreatePortfolio={handleCreatePortfolio}
        />
        {limitModal}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ваши портфели</h1>
          <p className="text-sm text-muted">
            Мы нашли сохранённые рекомендации — выберите портфель, чтобы открыть
            подробный состав и расчёты.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary w-full whitespace-nowrap md:w-auto"
          onClick={handleCreatePortfolio}
          disabled={loading}
        >
          Создать новый портфель
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {portfolios.map((portfolio) => (
          <PortfolioSummaryCard
            key={portfolio.id}
            portfolio={portfolio}
            onClick={() => handleCardClick(portfolio)}
          />
        ))}
      </div>
      {limitModal}
    </div>
  );
}

function PortfolioEmptyState({
  error,
  isAuthenticated = false,
  onCreatePortfolio,
}: {
  error?: string | null;
  isAuthenticated?: boolean;
  onCreatePortfolio?: () => void;
}) {
  const description = isAuthenticated
    ? "Пока нет сохранённых портфелей. Перейдите в чат-бот, чтобы сформировать первый портфель."
    : "Авторизуйтесь и создайте первый портфель вместе с AI‑советником.";
  const ctaLabel = isAuthenticated ? "Перейти в чат-бот" : "Создать портфель";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card text-center">
        <div className="card-header text-lg font-semibold">
          Пока нет сохранённых портфелей
        </div>
        <div className="card-body space-y-4 text-sm text-muted">
          <p>{description}</p>
          {error ? (
            <div className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-danger">
              {error}
            </div>
          ) : null}
          <div>
            {isAuthenticated ? (
              <button
                type="button"
                className="btn"
                onClick={onCreatePortfolio}
                disabled={!onCreatePortfolio}
              >
                Создать новый портфель
              </button>
            ) : (
              <Link to="/chat" className="btn">
                {ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioSummaryCard({
  portfolio,
  onClick,
}: {
  portfolio: PortfolioSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card text-left transition hover:-translate-y-0.5 hover:border-primary/60 focus-visible:-translate-y-0.5 focus-visible:border-primary focus-visible:outline-none"
    >
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-muted">Портфель #{portfolio.id}</div>
            <div className="text-lg font-semibold">{portfolio.portfolio_name}</div>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs">
            {getRiskLabel(portfolio.risk_profile)}
          </span>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Целевая сумма</dt>
            <dd className="font-semibold">{formatMoney(portfolio.target_amount)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Стартовый капитал</dt>
            <dd className="font-semibold">{formatMoney(portfolio.initial_capital)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Создан</dt>
            <dd className="font-semibold">{formatDate(portfolio.created_at)}</dd>
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
