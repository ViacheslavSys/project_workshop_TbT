import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { PortfolioRecommendation } from "../api/chat";
import { fetchPortfolioAnalysis } from "../api/chat";
import type { PortfolioSummary } from "../api/portfolios";
import { fetchPortfolioById } from "../api/portfolios";
import PortfolioAssetsTable, {
  type PortfolioAssetRow,
} from "../components/PortfolioAssetsTable";
import MLReport from "../components/MLReport";
import { useAppSelector } from "../store/hooks";

type LocationState = {
  portfolio?: PortfolioRecommendation | null;
  summary?: PortfolioSummary | null;
};

const reportFormulas = [
  {
    title: "Ожидаемая доходность портфеля",
    latex: "E[R_p] = \\sum_i w_i \\cdot E[R_i]",
    variables: [
      { name: "w_i", meaning: "доля i‑го актива в портфеле" },
      { name: "E[R_i]", meaning: "ожидаемая доходность i‑го актива" },
    ],
  },
  {
    title: "Риск портфеля (стандартное отклонение)",
    latex:
      "\\sigma_p = \\sqrt{\\sum_i w_i^2 \\sigma_i^2 + 2 \\sum_{i<j} w_i w_j \\sigma_i \\sigma_j \\rho_{ij}}",
    variables: [
      { name: "\\sigma_i", meaning: "волатильность i‑го актива" },
      { name: "\\rho_{ij}", meaning: "корреляция пар активов i и j" },
    ],
  },
  {
    title: "Коэффициент Шарпа",
    latex: "Sharpe = \\frac{E[R_p] - R_f}{\\sigma_p}",
    variables: [{ name: "R_f", meaning: "безрисковая ставка" }],
  },
];

const ensureFiniteNumber = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const formatMoney = (value?: number | null, digits = 0) =>
  `${ensureFiniteNumber(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ₽`;

const formatPercent = (value?: number | null, digits = 1) =>
  `${((value ?? 0) * 100).toFixed(digits)}%`;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  return new Date(timestamp).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PortfolioDetailPage() {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const { isAuthenticated, accessToken } = useAppSelector(
    (state) => state.auth,
  );
  const canViewFullDetails = Boolean(isAuthenticated && accessToken);
  const portfolioId = params.id;

  const locationState = (location.state as LocationState | null) ?? null;
  const initialPortfolio = locationState?.portfolio ?? null;

  const [portfolio, setPortfolio] = useState<PortfolioRecommendation | null>(
    initialPortfolio,
  );
  const [loading, setLoading] = useState(!initialPortfolio);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewFullDetails) {
      setLoading(false);
    }
  }, [canViewFullDetails]);

  const fetchLatestPortfolio = useCallback(async () => {
    if (!accessToken || !portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPortfolioById(accessToken, portfolioId);
      const recommendationPayload =
        response.recommendation as
          | PortfolioRecommendation
          | PortfolioRecommendation[]
          | null
          | undefined;
      const next = Array.isArray(recommendationPayload)
        ? recommendationPayload[0]
        : recommendationPayload ?? null;

      if (!next) {
        setError("Сервер не вернул рекомендацию. Попробуйте позже.");
        setPortfolio(null);
        return;
      }

      setPortfolio(next);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Не удалось получить данные портфеля.";
      setError(message);
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, portfolioId]);

  useEffect(() => {
    if (!initialPortfolio && canViewFullDetails && portfolioId) {
      fetchLatestPortfolio();
    }
  }, [
    initialPortfolio,
    canViewFullDetails,
    portfolioId,
    fetchLatestPortfolio,
  ]);

  const handleRefresh = useCallback(() => {
    if (!accessToken || !portfolioId) return;
    fetchLatestPortfolio();
  }, [fetchLatestPortfolio, accessToken, portfolioId]);

  const fetchAnalysis = useCallback(async () => {
    if (!accessToken || !portfolioId) return;
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const explanation = await fetchPortfolioAnalysis(accessToken, portfolioId);
      setAnalysis(explanation);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Не удалось получить объяснение расчётов.";
      setAnalysisError(message);
      setAnalysis("");
    } finally {
      setAnalysisLoading(false);
    }
  }, [accessToken, portfolioId]);

  useEffect(() => {
    setAnalysis("");
    setAnalysisError(null);
    setAnalysisLoading(false);
  }, [portfolioId]);

  const allocationSummary = useMemo(() => {
    if (!portfolio?.composition) {
      return [];
    }
    return portfolio.composition.map((block) => ({
      assetType: block.asset_type,
      weight: block.target_weight ?? 0,
      amount: block.amount ?? 0,
    }));
  }, [portfolio]);

  const tableRows = useMemo<PortfolioAssetRow[]>(() => {
    if (!portfolio?.composition) return [];

    const totalAmount =
      portfolio.target_amount ?? portfolio.future_value_with_inflation ?? 0;

    return portfolio.composition.flatMap((block) => {
      const assets = Array.isArray(block.assets) ? block.assets : [];
      return assets.map((asset) => ({
        ticker: asset.ticker || block.asset_type,
        name: asset.name || block.asset_type,
        allocation:
          asset.weight ??
          block.target_weight ??
          (asset.amount && totalAmount
            ? asset.amount / totalAmount
            : 0),
        expectedReturn: asset.expected_return ?? 0,
        risk: block.target_weight ?? 0,
        value:
          asset.amount ??
          (asset.weight ?? block.target_weight ?? 0) * totalAmount,
      }));
    });
  }, [portfolio]);

  const planSteps = useMemo(() => {
    const steps = portfolio?.step_by_step_plan?.steps;
    return Array.isArray(steps) ? steps : [];
  }, [portfolio]);

  const planGeneratedAt = useMemo(() => {
    if (!portfolio?.step_by_step_plan?.generated_at) {
      return "";
    }
    return formatDateTime(portfolio.step_by_step_plan.generated_at);
  }, [portfolio]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        Готовим актуальную рекомендацию по портфелю...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card">
          <div className="card-header text-lg font-semibold">
            Не удалось загрузить портфель
          </div>
          <div className="card-body space-y-4 text-sm text-muted">
            <p>{error}</p>
            <button
              type="button"
              className="btn"
              onClick={handleRefresh}
              disabled={loading}
            >
              Повторить запрос
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    if (!canViewFullDetails) {
      return <PortfolioDetailEmptyState />;
    }

    return (
      <div className="mx-auto max-w-2xl">
        <div className="card">
          <div className="card-header text-lg font-semibold">
            Данных для отображения нет
          </div>
          <div className="card-body text-sm text-muted">
            Пересчитайте портфель, чтобы увидеть рекомендации.
            <div className="pt-4">
              <button type="button" className="btn" onClick={handleRefresh}>
                Пересчитать
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const horizonYears = (portfolio.investment_term_months ?? 0) / 12 || 0;
  const sensitiveInfoRestricted = !canViewFullDetails;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase text-muted">
            Портфель #{params.id ?? "—"}
          </p>
          <h1 className="text-2xl font-semibold">{portfolio.smart_goal}</h1>
          <p className="text-sm text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Цель:</span>
            <SensitiveValue restricted={sensitiveInfoRestricted}>
              {formatMoney(portfolio.target_amount)}
            </SensitiveValue>
            <span>· Горизонт:</span>
            <SensitiveValue restricted={sensitiveInfoRestricted}>
              {`${horizonYears.toFixed(1)} лет`}
            </SensitiveValue>
            <span>· Ожидаемая доходность:</span>
            <SensitiveValue restricted={sensitiveInfoRestricted}>
              {formatPercent(portfolio.expected_portfolio_return)}
            </SensitiveValue>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/portfolios" className="tab">
            ← Назад к списку
          </Link>
          <button
            type="button"
            className="tab tab-active"
            onClick={handleRefresh}
            disabled={loading}
          >
            Обновить расчёт
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Целевая сумма"
          value={formatMoney(portfolio.target_amount)}
          restricted={sensitiveInfoRestricted}
        />
        <SummaryCard
          label="Стартовый капитал"
          value={formatMoney(portfolio.initial_capital)}
        />
        <SummaryCard
          label="Ежемесячный взнос"
          value={formatMoney(
            portfolio.monthly_payment_detail?.monthly_payment,
          )}
        />
        <SummaryCard
          label="Будущая стоимость с инфляцией"
          value={formatMoney(portfolio.future_value_with_inflation)}
        />
        <SummaryCard
          label="Годовая инфляция в модели"
          value={formatPercent(portfolio.annual_inflation_rate)}
          restricted={sensitiveInfoRestricted}
        />
        <SummaryCard
          label="Горизонт инвестиций"
          value={`${horizonYears.toFixed(1)} года`}
          restricted={sensitiveInfoRestricted}
        />
        <SummaryCard
          label="Риск-профиль"
          value={portfolio.risk_profile || "—"}
          restricted={sensitiveInfoRestricted}
        />
        <SummaryCard
          label="Ожидаемая доходность"
          value={formatPercent(portfolio.expected_portfolio_return)}
          restricted={sensitiveInfoRestricted}
        />
      </section>

      <RestrictedPortfolioDetails restricted={!canViewFullDetails}>
        <div className="space-y-6">
          <section className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Разбивка по классам активов</div>
                <p className="text-sm text-muted">
                  Рекомендованные доли классов активов в итоговом портфеле
                </p>
              </div>
            </div>
            <div className="card-body flex flex-wrap gap-3">
              {allocationSummary.length ? (
                allocationSummary.map((item, index) => (
                  <div
                    key={`${item.assetType}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <div className="text-muted">{item.assetType}</div>
                    <div className="text-lg font-semibold">
                      {formatPercent(item.weight)}
                    </div>
                    <div className="text-xs text-muted">
                      ≈ {formatMoney(item.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Нет данных о распределении активов.
                </p>
              )}
            </div>
          </section>

          {tableRows.length ? (
            <PortfolioAssetsTable rows={tableRows} title="Рекомендуемые активы к покупке" />
          ) : (
            <div className="card">
              <div className="card-body text-sm text-muted">
                Список активов отсутствует. Попробуйте пересчитать портфель.
              </div>
            </div>
          )}
          {planSteps.length ? (
            <section className="card space-y-4">
              <div className="card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">Пошаговый инвестиционный план</div>
                  <p className="text-sm text-muted">
                    Подсказывает, как распределять ежемесячный взнос {formatMoney(portfolio.monthly_payment_detail?.monthly_payment)} и выполнять покупки по плану.
                  </p>
                </div>
                {planGeneratedAt ? (
                  <div className="text-xs text-muted">Сформирован {planGeneratedAt}</div>
                ) : null}
              </div>
              <div className="card-body space-y-4">
                {planSteps.map((step, index) => {
                  const actions = Array.isArray(step.actions) ? step.actions : [];
                  const displayNumber = Number.isFinite(step.step_number)
                    ? step.step_number + 1
                    : index + 1;

                  return (
                    <article
                      key={`plan-step-${step.step_number}-${index}`}
                      className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-xs uppercase text-muted">Шаг {displayNumber}</div>
                        <div className="text-sm font-semibold">{step.title}</div>
                      </div>
                      {step.description ? (
                        <p className="text-sm text-muted">{step.description}</p>
                      ) : null}
                      {actions.length ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-text">
                          {actions.map((action, actionIndex) => (
                            <li
                              key={`plan-step-${step.step_number}-${actionIndex}`}
                              className="text-muted"
                            >
                              {action}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </RestrictedPortfolioDetails>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Объяснение расчётов</h2>
            <p className="text-sm text-muted">
              Генерируется на сервере на основе ваших целей и риск-профиля
            </p>
          </div>
          <button
            type="button"
            className="tab"
            onClick={fetchAnalysis}
            disabled={analysisLoading || !canViewFullDetails}
          >
            {analysisLoading ? "Запрашиваем..." : "Запросить объяснение"}
          </button>
        </div>
        {analysisError && !analysisLoading ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            {analysisError}
          </div>
        ) : null}
        {(analysisLoading || analysis) && (
          <MLReport
            explanation={
              analysisLoading
                ? "AI готовит пояснения по расчётам..."
                : analysis
            }
            formulas={reportFormulas}
          />
        )}
      </section>
    </div>
  );
}

function PortfolioDetailEmptyState() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card text-center">
        <div className="card-header text-lg font-semibold">
          Войдите, чтобы увидеть портфель
        </div>
        <div className="card-body space-y-4 text-sm text-muted">
          <p>
            Детальная информация доступна только авторизованным пользователям.
            Сначала создайте портфель на странице чата.
          </p>
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

function SummaryCard({
  label,
  value,
  restricted = false,
}: {
  label: string;
  value: ReactNode;
  restricted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="text-base font-semibold">
        <SensitiveValue restricted={restricted}>{value}</SensitiveValue>
      </div>
    </div>
  );
}

function SensitiveValue({
  children,
  restricted,
}: {
  children: ReactNode;
  restricted: boolean;
}) {
  if (!restricted) {
    return <>{children}</>;
  }

  return (
    <span
      className="blur-sm select-none"
      aria-label="Доступно после регистрации"
    >
      {children}
    </span>
  );
}

function RestrictedPortfolioDetails({
  children,
  restricted,
}: {
  children: ReactNode;
  restricted: boolean;
}) {
  if (!restricted) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div
        className="select-none blur-md pointer-events-none"
        aria-hidden="true"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-border/70 bg-bg/80 backdrop-blur" />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-start gap-4 px-6 py-10 text-center">
        <p className="text-base font-semibold text-text">
          Структура портфеля (распределение и количество ценных бумаг) доступна только
          зарегистрированным пользователям.
        </p>
        <Link to="/auth" className="btn">
          Войти, чтобы увидеть структуру
        </Link>
      </div>
    </div>
  );
}


