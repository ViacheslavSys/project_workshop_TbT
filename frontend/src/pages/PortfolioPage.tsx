import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PortfolioSummary } from "../api/portfolios";
import { fetchUserPortfolios } from "../api/portfolios";
import { PortfolioLimitModal } from "../components/PortfolioLimitModal";
import { MAX_SAVED_PORTFOLIOS } from "../shared/portfolioLimits";
import { resetChat } from "../store/chatSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

type RiskVisual = {
  label: string;
  badgeClass: string;
  dotClass: string;
  accentClass: string;
};

const riskVisuals: Record<string, RiskVisual> = {
  conservative: {
    label: "\u041a\u043e\u043d\u0441\u0435\u0440\u0432\u0430\u0442\u0438\u0432\u043d\u044b\u0439",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
    accentClass: "bg-emerald-200",
  },
  moderate: {
    label: "\u0421\u0431\u0430\u043b\u0430\u043d\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
    accentClass: "bg-amber-200",
  },
  aggressive: {
    label: "\u0410\u0433\u0440\u0435\u0441\u0441\u0438\u0432\u043d\u044b\u0439",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    dotClass: "bg-rose-500",
    accentClass: "bg-rose-200",
  },
};

const defaultRiskVisual: RiskVisual = {
  label: "-",
  badgeClass: "border-border bg-surface text-text",
  dotClass: "bg-border",
  accentClass: "bg-border",
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
    return "-";
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

const formatRelative = (value?: string | null) => {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "-";
  const diff = Date.now() - timestamp;
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / dayMs);
  if (days <= 0) return "Сегодня";
  if (days === 1) return "Вчера";
  if (days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30);
  return `${months} мес. назад`;
};

const calcProgress = (current?: number | null, target?: number | null) => {
  if (!target || target <= 0 || !current || current <= 0) return 0;
  return Math.min(Math.max(current / target, 0), 1);
};

const getRiskVisual = (value?: string | null): RiskVisual => {
  if (!value) {
    return defaultRiskVisual;
  }
  const normalized = value.trim().toLowerCase();
  const variant = riskVisuals[normalized];
  if (variant) {
    return variant;
  }

  return {
    ...defaultRiskVisual,
    label: value,
  };
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
  const { label: riskLabel, badgeClass, dotClass, accentClass } = getRiskVisual(
    portfolio.risk_profile,
  );
  const updatedLabel = formatRelative(portfolio.updated_at || portfolio.created_at);
  const progress = calcProgress(portfolio.initial_capital, portfolio.target_amount);
  const progressPercent = `${Math.round(progress * 100)}%`;
  const stats = [
    {
      label: "\u0426\u0435\u043b\u0435\u0432\u0430\u044f \u0441\u0443\u043c\u043c\u0430",
      value: formatMoney(portfolio.target_amount),
    },
    {
      label: "\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u0430\u043f\u0438\u0442\u0430\u043b",
      value: formatMoney(portfolio.initial_capital),
    },
    {
      label: "\u0421\u043e\u0437\u0434\u0430\u043d",
      value: formatDate(portfolio.created_at),
      singleLine: true,
    },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="card group relative flex h-full flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-primary/60 focus-visible:-translate-y-0.5 focus-visible:border-primary focus-visible:outline-none"
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 ${accentClass}`}
        aria-hidden="true"
      />
      <div className="card-body flex flex-1 flex-col gap-5">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold leading-snug line-clamp-1">
                {portfolio.portfolio_name}
              </div>
              <div
                className="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis"
                title={`Обновлён: ${updatedLabel}`}
              >
                Обновлён: {updatedLabel}
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}
            >
              <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
              {riskLabel}
            </span>
          </div>
          <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-1 min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  {stat.label}
                </dt>
                <dd
                  className={`text-base font-semibold text-text tabular-nums ${
                    stat.singleLine ? "whitespace-nowrap" : ""
                  }`}
                  title={typeof stat.value === "string" ? stat.value : undefined}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-auto flex items-center justify-between text-sm font-medium text-primary">
          <span>Смотреть детали</span>
          <svg
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

