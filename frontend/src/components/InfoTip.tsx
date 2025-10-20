import React, { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
  size?: number;
};

export default function InfoTip({ title, children, size = 16 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center"
      onClick={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
    >
      <button
        type="button"
        aria-label={`Подробнее: ${title}`}
        className="ml-1 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-muted hover:text-text transition"
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.7)) }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        ?
      </button>
      {open && (
        <div
          className="absolute z-20 mt-2 w-64 right-0 bg-panel border border-border rounded-xl shadow-card p-3 text-sm"
          onClick={(e) => { e.stopPropagation(); }}
          onMouseDown={(e) => { e.stopPropagation(); }}
        >
          <div className="font-medium mb-1">{title}</div>
          <div className="text-muted">{children}</div>
        </div>
      )}
    </div>
  );
}
