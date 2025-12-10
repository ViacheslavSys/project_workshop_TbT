import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import InfoTip from "./InfoTip";

type Props = {
  explanation: string;
  title?: string;
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


export default function MLReport({
  explanation,
  title = "Пояснение расчётов"
}: Props) {

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>{title}</div>
          <InfoTip title="Что это?">Аналитика подготовлена LLM на основе текущего состава портфеля.</InfoTip>
        </div>
      </div>
      <div className="card-body space-y-6">
        <MarkdownExplanation text={explanation} />
      </div>
    </div>
  );
}
