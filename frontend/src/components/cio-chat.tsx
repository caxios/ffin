"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, RotateCcw, Send, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sendChat } from "@/lib/api";
import { cn } from "@/lib/utils";

type Role = "user" | "ai" | "system";

type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

const SESSION_KEY = "ffin.cio.session_id";
const HISTORY_KEY = "ffin.cio.history";
const MAX_PERSISTED = 50;

const WELCOME: Message = {
  id: "welcome",
  role: "ai",
  content:
    "I am the **Chief Investment Officer** agent. Ask me about specific insider trades, financial metrics, business risks, earnings tone, or anything else in your dataset. I will query the database or consult the specialist analysts as needed.",
  createdAt: 0,
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function CioChat({ className }: { className?: string }) {
  const inputId = useId();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Hydrate session_id and saved history (best-effort) ──────────────
  useEffect(() => {
    try {
      const sid = localStorage.getItem(SESSION_KEY);
      if (sid) setSessionId(sid);
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      // ignore — privacy mode, quota, etc.
    }
  }, []);

  // ── Persist history (cheap; bounded) ─────────────────────────────────
  useEffect(() => {
    try {
      const tail = messages.slice(-MAX_PERSISTED);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(tail));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // ── Auto-scroll on new message OR loading-indicator change ──────────
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Cancel inflight on unmount ──────────────────────────────────────
  useEffect(() => () => abortRef.current?.abort(), []);

  const append = useCallback((m: Message) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || isLoading) return;

      append({
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      });
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await sendChat(
          { user_message: trimmed, session_id: sessionId ?? undefined },
          controller.signal,
        );
        if (data.session_id && data.session_id !== sessionId) {
          setSessionId(data.session_id);
          try {
            localStorage.setItem(SESSION_KEY, data.session_id);
          } catch {
            /* ignore */
          }
        }
        append({
          id: newId(),
          role: "ai",
          content: data.reply ?? data.response ?? "(empty response)",
          createdAt: Date.now(),
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        append({
          id: newId(),
          role: "system",
          content: `Error: ${(err as Error).message}`,
          createdAt: Date.now(),
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [append, isLoading, sessionId],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submit(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send. Shift+Enter inserts a newline. Cmd/Ctrl+Enter also sends.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
    }
  };

  const onReset = () => {
    abortRef.current?.abort();
    setMessages([WELCOME]);
    setSessionId(null);
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <section
      className={cn(
        "flex h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-label="Chief Investment Officer chat"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">CIO Agent</h2>
            <p className="font-mono text-[11px] leading-tight text-muted-foreground">
              {sessionId ? `session ${sessionId.slice(0, 8)}…` : "new session"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={isLoading && messages.length <= 1}
          aria-label="Reset conversation"
        >
          <RotateCcw />
          Reset
        </Button>
      </header>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-5 [scrollbar-gutter:stable]"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && <ThinkingBubble />}
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-border bg-background/40 p-3"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask the CIO
        </label>
        <textarea
          id={inputId}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          placeholder="Ask about insider trades, fundamentals, risks, or sentiment…"
          className={cn(
            "min-h-[36px] max-h-40 flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-snug outline-none transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            "dark:bg-input/30",
          )}
        />
        <Button
          type="submit"
          size="default"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send />
          )}
          <span className="sr-only sm:not-sr-only">Send</span>
        </Button>
      </form>
    </section>
  );
}

// ── Message bubble ──────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar role={message.role} />

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser &&
            "rounded-br-md bg-primary text-primary-foreground",
          !isUser &&
            !isSystem &&
            "rounded-bl-md border border-border bg-muted/60 text-foreground",
          isSystem &&
            "rounded-bl-md border border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownBody content={message.content} />
        )}
      </div>
    </div>
  );
}

function Avatar({ role }: { role: Role }) {
  if (role === "user") {
    return (
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <User className="size-3.5" />
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
      <Bot className="size-3.5" />
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <Bot className="size-3.5" />
      </div>
      <div
        className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-muted/60 px-4 py-3 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">CIO is thinking…</span>
        <span className="flex gap-1.5">
          <Dot />
          <Dot delay="0.15s" />
          <Dot delay="0.3s" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block size-1.5 rounded-full bg-muted-foreground/70 animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}

// ── Markdown rendering ──────────────────────────────────────────────
function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (p) => <p className="leading-relaxed" {...p} />,
          strong: (p) => (
            <strong className="font-semibold text-foreground" {...p} />
          ),
          em: (p) => <em className="text-foreground/90" {...p} />,
          a: ({ href, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
              {...rest}
            />
          ),
          ul: (p) => (
            <ul className="my-1 list-disc space-y-1 pl-5" {...p} />
          ),
          ol: (p) => (
            <ol className="my-1 list-decimal space-y-1 pl-5" {...p} />
          ),
          li: (p) => <li className="leading-relaxed" {...p} />,
          h1: (p) => <h3 className="mt-2 text-base font-semibold" {...p} />,
          h2: (p) => <h4 className="mt-2 text-sm font-semibold" {...p} />,
          h3: (p) => (
            <h5 className="mt-2 text-sm font-semibold text-foreground/90" {...p} />
          ),
          code: ({ className, children, ...rest }) => {
            const inline = !className?.includes("language-");
            if (inline) {
              return (
                <code
                  className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[12px]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={cn(
                  "block overflow-x-auto rounded-lg bg-background/70 p-3 font-mono text-[12px] leading-relaxed",
                  className,
                )}
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => <pre className="my-2" {...p} />,
          table: (p) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-background/40" {...p} />,
          th: (p) => (
            <th
              className="border-b border-border px-3 py-1.5 text-left font-semibold"
              {...p}
            />
          ),
          td: (p) => (
            <td className="border-b border-border/60 px-3 py-1.5" {...p} />
          ),
          blockquote: (p) => (
            <blockquote
              className="border-l-2 border-border pl-3 text-muted-foreground"
              {...p}
            />
          ),
          hr: () => <hr className="my-2 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
