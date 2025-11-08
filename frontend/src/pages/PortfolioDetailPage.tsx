import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { samplePortfolios } from "../data/samplePortfolios";
import PortfolioAssetsTable, { type PortfolioAssetRow } from "../components/PortfolioAssetsTable";
import InfoTip from "../components/InfoTip";
import MLReport from "../components/MLReport";
import { fetchPortfolioAnalysis } from "../api/chat";
import { getAnonymousUserId } from "../shared/utils/anonymousUser";
import type { RootState } from "../store/store";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function colorFor(value: number, min: number, max: number, invert = false) {
  const t = clamp((value - min) / (max - min || 1), 0, 1);
  const p = invert ? 1 - t : t;
  const hue = 120 * p;
  return `hsl(${hue} 70% 55%)`;
}

function LineChart({ data }: { data: number[] }) {
  const width = 560;
  const height = 160;
  const pad = 16;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const step = (width - 2 * pad) / Math.max(1, data.length - 1);
  const norm = (value: number) => (height - pad) - (height - 2 * pad) * ((value - min) / (max - min || 1));
  const path = data.map((value, index) => `${index === 0 ? "M" : "L"} ${pad + index * step} ${norm(value)}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path d={path} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} />
    </svg>
  );
}

type DonutItem = { label: string; value: number; color?: string };

function DonutChart({ items }: { items: DonutItem[] }) {
  const size = 180;
  const stroke = 20;
  const radius = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const palette = ["#4ade80", "#60a5fa", "#f97316", "#e879f9", "#facc15", "#34d399", "#38bdf8", "#fb7185"];
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  let acc = 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto sm:mx-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {items.map((item, index) => {
            const fraction = Math.max(0, item.value) / total;
            const dash = circumference * fraction;
            const gap = circumference - dash;
            const offset = circumference * acc;
            acc += fraction;
            const color = item.color || palette[index % palette.length];
            return (
              <circle
                key={`${item.label}-${index}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,.07)"
            strokeWidth={stroke}
          />
        </g>
      </svg>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ background: item.color || palette[index % palette.length] }}
            />
            <span className="text-muted">{item.label}</span>
            <span className="tabular-nums">{(item.value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ScatterPoint = { x: number; y: number; r: number; label: string };

function RiskReturnScatter({ points }: { points: ScatterPoint[] }) {
  const width = 360;
  const height = 220;
  const pad = 30;
  const maxX = Math.max(0.15, ...points.map((point) => point.x));
  const maxY = Math.max(0.25, ...points.map((point) => point.y));
  const scaleX = (value: number) => pad + (width - 2 * pad) * (value / (maxX || 1));
  const scaleY = (value: number) => (height - pad) - (height - 2 * pad) * (value / (maxY || 1));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <rect x={pad} y={pad} width={width - 2 * pad} height={height - 2 * pad} fill="transparent" stroke="var(--border)" />
      {Array.from({ length: 4 }).map((_, index) => {
        const x = pad + (index + 1) * (width - 2 * pad) / 5;
        const y = pad + (index + 1) * (height - 2 * pad) / 5;
        return (
          <g key={index}>
            <line x1={x} x2={x} y1={pad} y2={height - pad} stroke="rgba(255,255,255,.06)" />
            <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="rgba(255,255,255,.06)" />
          </g>
        );
      })}
      {points.map((point, index) => {
        const score = clamp((point.y - 0.5 * point.x + 0.1) / 0.3, 0, 1);
        const color = colorFor(score, 0, 1);
        const radius = 4 + 12 * clamp(point.r, 0, 0.35);
        return (
          <g key={index} className="text-xs text-muted">
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r={radius} fill={color} opacity={0.9} />
            <text x={scaleX(point.x) + radius + 4} y={scaleY(point.y)} dy={4}>
              {point.label}
            </text>
          </g>
        );
      })}
      <text x={width / 2} y={height - 4} textAnchor="middle" className="text-xs" fill="var(--muted)">
        Ожидаемая доходность
      </text>
      <text
        x={-height / 2}
        y={16}
        transform={`rotate(-90)`}
        textAnchor="middle"
        className="text-xs"
        fill="var(--muted)"
      >
        Волатильность
      </text>
    </svg>
  );
}

type BarItem = { label: string; value: number };

function Bars({ items, label }: { items: BarItem[]; label: string }) {
  const max = Math.max(...items.map((item) => item.value), 0.0001);
  return (
    <div className="space-y-2">
      <div className="mb-2 text-sm text-muted">{label}</div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2 text-xs sm:text-sm">
            <div className="w-28 truncate text-xs text-muted sm:text-sm">{item.label}</div>
            <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
              <div
                className="h-2 rounded bg-primary"
                style={{ width: `${(item.value / max) * 100}%`, background: colorFor(item.value, 0, max) }}
              />
            </div>
            <div className="w-16 text-right tabular-nums">{(item.value * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioDetailPage() {
  const params = useParams<{ id: string }>();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisUserId, setAnalysisUserId] = useState<string>(() => getAnonymousUserId());

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setAnalysisUserId(String(user.id));
    } else {
      setAnalysisUserId(getAnonymousUserId());
    }
  }, [isAuthenticated, user]);

  const portfolio = useMemo(() => {
    const id = params.id ? String(params.id) : null;
    return samplePortfolios.find((item) => item.id === id) ?? samplePortfolios[0];
  }, [params.id]);

  const allocationItems = useMemo<DonutItem[]>(() => {
    return portfolio.assets.map((asset) => ({
      label: `${asset.ticker} ${asset.name}`,
      value: asset.allocation,
    }));
  }, [portfolio]);

  const scatterPoints = useMemo<ScatterPoint[]>(() => {
    return portfolio.assets.map((asset) => ({
      x: asset.risk,
      y: asset.expectedReturn,
      r: asset.allocation,
      label: asset.ticker,
    }));
  }, [portfolio]);

  const barItems = useMemo<BarItem[]>(() => {
    return portfolio.assets.map((asset) => ({
      label: asset.ticker,
      value: asset.dividendYield ?? asset.ytm ?? 0,
    }));
  }, [portfolio]);

  const tableRows = useMemo<PortfolioAssetRow[]>(() => {
    return portfolio.assets.map((asset) => ({
      ticker: asset.ticker,
      name: asset.name,
      allocation: asset.allocation,
      expectedReturn: asset.expectedReturn,
      risk: asset.risk,
      dividendYield: asset.dividendYield,
      ytm: asset.ytm,
      sector: asset.sector,
      cycleFactor: asset.cycleFactor,
      value: asset.allocation * portfolio.totalValue,
    }));
  }, [portfolio]);

  const reportFormulas = useMemo(() => ([
    {
      title: "Ожидаемая доходность портфеля",
      latex: "E[R_p] = \\sum_i w_i \\cdot E[R_i]",
      variables: [
        { name: "w_i", meaning: "Доля i‑го актива в портфеле" },
        { name: "E[R_i]", meaning: "Ожидаемая доходность i‑го актива" },
      ],
    },
    {
      title: "Риск портфеля (стандартное отклонение)",
      latex:
        "\\sigma_p = \\sqrt{\\sum_i w_i^2 \\sigma_i^2 + 2 \\sum_{i<j} w_i w_j \\sigma_i \\sigma_j \\rho_{ij}}",
      variables: [
        { name: "\\sigma_i", meaning: "Волатильность i‑го актива" },
        { name: "\\rho_{ij}", meaning: "Корреляция активов i и j" },
      ],
    },
    {
      title: "Коэффициент Шарпа",
      latex: "Sharpe = \\frac{E[R_p] - R_f}{\\sigma_p}",
      variables: [{ name: "R_f", meaning: "Безрисковая ставка" }],
    },
  ]), []);

  const shouldShowReport = analysisLoading || Boolean(analysis);
  const explanationText = analysisLoading ? "Готовим аналитический обзор портфеля..." : analysis ?? "";

  const handleFetchAnalysis = useCallback(async () => {
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const response = await fetchPortfolioAnalysis(analysisUserId);
      setAnalysis(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось получить анализ портфеля.";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  }, [analysisUserId]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Детальный анализ портфеля «{portfolio.name}»</h1>
          <p className="text-sm text-muted">Уровень риска: {portfolio.riskLevel}</p>
        </div>
        <Link
          to="/portfolios"
          className="tab w-full text-center sm:w-auto"
        >
          ← Назад к портфелям
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">
              Рыночная стоимость{" "}
              <InfoTip title="Рыночная стоимость">
                Текущая оценка стоимости портфеля по последним котировкам активов.
              </InfoTip>
            </div>
            <div className="text-2xl font-bold">
              ${portfolio.totalValue.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">
              Ожидаемая доходность{" "}
              <InfoTip title="Ожидаемая доходность">
                Прогнозируемая среднегодовая доходность с учётом структуры портфеля.
              </InfoTip>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ color: colorFor(portfolio.expectedReturn, 0, 0.2) }}
            >
              {(portfolio.expectedReturn * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">
              Волатильность{" "}
              <InfoTip title="Волатильность">
                Стандартное отклонение доходности портфеля, характеризует риск.
              </InfoTip>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ color: colorFor(portfolio.metrics.volatility, 0, 0.35, true) }}
            >
              {(portfolio.metrics.volatility * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">
              Sharpe / MaxDD{" "}
              <InfoTip title="Sharpe и максимальная просадка">
                Коэффициент Шарпа отражает эффективность риска, MaxDD показывает максимальную историческую просадку.
              </InfoTip>
            </div>
            <div className="text-2xl font-bold">
              <span style={{ color: colorFor(portfolio.metrics.sharpeRatio, 0, 1.6) }}>
                {portfolio.metrics.sharpeRatio.toFixed(2)}
              </span>{" "}
              /{" "}
              <span style={{ color: colorFor(-portfolio.metrics.maxDrawdown, -0.4, 0, true) }}>
                {(portfolio.metrics.maxDrawdown * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">Структура по активам</div>
          <div className="card-body">
            <DonutChart items={allocationItems} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Доходность vs риск</div>
          <div className="card-body">
            <RiskReturnScatter points={scatterPoints} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">Дивиденды и купоны / YTM</div>
          <div className="card-body">
            <Bars items={barItems} label="Годовая доходность по выплатам" />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Динамика стоимости (условная)</div>
          <div className="card-body">
            <LineChart data={portfolio.sparkline} />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          className={`btn w-full sm:w-auto ${analysisLoading ? "cursor-not-allowed opacity-70" : ""}`}
          onClick={handleFetchAnalysis}
          disabled={analysisLoading}
        >
          {analysisLoading ? "Формируем анализ..." : "Запросить AI-анализ"}
        </button>
        {analysisError ? (
          <div className="text-sm text-danger">{analysisError}</div>
        ) : null}
      </div>

      {shouldShowReport ? (
        <MLReport explanation={explanationText} formulas={reportFormulas} />
      ) : null}

      <PortfolioAssetsTable rows={tableRows} title="Состав портфеля" />
    </div>
  );
}
