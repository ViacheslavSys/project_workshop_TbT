import { useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import InfoTip from "./InfoTip";

type Variable = { name: string; meaning: string };
type Formula = {
  id?: string;
  title?: string;
  latex?: string; // as plain text (LaTeX string)
  text?: string; // plain text formula
  variables?: Variable[];
};

type Props = {
  explanation: string;
  formulas: Formula[];
  title?: string;
  defaultTab?: "explanation" | "formulas";
};

const joinClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(" ");

function MarkdownExplanation({ text }: { text: string }) {
  const content = useMemo(() => text?.trim() ?? "", [text]);
  if (!content) {
    return <p className="text-sm text-muted">Отчёт пока не готов.</p>;
  }

  return (
    <div className="space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ className, children, ...props }) => (
            <p
              {...props}
              className={joinClasses("text-sm leading-relaxed text-muted", className)}
            >
            {children}
          </p>
        ),
        ul: ({ className, children, ...props }) => (
          <ul
            {...props}
            className={joinClasses("list-disc list-inside text-sm text-muted space-y-1", className)}
          >
            {children}
          </ul>
        ),
        ol: ({ className, children, ...props }) => (
          <ol
            {...props}
            className={joinClasses("list-decimal list-inside text-sm text-muted space-y-1", className)}
          >
            {children}
          </ol>
        ),
        li: ({ className, children, ...props }) => (
          <li
            {...props}
            className={joinClasses("text-sm leading-relaxed text-muted", className)}
          >
            {children}
          </li>
        ),
        strong: ({ className, children, ...props }) => (
          <strong
            {...props}
            className={joinClasses("font-semibold text-foreground", className)}
          >
            {children}
          </strong>
        ),
        em: ({ className, children, ...props }) => (
          <em
            {...props}
            className={joinClasses("italic text-foreground", className)}
          >
            {children}
          </em>
        ),
        a: ({ className, children, ...props }) => (
          <a
            {...props}
            className={joinClasses("text-primary underline-offset-2 hover:underline", className)}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = Boolean((props as { inline?: boolean }).inline);
          if (isInline) {
            return (
              <code
                {...props}
                className={joinClasses(
                  "px-1 py-0.5 rounded bg-black/40 text-xs text-foreground",
                  className,
                )}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              {...props}
              className={joinClasses("block text-sm", className)}
            >
              {children}
            </code>
          );
        },
          pre: ({ className, children, ...props }) => (
            <pre
              {...props}
              className={joinClasses(
                "whitespace-pre-wrap text-sm p-3 rounded bg-black/30 overflow-auto",
                className,
              )}
            >
              {children}
            </pre>
          ),
        } satisfies Components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded bg-white/5 border border-border hover:bg-white/10 transition"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore copy errors */
        }
      }}
    >
      {copied ? "Скопировано" : "Скопировать"}
    </button>
  );
}

export default function MLReport({
  explanation,
  formulas,
  title = "Пояснение расчётов",
  defaultTab = "explanation",
}: Props) {
  const hasFormulas = Array.isArray(formulas) && formulas.length > 0;
  const initialTab =
    defaultTab === "formulas" && hasFormulas ? "formulas" : "explanation";
  const [tab, setTab] = useState<"explanation" | "formulas">(initialTab);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>{title}</div>
          <InfoTip title="Что это?">Аналитика подготовлена LLM на основе текущего состава портфеля.</InfoTip>
        </div>
        {hasFormulas ? (
          <div className="flex items-center gap-1">
            <button
              className={`tab ${tab === "explanation" ? "tab-active" : ""}`}
              onClick={() => setTab("explanation")}
            >
              Пояснение
            </button>
            <button
              className={`tab ${tab === "formulas" ? "tab-active" : ""}`}
              onClick={() => setTab("formulas")}
            >
              Формулы
            </button>
          </div>
        ) : null}
      </div>
      <div className="card-body">
        {tab === "formulas" && hasFormulas ? (
          <div className="space-y-4">
            {formulas.map((f, idx) => (
              <div
                key={f.id || idx}
                className="p-3 rounded-xl border border-border bg-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {f.title || `Формула ${idx + 1}`}
                  </div>
                  <CopyButton value={f.latex || f.text || ""} />
                </div>
                {f.latex ? (
                  <pre className="whitespace-pre-wrap text-sm p-2 rounded bg-black/30 overflow-auto">
                    {f.latex}
                  </pre>
                ) : f.text ? (
                  <pre className="whitespace-pre-wrap text-sm p-2 rounded bg-black/30 overflow-auto">
                    {f.text}
                  </pre>
                ) : null}
                {Array.isArray(f.variables) && f.variables.length ? (
                  <div className="mt-2 text-xs text-muted">
                    <div className="mb-1">Переменные:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {f.variables.map((v, i) => (
                        <li key={i}>
                          <span className="font-mono">{v.name}</span> — {v.meaning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <MarkdownExplanation text={explanation} />
        )}
      </div>
    </div>
  );
}
