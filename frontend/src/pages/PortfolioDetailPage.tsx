import { useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { samplePortfolios } from "../data/samplePortfolios";
import PortfolioAssetsTable, { type PortfolioAssetRow } from "../components/PortfolioAssetsTable";
import InfoTip from "../components/InfoTip";
import MLReport from "../components/MLReport";
import { fetchPortfolioAnalysis, getAnonymousUserId } from "../api/chat";
import type { RootState } from "../store/store";

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function colorFor(v: number, min: number, max: number, invert = false) {
  const t = clamp((v - min) / (max - min || 1), 0, 1);
  const p = invert ? 1 - t : t;
  const hue = 120 * p; // 0 red -> 120 green
  return `hsl(${hue} 70% 55%)`;
}

function LineChart({ data }: { data: number[] }) {
  const w = 560, h = 160, pad = 16;
  const min = Math.min(...data), max = Math.max(...data);
  const norm = (v: number) => (h - pad) - (h - 2 * pad) * ((v - min) / (max - min || 1));
  const step = (w - 2 * pad) / Math.max(1, data.length - 1);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * step} ${norm(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={d} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
    </svg>
  );
}

function DonutChart({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const size = 180; const stroke = 20; const r = (size / 2) - stroke / 2; const C = 2 * Math.PI * r;
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0) || 1;
  let acc = 0;
  const palette = ["#4ade80", "#60a5fa", "#f97316", "#e879f9", "#facc15", "#34d399", "#38bdf8", "#fb7185"];
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          {items.map((it, idx) => {
            const frac = Math.max(0, it.value) / total;
            const dash = C * frac;
            const gap = C - dash;
            const dashoffset = C * acc;
            acc += frac;
            const col = it.color || palette[idx % palette.length];
            return (
              <circle key={idx} cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`} strokeDashoffset={dashoffset} strokeLinecap="butt" />
            );
          })}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        </g>
      </svg>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded" style={{ background: it.color || palette[idx % palette.length] }} />
            <span className="text-muted">{it.label}</span>
            <span className="tabular-nums">{(it.value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskReturnScatter({ points }: { points: { x: number; y: number; r: number; label: string }[] }) {
  const w = 360, h = 220, pad = 30;
  const maxX = Math.max(0.15, ...points.map(p => p.x));
  const maxY = Math.max(0.25, ...points.map(p => p.y));
  const sx = (v: number) => pad + (w - 2*pad) * (v / (maxX || 1));
  const sy = (v: number) => (h - pad) - (h - 2*pad) * (v / (maxY || 1));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <rect x={pad} y={pad} width={w-2*pad} height={h-2*pad} fill="transparent" stroke="var(--border)" />
      {Array.from({length:4}).map((_,i)=>{
        const x = pad + (i+1)*(w-2*pad)/5; const y = pad + (i+1)*(h-2*pad)/5;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={pad} y2={h-pad} stroke="rgba(255,255,255,.06)" />
            <line x1={pad} x2={w-pad} y1={y} y2={y} stroke="rgba(255,255,255,.06)" />
          </g>
        );
      })}
      {points.map((p, i) => {
        const score = clamp((p.y - 0.5*p.x + 0.1) / 0.3, 0, 1);
        const col = colorFor(score, 0, 1);
        const radius = 4 + 12 * clamp(p.r, 0, 0.35);
        return (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={radius} fill={col} opacity={0.9} />
            <text x={sx(p.x)+radius+4} y={sy(p.y)} dy={4} className="text-xs" fill="var(--muted)">{p.label}</text>
          </g>
        );
      })}
      <text x={w/2} y={h - 4} textAnchor="middle" className="text-xs" fill="var(--muted)">Риск (волатильность)</text>
      <text x={-h/2} y={12} transform={`rotate(-90)`} textAnchor="middle" className="text-xs" fill="var(--muted)">Ожид. доходность</text>
    </svg>
  );
}

function Bars({ items, label }: { items: { label: string; value: number }[]; label: string }){
  const max = Math.max(...items.map(i=>i.value), 0.0001);
  return (
    <div>
      <div className="text-sm text-muted mb-2">{label}</div>
      <div className="space-y-2">
        {items.map((it,i)=> (
          <div key={i} className="flex items-center gap-2">
            <div className="w-28 text-xs text-muted truncate">{it.label}</div>
            <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
              <div className="h-2 rounded" style={{ width: `${(it.value/max)*100}%`, background: colorFor(it.value, 0, max) }} />
            </div>
            <div className="w-16 text-right text-xs tabular-nums">{(it.value*100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const portfolio = useMemo(() => samplePortfolios.find(p => p.id === id) || samplePortfolios[0], [id]);
  const authUserId = useSelector((state: RootState) => state.auth.user?.id);
  const userId = authUserId ?? getAnonymousUserId();

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleFetchAnalysis = useCallback(async () => {
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const result = await fetchPortfolioAnalysis(userId);
      setAnalysis(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось получить объяснение расчётов";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  }, [userId]);

  const tableRows: PortfolioAssetRow[] = useMemo(() => (
    portfolio.assets.map(a => ({
      ticker: a.ticker,
      name: a.name,
      allocation: a.allocation,
      expectedReturn: a.expectedReturn,
      risk: a.risk,
      value: portfolio.totalValue * a.allocation,
      dividendYield: a.dividendYield,
      ytm: a.ytm,
      sector: a.sector,
      cycleFactor: a.cycleFactor,
    }))
  ), [portfolio]);
  const reportFormulas = useMemo(() => ([
    {
      title: "Ожидаемая доходность портфеля",
      latex: "E[R_p] = \\sum_i w_i \\cdot E[R_i]",
      variables: [
        { name: "w_i", meaning: "доля i-го актива" },
        { name: "E[R_i]", meaning: "ожидаемая доходность i-го актива" }
      ]
    },
    {
      title: "Риск (волатильность) портфеля (упрощённо)",
      latex: "\\sigma_p = \\sqrt{\\sum_i w_i^2 \\sigma_i^2 + 2 \\sum_{i<j} w_i w_j \\sigma_i \\sigma_j \\rho_{ij}}",
      variables: [
        { name: "\\sigma_i", meaning: "волатильность i-го актива" },
        { name: "\\rho_{ij}", meaning: "корреляция активов i и j" }
      ]
    },
    {
      title: "Коэффициент Шарпа",
      latex: "Sharpe = \\frac{E[R_p] - R_f}{\\sigma_p}",
      variables: [
        { name: "R_f", meaning: "безрисковая ставка" }
      ]
    }
  ]), []);

  const shouldShowReport = analysisLoading || analysis !== null;
  const explanationText = analysisLoading ? "Идёт загрузка отчёта о расчётах..." : (analysis ?? "");

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Аналитика портфеля — {portfolio.name}</h1>
          <p className="text-muted text-sm">Профиль риска: {portfolio.riskLevel}</p>
        </div>
        <Link to="/portfolios" className="tab">← К списку портфелей</Link>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="card"><div className="card-body">
          <div className="text-xs text-muted">Текущая стоимость <InfoTip title="Стоимость портфеля">Оценка текущей суммарной стоимости всех активов портфеля.</InfoTip></div>
          <div className="text-2xl font-bold">${portfolio.totalValue.toLocaleString()}</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div className="text-xs text-muted">Ожидаемая доходность <InfoTip title="Ожидаемая доходность">Прогноз годовой доходности на горизонте инвестирования. Не является гарантией.</InfoTip></div>
          <div className="text-2xl font-bold" style={{ color: colorFor(portfolio.expectedReturn, 0, 0.2) }}>{(portfolio.expectedReturn*100).toFixed(1)}%</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div className="text-xs text-muted">Волатильность <InfoTip title="Волатильность">Оценка колеблемости стоимости портфеля. Ниже — более стабильно.</InfoTip></div>
          <div className="text-2xl font-bold" style={{ color: colorFor(portfolio.metrics.volatility, 0, 0.35, true) }}>{(portfolio.metrics.volatility*100).toFixed(1)}%</div>
        </div></div>
        <div className="card"><div className="card-body">
          <div className="text-xs text-muted">Sharpe / MaxDD <InfoTip title="Sharpe и Max Drawdown">Sharpe — доходность за вычетом безрисковой, делённая на риск. MaxDD — максимальная просадка.</InfoTip></div>
          <div className="text-2xl font-bold"><span style={{ color: colorFor(portfolio.metrics.sharpeRatio, 0, 1.6) }}>{portfolio.metrics.sharpeRatio.toFixed(2)}</span> / <span style={{ color: colorFor(-portfolio.metrics.maxDrawdown, -0.4, 0.0, true) }}>{(portfolio.metrics.maxDrawdown*100).toFixed(1)}%</span></div>
        </div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Аллокация по активам <InfoTip title="Аллокация">Распределение долей портфеля между активами/классами активов.</InfoTip></div>
          <div className="card-body">
            <DonutChart items={portfolio.assets.map(a => ({ label: `${a.ticker} ${a.name}`, value: a.allocation }))} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Доходность vs Риск <InfoTip title="Доходность vs Риск">Сравнение ожидаемой доходности и риска по активам. Размер точки — доля.</InfoTip></div>
          <div className="card-body">
            <RiskReturnScatter points={portfolio.assets.map(a => ({ x: a.risk, y: a.expectedReturn, r: a.allocation, label: a.ticker }))} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Дивиденды / YTM <InfoTip title="Дивиденды и YTM">Для акций — дивидендная доходность. Для облигаций — доходность к погашению.</InfoTip></div>
          <div className="card-body">
            <Bars items={portfolio.assets.map(a => ({ label: a.ticker, value: (a.dividendYield ?? a.ytm ?? 0) }))} label="Доходность выплат" />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Динамика стоимости (демо)</div>
          <div className="card-body">
            <LineChart data={portfolio.sparkline} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <button
          type="button"
          className={`btn ${analysisLoading ? "opacity-70 cursor-not-allowed" : ""}`}
          onClick={handleFetchAnalysis}
          disabled={analysisLoading}
        >
          {analysisLoading ? "Считаем..." : "Как посчитано"}
        </button>
        {analysisError ? (
          <div className="text-sm text-danger">
            Не удалось загрузить объяснение расчётов: {analysisError}
          </div>
        ) : null}
      </div>

      {shouldShowReport ? (
        <MLReport explanation={explanationText} formulas={reportFormulas} />
      ) : null}

      <PortfolioAssetsTable rows={tableRows} title="Активы и метрики" />
    </div>
  );
}
