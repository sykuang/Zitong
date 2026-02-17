import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { User, Bot, AlertTriangle, Copy, Check } from "lucide-react";
import type { Message } from "@/types";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await writeText(code);
    } catch {
      await navigator.clipboard.writeText(code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden">
      {/* Language label + copy button bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#282c34] text-text-muted text-xs">
        <span className="font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
            copied
              ? "text-green-400"
              : "text-text-muted hover:text-text-secondary"
          }`}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="!mt-0 !rounded-t-none !rounded-b-xl"
        customStyle={{ margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={`flex gap-3 px-4 py-4 animate-fade-in ${
        isSystem ? "opacity-60" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-primary/20 text-primary"
            : isSystem
            ? "bg-warning/20 text-warning"
            : "glass text-primary"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : isSystem ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-secondary mb-1">
          {isUser ? "You" : isSystem ? "System" : message.model || "Assistant"}
        </div>
        <div
          className={`prose prose-sm max-w-none text-text-primary ${
            isUser
              ? "rounded-2xl rounded-tl-md bg-primary/8 px-4 py-3 border border-primary/10"
              : ""
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");

                if (match) {
                  return <CodeBlock language={match[1]} code={codeString} />;
                }

                return (
                  <code className="bg-surface-tertiary px-1.5 py-0.5 rounded-md text-sm font-mono text-primary">
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
              },
              ul({ children }) {
                return <ul className="list-disc pl-5 mb-2">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-decimal pl-5 mb-2">{children}</ol>;
              },
              li({ children }) {
                return <li className="mb-1">{children}</li>;
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {children}
                  </a>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-primary/30 pl-3 italic text-text-secondary">
                    {children}
                  </blockquote>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-2">
                    <table className="border-collapse border border-glass-border w-full rounded-lg">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return (
                  <th className="border border-glass-border px-3 py-1.5 bg-surface-tertiary text-left text-sm font-medium">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="border border-glass-border px-3 py-1.5 text-sm">
                    {children}
                  </td>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-flex gap-0.5 ml-1 align-middle">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dots" style={{ animationDelay: "0s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dots" style={{ animationDelay: "0.2s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-typing-dots" style={{ animationDelay: "0.4s" }} />
            </span>
          )}
        </div>

        {/* Token count */}
        {message.tokenCount && (
          <div className="mt-1.5 text-xs text-text-muted">
            {message.tokenCount} tokens
          </div>
        )}
      </div>
    </div>
  );
}
