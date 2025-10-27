import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";

type Variable = { name: string; meaning: string };
type Formula = {
  id?: string;
  title?: string;
  latex?: string; // as plain text (LaTeX string)
  text?: string;  // plain text formula
  variables?: Variable[];
};

type Props = {
  explanation: string; // plain text or markdown-ish; renders as paragraphs
  formulas: Formula[];
  title?: string;
  defaultTab?: "explanation" | "formulas";
};

function Paragraphs({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n\n+/g), [text]);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((blk, i) => {
        // rudimentary list rendering: lines starting with "- "
        const lines = blk.split(/\n/g);
        const isList = lines.every(l => l.trim().startsWith("- "));
        if (isList) {
          return (
            <ul key={i} className="list-disc list-inside text-sm text-muted">
              {lines.map((l, j) => <li key={j}>{l.replace(/^\s*-\s*/, "")}</li>)}
            </ul>
          );
        }
        return <p key={i} className="text-sm text-muted">{blk}</p>;
      })}
    </div>
  );
}

function CopyButton({ value }: { value: string }){
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded bg-white/5 border border-border hover:bg-white/10 transition"
      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} }}
    >
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

export default function MLReport({ explanation, formulas, title = "Отчёт о расчётах", defaultTab = "explanation" }: Props){
  const [tab, setTab] = useState<"explanation"|"formulas">(defaultTab);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>{title}</div>
          <InfoTip title="Прозрачность расчётов">Здесь показано пояснение ML‑инженера и формулы, использованные для расчёта метрик портфеля.</InfoTip>
        </div>
        <div className="flex items-center gap-1">
          <button className={`tab ${tab === "explanation" ? "tab-active" : ""}`} onClick={()=>setTab("explanation")}>Пояснение</button>
          <button className={`tab ${tab === "formulas" ? "tab-active" : ""}`} onClick={()=>setTab("formulas")}>Формулы</button>
        </div>
      </div>
      <div className="card-body">
        {tab === "explanation" ? (
          <Paragraphs text={explanation} />
        ) : (
          <div className="space-y-4">
            {formulas.map((f, idx) => (
              <div key={f.id || idx} className="p-3 rounded-xl border border-border bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{f.title || `Формула ${idx+1}`}</div>
                  <CopyButton value={f.latex || f.text || ""} />
                </div>
                {f.latex ? (
                  <pre className="whitespace-pre-wrap text-sm p-2 rounded bg-black/30 overflow-auto">{f.latex}</pre>
                ) : f.text ? (
                  <pre className="whitespace-pre-wrap text-sm p-2 rounded bg-black/30 overflow-auto">{f.text}</pre>
                ) : null}
                {Array.isArray(f.variables) && f.variables.length ? (
                  <div className="mt-2 text-xs text-muted">
                    <div className="mb-1">Переменные:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {f.variables.map((v,i)=>(<li key={i}><span className="font-mono">{v.name}</span> — {v.meaning}</li>))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
