import { Link } from "react-router-dom";
import { samplePortfolios } from "../data/samplePortfolios";
import InfoTip from "../components/InfoTip";

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function colorFor(v: number, min: number, max: number, invert = false) {
  const t = clamp((v - min) / (max - min || 1), 0, 1);
  const p = invert ? 1 - t : t;
  const hue = 120 * p; // 0 red -> 120 green
  return `hsl(${hue} 70% 55%)`;
}

function Sparkline({ data }: { data: number[] }) {
  const w = 120, h = 36, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const norm = (v: number) => (h - pad) - (h - 2 * pad) * ((v - min) / (max - min || 1));
  const step = (w - 2 * pad) / Math.max(1, data.length - 1);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * step} ${norm(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <path d={d} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
    </svg>
  );
}

export default function PortfolioPage(){
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {samplePortfolios.map(p => {
        const maxAlloc = Math.max(...p.assets.map(a=>a.allocation));
        const topAssets = [...p.assets].sort((a,b)=>b.allocation-a.allocation).slice(0,3);
        const riskColor = p.riskLevel === 'Low' ? 'hsl(120 60% 45%)' : p.riskLevel === 'Moderate' ? 'hsl(60 70% 55%)' : 'hsl(10 80% 55%)';
        return (
          <Link
            key={p.id}
            to={`/portfolios/${p.id}`}
            className="card block transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95"
          >
            <div className="card-body">
              <div className="h-1 w-full rounded bg-gradient-to-r from-success/60 via-primary/60 to-danger/60 opacity-60 mb-3" />
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                    Риск-профиль: <span className="px-1.5 py-0.5 rounded border border-border" style={{ background: 'rgba(255,255,255,.06)', color: riskColor }}>{p.riskLevel}</span>
                    <InfoTip title="Риск-профиль">Общая склонность инвестора к риску (низкий, умеренный, высокий) на основе опроса и/или данных.</InfoTip>
                  </p>
                </div>
                <span className="self-start rounded-lg border border-border bg-white/5 px-2 py-1 text-xs">Обзор</span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-2xl font-bold">${p.totalValue.toLocaleString()}</div>
                  <div className="text-sm tabular-nums" style={{ color: colorFor(p.expectedReturn, 0, 0.2) }}>
                    {(p.expectedReturn*100).toFixed(1)}% <span className="text-muted">ожид. доход.</span>
                    <InfoTip title="Ожидаемая доходность">Среднегодовая оценка доходности портфеля на выбранном горизонте, не является гарантией.</InfoTip>
                  </div>
                </div>
                <div className="sm:-mr-1">
                  <Sparkline data={p.sparkline} />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>Крупнейшая доля<InfoTip title="Крупнейшая доля">Максимальная доля одного актива в портфеле.</InfoTip></span>
                  <span className="tabular-nums">{(maxAlloc*100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
                  <div className="h-2 bg-primary rounded" style={{width:`${maxAlloc*100}%`}}/>
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-1">
                  Sharpe: <span className="tabular-nums" style={{ color: colorFor(p.metrics.sharpeRatio, 0, 1.6) }}>{p.metrics.sharpeRatio.toFixed(2)}</span>
                  <InfoTip title="Sharpe Ratio">Показывает соотношение доходности к риску. Чем выше показатель, тем эффективнее стратегия.</InfoTip>
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  {topAssets.map(a => (
                    <span key={a.ticker} className="text-xs px-2 py-0.5 rounded bg-white/5 border border-border">
                      {a.ticker} <span className="tabular-nums">{(a.allocation*100).toFixed(0)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

