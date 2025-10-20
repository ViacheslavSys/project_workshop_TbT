import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { samplePortfolios } from "../data/samplePortfolios";
import PortfolioAssetsTable, { type PortfolioAssetRow } from "../components/PortfolioAssetsTable";

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

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const portfolio = useMemo(() => samplePortfolios.find(p => p.id === id) || samplePortfolios[0], [id]);

  const totalAlloc = portfolio.assets.reduce((s,a)=>s+a.allocation,0) || 1;
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

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{portfolio.name}</h1>
          <p className="text-muted text-sm">Риск: {portfolio.riskLevel}</p>
        </div>
        <Link to="/portfolios" className="tab">← Назад</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">Общая стоимость</div>
            <div className="text-2xl font-bold">${portfolio.totalValue.toLocaleString()}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">Ожидаемая доходность</div>
            <div className="text-2xl font-bold">{(portfolio.expectedReturn*100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-xs text-muted">Шарп / Волатильность / Макс. просадка</div>
            <div className="text-2xl font-bold">{portfolio.metrics.sharpeRatio.toFixed(2)} / {(portfolio.metrics.volatility*100).toFixed(1)}% / {(portfolio.metrics.maxDrawdown*100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Производительность</div>
        <div className="card-body">
          <LineChart data={portfolio.sparkline} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">Распределение активов</div>
        <div className="card-body grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {portfolio.assets.map(a => (
              <div key={a.ticker}>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{a.ticker} • {a.name}</span>
                  <span>{(a.allocation*100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded overflow-hidden">
                  <div className="h-2 bg-primary rounded" style={{ width: `${(a.allocation/totalAlloc)*100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted">
            <p>Цифры ожидаемой доходности являются иллюстративными. Настройте веса для баланса риска и доходности.</p>
          </div>
        </div>
      </div>

      <PortfolioAssetsTable rows={tableRows} title="Активы и метрики" />
    </div>
  );
}
