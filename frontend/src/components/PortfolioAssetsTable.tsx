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

const toFiniteNumber = (value?: PortfolioAssetValue) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

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

const formatPercent = (value?: PortfolioAssetValue) =>
  `${(toFiniteNumber(value) * 100).toFixed(1)}%`;

const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export default function PortfolioAssetsTable({
  blocks,
  title = "Состав портфеля",
}: Props) {
  return (
    <section className="card">
      <div className="card-header">
        <div className="text-lg font-semibold">{title}</div>
      </div>
      <div className="card-body space-y-4">
        <div className="space-y-3">
          {blocks.map((block) => {
            const rows = Array.isArray(block.rows) ? block.rows : [];
            const showWeight =
              typeof block.targetWeight === "number" &&
              Number.isFinite(block.targetWeight);
            const showAmount =
              typeof block.amount === "number" &&
              Number.isFinite(block.amount);

            return (
              <div
                key={block.assetType}
                className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted">Класс активов</div>
                    <div className="text-sm font-semibold text-text">
                      {block.assetType || "—"}
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

                {rows.length ? (
                  <div className="overflow-hidden rounded-md border border-white/10">
                    <div className="max-w-full overflow-x-auto">
                      <table className="min-w-[520px] w-full text-xs md:text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">
                              Наименование
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Тикер
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              Кол-во
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              Цена
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              Сумма
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr
                              key={`${row.ticker || row.name || index}-${index}`}
                              className={classNames(
                                "bg-transparent text-text",
                                index !== 0
                                  ? "border-t border-white/10"
                                  : undefined,
                              )}
                            >
                              <td className="px-3 py-2">
                                {row.name || "—"}
                              </td>
                              <td className="px-3 py-2 text-muted">
                                {row.ticker || "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatQuantity(row.quantity)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatMoney(row.price, 2)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatMoney(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted">
                    Нет данных по активам.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
