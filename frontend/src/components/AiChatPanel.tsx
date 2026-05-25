import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { api, streamAiChat } from "../services/api";
import { useChat } from "../contexts/ChatContext";
import { cn } from "../lib/utils";
import { useLocation } from "react-router-dom";

const SUGGESTED = [
  "What are my top 3 critical compliance risks?",
  "Which dataset has the worst data quality?",
  "Show me all FDA-related gaps",
  "What would happen if we ran an FDA audit today?",
  "How do I fix the HIPAA consent issue?",
];

type Message = { role: "user" | "assistant"; content: string };

export default function AiChatPanel({
  darkMode,
  open: controlledOpen,
  setOpen: setControlledOpen,
}: {
  darkMode: boolean;
  open?: boolean;
  setOpen?: (v: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const { uploadSessionId } = useChat();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const assistantIndex = messages.length + 1;
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      let streamed = "";
      try {
        await streamAiChat(
          { message: text.trim(), history, uploadSessionId, activeRoute: location.pathname },
          (delta) => {
            streamed += delta;
            setMessages((m) => {
              const next = [...m];
              if (next[assistantIndex]) next[assistantIndex] = { role: "assistant", content: streamed };
              return next;
            });
          }
        );
      } catch {
        const res = await api.postAiChat(text.trim(), history, uploadSessionId, location.pathname);
        setMessages((m) => {
          const next = [...m];
          if (next[assistantIndex]) next[assistantIndex] = { role: "assistant", content: res.reply };
          return next;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sorry, the AI service is unavailable. Check that the backend is running and Azure/OpenAI is configured.";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: msg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary dark:bg-primary-light text-white shadow-lg flex items-center justify-center z-40 hover:opacity-90"
        aria-label="Open AI chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {open && (
        <div
          className={cn(
            "fixed top-0 right-0 bottom-0 w-full max-w-md shadow-2xl z-50 flex flex-col border-l",
            darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold">AI Insights Assistant</h2>
            <button type="button" onClick={() => setOpen(false)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {uploadSessionId
                    ? "Answering about your uploaded data only. Ask why severity is Critical, what to fix, etc."
                    : "Ask about data quality, compliance gaps, or remediation. Context is the baseline application data."}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-500">Suggested questions:</p>
                {SUGGESTED.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(q)}
                    className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 text-sm",
                  m.role === "user"
                    ? "ml-8 bg-primary text-white dark:bg-primary-light"
                    : "mr-8 bg-slate-100 dark:bg-slate-700"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="rounded-lg p-3 text-sm bg-slate-100 dark:bg-slate-700 animate-pulse">Thinking...</div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about data quality or compliance..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary dark:bg-primary-light text-white p-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
