import { useState } from "react";

type PortfolioAssetValue = number | undefined | null;

export type PortfolioAssetRow = {
  ticker?: string;
  name?: string;
  allocation?: number;
  quantity?: number;
  price?: number;
  amount?: number;
};

export type PortfolioAssetBlock = {
  assetType: string;
  targetWeight?: number | null;
  amount?: number | null;
  rows: PortfolioAssetRow[];
};

type Props = {
  blocks: PortfolioAssetBlock[];
  title?: string;
};

type TableRowView = {
  key: string;
  row: PortfolioAssetRow;
  color: string;
  share: number;
};

type AssetBlockProps = {
  block: PortfolioAssetBlock;
  hoveredKey: string | null;
  onHoverChange: (value: string | null) => void;
};

const toFiniteNumber = (value?: PortfolioAssetValue) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toPositiveNumber = (value?: PortfolioAssetValue) => {
  const numericValue = toFiniteNumber(value);
  return numericValue < 0 ? 0 : numericValue;
};

const distributionColors = [
  "#60A5FA",
  "#34D399",
  "#F97316",
  "#A855F7",
  "#F87171",
  "#2DD4BF",
  "#FACC15",
  "#FB7185",
];

const getDistributionColor = (index: number) =>
  distributionColors[index % distributionColors.length];

const getRowDistributionValue = (row: PortfolioAssetRow) => {
  const amountValue = toPositiveNumber(row.amount);
  if (amountValue > 0) {
    return amountValue;
  }
  const allocationValue = toPositiveNumber(row.allocation);
  if (allocationValue > 0) {
    return allocationValue;
  }
  return 0;
};

const formatMoney = (value?: PortfolioAssetValue, fractionDigits = 0) => {
  const numericValue = toFiniteNumber(value);
  return `${numericValue.toLocaleString("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} ₽`;
};

const formatQuantity = (value?: PortfolioAssetValue) => {
  const numericValue = toFiniteNumber(value);
  return numericValue.toLocaleString("ru-RU", {
    maximumFractionDigits: numericValue < 1 ? 4 : 2,
  });
};

const formatPercent = (value?: PortfolioAssetValue, digits = 1) =>
  `${(toFiniteNumber(value) * 100).toFixed(digits)}%`;

const formatShareLabel = (value: number) =>
  `${Number.isFinite(value) ? (value * 100).toFixed(0) : "0"}%`;

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const formatAssetTypeLabel = (value?: string) => {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const PIF_HINT_TEXT = "ПИФ — паевой инвестиционный фонд";

const hasPifLabel = (value?: string | null) => Boolean(value && /пиф/i.test(value));

const renderNameWithPifHint = (value?: string | null) => {
  if (!value) return "—";
  if (!hasPifLabel(value)) return value;
  const match = value.match(/пиф/i);
  if (!match) return value;

  const before = value.slice(0, match.index);
  const highlighted = value.slice(match.index, match.index + match[0].length);
  const after = value.slice((match.index ?? 0) + match[0].length);

  return (
    <span className="inline-flex items-baseline leading-tight">
      {before ? <span>{before}</span> : null}
      <span className="relative group cursor-help">
        <span className="rounded border border-primary/30 bg-primary/10 px-1 text-[11px] font-semibold uppercase text-primary leading-none">
          {highlighted}
        </span>
        <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
          {PIF_HINT_TEXT}
        </span>
      </span>
      {after ? <span>{after}</span> : null}
    </span>
  );
};

const renderAssetTypeLabel = (value?: string) =>
  renderNameWithPifHint(formatAssetTypeLabel(value));

export default function PortfolioAssetsTable({
  blocks,
  title = "Состав портфеля",
}: Props) {
  const [hoveredByBlock, setHoveredByBlock] = useState<
    Record<string, string | null>
  >({});

  const handleHoverChange = (blockKey: string, value: string | null) => {
    setHoveredByBlock((prev) => {
      if (prev[blockKey] === value) {
        return prev;
      }
      return { ...prev, [blockKey]: value };
    });
  };

  return (
    <section className="card">
      <div className="card-header">
        <div className="text-lg font-semibold">{title}</div>
      </div>
      <div className="card-body space-y-4">
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const blockKey = `${block.assetType || "block"}-${index}`;
            return (
              <AssetBlock
                key={blockKey}
                block={block}
                hoveredKey={hoveredByBlock[blockKey] ?? null}
                onHoverChange={(value) => handleHoverChange(blockKey, value)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AssetBlock({ block, hoveredKey, onHoverChange }: AssetBlockProps) {
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const showWeight =
    typeof block.targetWeight === "number" &&
    Number.isFinite(block.targetWeight);
  const showAmount =
    typeof block.amount === "number" && Number.isFinite(block.amount);

  const tableRows: TableRowView[] = (() => {
    const distributionValues = rows.map((row) => getRowDistributionValue(row));
    const distributionTotal = distributionValues.reduce(
      (sum, value) => sum + value,
      0,
    );
    const fallbackShare =
      distributionTotal === 0 && rows.length ? 1 / rows.length : 0;

    return rows.map((row, index) => {
      const share =
        distributionTotal > 0
          ? distributionValues[index] / distributionTotal
          : fallbackShare;
      return {
        key: `${row.ticker || row.name || index}-${index}`,
        row,
        color: getDistributionColor(index),
        share: Number.isFinite(share) ? Math.max(share, 0) : 0,
      };
    });
  })();

  const showDistribution = tableRows.length > 1;

  if (!rows.length) {
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">
              {renderAssetTypeLabel(block.assetType)}
            </div>
          </div>
          <div className="text-xs text-muted text-right">
            {showWeight ? (
              <div>Доля: {formatPercent(block.targetWeight)}</div>
            ) : null}
            {showAmount ? (
              <div>Стоимость: {formatMoney(block.amount)}</div>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-muted">Пока нет подробной разбивки.</div>
      </div>
    );
  }

  const handleBlockLeave = () => onHoverChange(null);
  const makeHoverHandler = (value: string | null) => () => onHoverChange(value);

  return (
    <div
      className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3"
      onMouseLeave={handleBlockLeave}
    >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-text">
              {renderAssetTypeLabel(block.assetType)}
            </div>
          </div>
        <div className="text-xs text-muted text-right">
          {showWeight ? (
            <div>Доля: {formatPercent(block.targetWeight)}</div>
          ) : null}
          {showAmount ? (
            <div>Стоимость: {formatMoney(block.amount)}</div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex-1 overflow-hidden rounded-md border border-white/10">
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[520px] w-full text-xs md:text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Наименование</th>
                  <th className="px-3 py-2 text-left font-semibold">Тикер</th>
                  <th className="px-3 py-2 text-right font-semibold">Кол-во</th>
                  <th className="px-3 py-2 text-right font-semibold">Цена</th>
                  <th className="px-3 py-2 text-right font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((item, index) => {
                  const isActive = hoveredKey === item.key;
                  const isDimmed = Boolean(hoveredKey && !isActive);
                  return (
                    <tr
                      key={item.key}
                      className={classNames(
                        "bg-transparent text-text transition",
                        index !== 0 ? "border-t border-white/10" : undefined,
                        isActive ? "bg-white/10" : undefined,
                        isDimmed ? "opacity-60" : undefined,
                      )}
                      onMouseEnter={makeHoverHandler(item.key)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          />
                          <span>{item.row.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {item.row.ticker || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatQuantity(item.row.quantity)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(item.row.price, 2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(item.row.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showDistribution ? (
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
            <div className="flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-white/10 bg-white/5">
              {tableRows.map((item) => {
                const isActive = hoveredKey === item.key;
                const isDimmed = Boolean(hoveredKey && !isActive);
                return (
                  <div
                    key={`${item.key}-segment`}
                    className="h-full transition-all"
                    style={{
                      flexGrow: item.share > 0 ? item.share : 0,
                      minWidth: item.share > 0 ? 12 : 0,
                      backgroundColor: item.color,
                      opacity: isDimmed ? 0.35 : 1,
                      boxShadow: isActive
                        ? "0 0 0 2px rgba(255,255,255,0.45)"
                        : undefined,
                    }}
                    title={`${item.row.name || item.row.ticker || "-"}: ${formatShareLabel(item.share)}`}
                    onMouseEnter={makeHoverHandler(item.key)}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] leading-relaxed">
              {tableRows.map((item) => {
                const isActive = hoveredKey === item.key;
                const isDimmed = Boolean(hoveredKey && !isActive);
                return (
                  <div
                    key={`${item.key}-legend`}
                    className={classNames(
                      "flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-text transition",
                      isActive ? "border-white/20 bg-white/10" : undefined,
                      isDimmed ? "opacity-60" : undefined,
                    )}
                    onMouseEnter={makeHoverHandler(item.key)}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.row.name || item.row.ticker || "-"}</span>
                    <span className="text-muted">
                      {formatShareLabel(item.share)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
