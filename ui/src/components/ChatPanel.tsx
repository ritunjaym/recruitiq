import { useState, useEffect, useRef } from "react";
import { api, type ChatResponse, type ChatTurn } from "../api/client";
import { ChatMessage } from "./ChatMessage";
import type { MatchResult } from "../types";

interface Message {
  role: "user" | "assistant";
  content: string;
  results?: MatchResult[];
  query?: string; // the user query that produced these results
}

interface Props {
  sessionId: string;
  onCandidateSelect?: (result: MatchResult, query: string) => void;
  chatFn?: (sessionId: string, message: string) => Promise<ChatResponse>;
  historyFn?: (sessionId: string) => Promise<ChatTurn[]>;
}

export function ChatPanel({
  sessionId,
  onCandidateSelect,
  chatFn = api.chat,
  historyFn = api.getChatHistory,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyFn(sessionId)
      .then((turns) => setMessages(turns.map((t) => ({ role: t.role, content: t.content }))))
      .catch(() => {});
  }, [sessionId, historyFn]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const response = await chatFn(sessionId, text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply, results: response.results, query: text },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">Candidate Search</h2>
        <p className="text-xs text-text-secondary mt-0.5">Ask in plain English — I'll find the best matches</p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-text-secondary text-sm mt-8">
            Ask me to find candidates — e.g. "find candidates who know React with 3+ years"
          </p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            results={msg.results}
            query={msg.query}
            onCandidateSelect={onCandidateSelect}
          />
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="bg-page border border-border-warm rounded-lg rounded-bl-sm px-4 py-2.5 text-sm text-text-secondary">
              Searching…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-3 py-3 flex gap-2 bg-card">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="find candidates who know React with 3+ years…"
          disabled={loading}
          className="flex-1 border border-border rounded-lg px-4 py-2 text-sm bg-page text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50"
        />
        <button
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
