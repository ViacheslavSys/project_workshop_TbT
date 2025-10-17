import { Link } from "react-router-dom";
import { samplePortfolios } from "../data/samplePortfolios";

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
      {samplePortfolios.map(p => (
        <Link key={p.id} to={`/portfolios/${p.id}`} className="card block hover:opacity-95 transition">
          <div className="card-body">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-xs text-muted mt-0.5">Риск: {p.riskLevel}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-border">Активен</span>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold">${p.totalValue.toLocaleString()}</div>
                <div className="text-sm text-success">{(p.expectedReturn*100).toFixed(1)}%</div>
              </div>
              <Sparkline data={p.sparkline} />
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Топ-актив</span>
                <span>{Math.max(...p.assets.map(a=>a.allocation))*100}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
                <div className="h-2 bg-primary rounded" style={{width:`${Math.max(...p.assets.map(a=>a.allocation))*100}%`}}/>
              </div>
              <div className="text-xs text-muted mt-1">Шарп: {p.metrics.sharpeRatio.toFixed(2)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
