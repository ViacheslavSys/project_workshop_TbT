import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { MonthlyPaymentDetail, PortfolioRecommendation } from "../api/chat";
import { fetchPortfolioAnalysis } from "../api/chat";
import type { PortfolioSummary } from "../api/portfolios";
import { fetchPortfolioById } from "../api/portfolios";
import PortfolioAssetsTable, {
  type PortfolioAssetBlock,
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
        setAnalysis("");
        return;
      }

      setPortfolio(next);
      setAnalysis(
        typeof response.analysis === "string" ? response.analysis : "",
      );
      setAnalysisError(null);
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

  const assetBlocks = useMemo<PortfolioAssetBlock[]>(() => {
    if (!portfolio?.composition) return [];

    const totalAmount =
      portfolio.target_amount ?? portfolio.future_value_with_inflation ?? 0;

    return portfolio.composition.map((block) => {
      const assets = Array.isArray(block.assets) ? block.assets : [];
      return {
        assetType: block.asset_type,
        targetWeight: block.target_weight,
        amount: block.amount,
        rows: assets.map((asset) => ({
          ticker: asset.ticker || block.asset_type,
          name: asset.name || block.asset_type,
          allocation:
            asset.weight ??
            block.target_weight ??
            (asset.amount && totalAmount
              ? asset.amount / totalAmount
              : 0),
          quantity:
            typeof asset.quantity === "number" ? asset.quantity : undefined,
          price: typeof asset.price === "number" ? asset.price : undefined,
          amount:
            asset.amount ??
            (asset.weight ?? block.target_weight ?? 0) * totalAmount,
        })),
      };
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

  const updatedAtLabel = useMemo(() => {
    const formatted = formatDateTime(portfolio?.updated_at);
    return formatted || "нет данных";
  }, [portfolio?.updated_at]);

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
  const monthlyPlanDetail = portfolio.monthly_payment_detail ?? null;
  const planStepsTotal = portfolio.step_by_step_plan?.total_steps;
  const planStepsCountLabel = planStepsTotal ?? (planSteps.length || null);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{portfolio.smart_goal}</h1>
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

      <section className="grid gap-3 lg:grid-cols-2">
        <PortfolioInfoPanel updatedAtLabel={updatedAtLabel} className="h-full" />
        <section className="card h-full">
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
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                Нет данных о распределении активов.
              </p>
            )}
          </div>
        </section>
      </section>

      <RestrictedPortfolioDetails restricted={!canViewFullDetails}>
        <div className="space-y-6">
          {monthlyPlanDetail ? (
            <MonthlyPlanCard
              detail={monthlyPlanDetail}
              restricted={sensitiveInfoRestricted}
            />
          ) : null}

          {assetBlocks.length ? (
            <PortfolioAssetsTable blocks={assetBlocks} title="Рекомендуемые активы к покупке" />
          ) : (
            <div className="card">
              <div className="card-body text-sm text-muted">
                Список активов отсутствует. Попробуйте пересчитать портфель.
              </div>
            </div>
          )}
          {planSteps.length ? (
            <section className="card space-y-4">
              <div className="card-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">Пошаговый инвестиционный план</div>
                  <p className="text-sm text-muted">
                    Подсказывает, как распределять ежемесячный взнос {formatMoney(portfolio.monthly_payment_detail?.monthly_payment)} и выполнять покупки по плану.
                  </p>
                </div>
                {planGeneratedAt || planStepsCountLabel ? (
                  <div className="text-xs text-muted text-right">
                    {planGeneratedAt ? <div>Сформирован {planGeneratedAt}</div> : null}
                    {planStepsCountLabel ? (
                      <div>Шагов в плане: {planStepsCountLabel}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="card-body">
                <ol className="list-none space-y-6">
                  {planSteps.map((step, index) => {
                    const actions = Array.isArray(step.actions) ? step.actions : [];
                    const displayNumber = Number.isFinite(step.step_number)
                      ? step.step_number + 1
                      : index + 1;
                    const title = step.title?.trim() || `Шаг ${displayNumber}`;
                    const isLast = index === planSteps.length - 1;
                    const isMonthlyPurchasePlan = isMonthlyPurchasePlanStep(title);
                    const monthlyPurchaseRows =
                      isMonthlyPurchasePlan && actions.length
                        ? buildMonthlyPurchasePlanRows(actions)
                        : null;

                    return (
                      <li key={`plan-step-${step.step_number}-${index}`} className="flex gap-4">
                        <div className="flex w-12 flex-col items-center text-xs text-muted">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
                            {displayNumber}
                          </div>
                          {!isLast ? (
                            <div className="mt-2 w-px flex-1 bg-white/10" aria-hidden="true" />
                          ) : null}
                        </div>
                        <article className="flex-1 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-base font-semibold">{title}</div>
                          {step.description ? (
                            <p className="text-sm text-muted">{step.description}</p>
                          ) : null}
                          {actions.length ? (
                            <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3">
                              <p className="text-xs uppercase text-muted">Что сделать</p>
                              {monthlyPurchaseRows?.length ? (
                                <MonthlyPurchasePlanTable rows={monthlyPurchaseRows} />
                              ) : (
                                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-text">
                                  {actions.map((action, actionIndex) => (
                                    <li
                                      key={`plan-step-${step.step_number}-${actionIndex}`}
                                      className="text-muted"
                                    >
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </article>
                      </li>
                    );
                  })}
                </ol>
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
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <div className="group relative inline-flex">
                <button
                  type="button"
                  className="tab"
                  onClick={fetchAnalysis}
                  aria-describedby="update-analysis-tooltip"
                  disabled={analysisLoading || !canViewFullDetails}
                >
                  {analysisLoading ? "Обновляем..." : "Обновить объяснение"}
                </button>
                <span
                  id="update-analysis-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-[11px] leading-tight text-white shadow-lg group-hover:block group-focus-within:block"
                >
                  Действие может занять пару минут
                </span>
              </div>
            </div>
          </div>
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

function PortfolioInfoPanel({
  updatedAtLabel,
  className = "",
}: {
  updatedAtLabel: string;
  className?: string;
}) {
  const isUpdatedAtMissing =
    !updatedAtLabel || updatedAtLabel === "нет данных";

  return (
    <section
      className={`card border-primary/30 bg-primary/5 ${className}`.trim()}
    >
      <div className="card-header text-lg font-semibold">Истточники данных</div>
      <div className="card-body grid gap-3 sm:grid-cols-3">
        <InfoTile
          label="Откуда цены"
          value={
            <a
              href="https://www.moex.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:opacity-80"
            >
              MOEX
            </a>
          }
        />
        <InfoTile
          label="Откуда инфляция"
          value={
            <a
              href="https://www.cbr.ru"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:opacity-80"
            >
              ЦБ РФ
            </a>
          }
        />
        <InfoTile
          label="Дата обновления портфеля"
          value={updatedAtLabel}
          muted={isUpdatedAtMissing}
        />
      </div>
    </section>
  );
}

function InfoTile({
  label,
  value,
  muted,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p
        className={`text-sm font-semibold ${
          muted ? "text-muted" : "text-text"
        }`}
      >
        {value}
      </p>
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

function MonthlyPlanCard({
  detail,
  restricted,
}: {
  detail: MonthlyPaymentDetail;
  restricted: boolean;
}) {
  const monthlyPayment = ensureFiniteNumber(detail.monthly_payment);
  const totalMonths = Math.max(0, Math.round(ensureFiniteNumber(detail.total_months)));
  const totalYears = totalMonths ? totalMonths / 12 : 0;
  const totalContribution = monthlyPayment * totalMonths;
  const annuityFactor = ensureFiniteNumber(detail.annuity_factor);
  const totalMonthsLabel = totalMonths
    ? `${totalMonths.toLocaleString("ru-RU")} мес.${totalYears ? ` (${totalYears.toFixed(1)} лет)` : ""}`
    : "—";

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: "Срок накопления",
      value: totalMonthsLabel,
      hint: "Период, на который рассчитан ежемесячный план",
    },
    {
      label: "Накопите к концу периода",
      value: formatMoney(detail.future_capital),
      hint: "Прогнозируемый капитал при соблюдении графика",
    },
    {
      label: "Сумма взносов за период",
      value: formatMoney(totalContribution),
      hint: "Регулярные взносы без стартового капитала и доходности",
    },
    {
      label: "Месячная доходность модели",
      value: formatPercent(detail.monthly_rate, 2),
      hint: "Используется при расчёте ежемесячного платежа",
    },
    {
      label: "Ануитетный коэффициент",
      value: annuityFactor ? annuityFactor.toFixed(2) : "—",
      hint: "Во сколько раз взнос меньше цели",
    },
  ];

  return (
    <section className="card space-y-1">
      <div className="card-header flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between !pt-4 !pb-2">
        <div className="text-lg font-semibold">Месячный план взносов</div>
      </div>
      <div className="card-body !pt-4 !pb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
            >
              <p className="text-xs uppercase text-muted">{stat.label}</p>
              <p className="text-base font-semibold text-text">{stat.value}</p>
              {stat.hint ? <p className="text-xs text-muted">{stat.hint}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
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

type MonthlyPurchasePlanRow = {
  monthLabel: string;
  instructions: string[];
  totalLabel: string | null;
};

const MONTHLY_PURCHASE_PLAN_TITLE_MARKER = "план покупок по месяцам";

function isMonthlyPurchasePlanStep(title?: string | null) {
  if (!title) {
    return false;
  }
  return title.toLowerCase().includes(MONTHLY_PURCHASE_PLAN_TITLE_MARKER);
}

function buildMonthlyPurchasePlanRows(actions: string[]): MonthlyPurchasePlanRow[] {
  const rows: MonthlyPurchasePlanRow[] = [];

  actions.forEach((action, index) => {
    if (typeof action !== "string") {
      return;
    }
    const normalized = action.trim();
    if (!normalized) {
      return;
    }

    const match = normalized.match(/^Месяц\s+(\d+)\s*:\s*(.+)$/i);

    if (!match) {
      rows.push({
        monthLabel: `Месяц ${(index + 1).toLocaleString("ru-RU")}`,
        instructions: [normalized],
        totalLabel: null,
      });
      return;
    }

    const monthNumber = Number(match[1]);
    const monthLabel = Number.isFinite(monthNumber)
      ? `Месяц ${monthNumber.toLocaleString("ru-RU")}`
      : `Месяц ${match[1]}`;

    let instructionText = match[2].trim();
    let totalLabel: string | null = null;
    const equalsIndex = instructionText.lastIndexOf("=");
    if (equalsIndex !== -1) {
      totalLabel = instructionText.slice(equalsIndex + 1).trim();
      instructionText = instructionText.slice(0, equalsIndex).trim();
    }

    const instructions = instructionText
      .split(/\s*\+\s*/)
      .map((item) => item.replace(/\s{2,}/g, " ").trim())
      .filter(Boolean);

    rows.push({
      monthLabel,
      instructions: instructions.length ? instructions : [instructionText || normalized],
      totalLabel,
    });
  });

  return rows;
}

function MonthlyPurchasePlanTable({ rows }: { rows: MonthlyPurchasePlanRow[] }) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted">
            <th className="border-b border-white/10 px-3 py-2 text-left font-medium">Месяц</th>
            <th className="border-b border-white/10 px-3 py-2 text-left font-medium">Что сделать</th>
            <th className="border-b border-white/10 px-3 py-2 text-right font-medium">Бюджет</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.monthLabel}-${rowIndex}`} className="border-b border-white/5 last:border-b-0">
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-text">{row.monthLabel}</td>
              <td className="px-3 py-3">
                <ul className="list-disc space-y-1 pl-4 text-muted">
                  {row.instructions.map((instruction, instructionIndex) => (
                    <li key={`${row.monthLabel}-${instructionIndex}`}>{instruction}</li>
                  ))}
                </ul>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-text">
                {row.totalLabel ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


