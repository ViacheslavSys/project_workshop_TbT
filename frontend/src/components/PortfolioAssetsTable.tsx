import React, { useMemo, useState } from "react";
import InfoTip from "./InfoTip";

export type PortfolioAssetRow = {
  ticker: string;
  name: string;
  allocation: number; // 0..1
  expectedReturn: number; // 0..1
  risk: number; // 0..1 (volatility proxy)
  value?: number; // absolute value in currency
  dividendYield?: number; // 0..1
  ytm?: number; // 0..1
  sector?: string;
  cycleFactor?: number; // -1..+1 or 0..2 depending on model
};

type SortKey =
  | "ticker"
  | "name"
  | "allocation"
  | "expectedReturn"
  | "incomeYield"
  | "risk"
  | "value"
  | "cycleFactor";

type Props = {
  rows: PortfolioAssetRow[];
  title?: string;
};

function percent(n: number | undefined, digits = 1) {
  if (n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function money(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function SortArrow({ dir }: { dir: "asc" | "desc" }) {
  return <span className="ml-1 text-xs opacity-70">{dir === "asc" ? "▲" : "▼"}</span>;
}

export default function PortfolioAssetsTable({ rows, title = "Состав портфеля" }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("allocation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const data = useMemo(() => {
    const withDerived = rows.map((r) => ({
      ...r,
      incomeYield: r.dividendYield ?? r.ytm ?? 0,
    }));
    const sorted = [...withDerived].sort((a: any, b: any) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = (Number(av) || 0) - (Number(bv) || 0);
      return sortDir === "asc" ? diff : -diff;
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const defaultDir: "asc" | "desc" = key === "ticker" || key === "name" ? "asc" : "desc";
      setSortDir(defaultDir);
    }
  };

  const Th = ({ k, children, numeric = false, info }: { k: SortKey; children: React.ReactNode; numeric?: boolean; info?: React.ReactNode }) => (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-medium ${numeric ? "text-right" : "text-left"} text-muted cursor-pointer select-none hover:text-text`}
      onClick={() => requestSort(k)}
    >
      <span className="inline-flex items-center">
        {children}
        {sortKey === k ? <SortArrow dir={sortDir} /> : null}
        {info ? <InfoTip title={String(children)}>{info}</InfoTip> : null}
      </span>
    </th>
  );

  // Color helpers
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const colorFor = (v: number, min: number, max: number, invert = false) => {
    const t = clamp((v - min) / (max - min || 1), 0, 1);
    const p = invert ? 1 - t : t;
    const hue = 120 * p; // 0 red -> 120 green
    return `hsl(${hue} 70% 55%)`;
  };

  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body p-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-muted">
              <Th k="ticker">Тикер</Th>
              <Th k="name">Актив</Th>
              <Th k="allocation" numeric info={<>
                Доля актива в портфеле. Сумма по всем активам ≈ 100%.
              </>}>
                Доля
              </Th>
              <Th k="expectedReturn" numeric info={<>
                Прогнозируемая годовая доходность (ожидание), не гарантирована.
              </>}>
                Ожид. доходность
              </Th>
              <Th k="incomeYield" numeric info={<>
                Дивидендная доходность (для акций) или доходность к погашению YTM (для облигаций).
              </>}>
                Дивиденды/YTM
              </Th>
              <Th k="risk" numeric info={<>
                Оценка риска/волатильности. Ниже — лучше (меньше колебаний).
              </>}>
                Риск (волат.)
              </Th>
              <Th k="cycleFactor" numeric info={<>
                Фактор экономического цикла для актива (модельная оценка).
              </>}>
                Цикл
              </Th>
              <Th k="value" numeric info={<>
                Оценочная сумма вложений в актив при текущей стоимости портфеля.
              </>}>
                Сумма
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.ticker} className="border-b border-border/60 hover:bg-white/5">
                <td className="px-3 py-2 font-mono">{r.ticker}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="text-text">{r.name}</div>
                    {r.sector ? <div className="text-xs text-muted">({r.sector})</div> : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span style={{ color: colorFor(r.allocation ?? 0, 0, 0.40) }}>{percent(r.allocation)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span style={{ color: colorFor(r.expectedReturn ?? 0, 0, 0.20) }}>{percent(r.expectedReturn)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span style={{ color: colorFor((r as any).incomeYield ?? (r.dividendYield ?? r.ytm) ?? 0, 0, 0.08) }}>
                    {percent(r.dividendYield ?? r.ytm)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span style={{ color: colorFor(r.risk ?? 0, 0, 0.35, true) }}>{percent(r.risk)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.cycleFactor === undefined ? "—" : r.cycleFactor.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
