import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  children: string;
  onLinkClick?: (wikiPath: string) => void;
}

export function MarkdownContent({ children, onLinkClick }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: linkChildren }) =>
          href?.startsWith("wiki:") && onLinkClick ? (
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => onLinkClick(href.slice(5))}
            >
              {linkChildren}
            </button>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {linkChildren}
            </a>
          ),
        h1: ({ children: c }) => (
          <h1 className="text-2xl font-semibold tracking-tight">{c}</h1>
        ),
        h2: ({ children: c }) => (
          <h2 className="text-xl font-semibold tracking-tight">{c}</h2>
        ),
        h3: ({ children: c }) => <h3 className="text-lg font-semibold">{c}</h3>,
        p: ({ children: c }) => <p className="leading-7">{c}</p>,
        ul: ({ children: c }) => <ul className="list-disc space-y-2 pl-5">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal space-y-2 pl-5">{c}</ol>,
        code: ({ children: c }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 text-[0.9em]">{c}</code>
        ),
        pre: ({ children: c }) => (
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">{c}</pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
