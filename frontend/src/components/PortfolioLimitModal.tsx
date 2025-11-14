import type { ReactNode } from "react";

interface PortfolioLimitModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
}

export function PortfolioLimitModal({
  open,
  onClose,
  title = "Достигнут лимит портфелей",
  description = "Для большего количества портфелей купите подписку.",
}: PortfolioLimitModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-limit-title"
      aria-describedby="portfolio-limit-description"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg p-6 text-center shadow-2xl">
        <h2 id="portfolio-limit-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        <p id="portfolio-limit-description" className="mt-3 text-sm text-muted">
          {description}
        </p>
        <button type="button" className="btn mt-5 w-full" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
