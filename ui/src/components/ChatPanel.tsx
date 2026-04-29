import { useState, useEffect, useRef } from "react";
import { api, type ChatResponse, type ChatTurn } from "../api/client";
import { ChatMessage } from "./ChatMessage";
import type { MatchResult } from "../types";

interface Message {
  role: "user" | "assistant";
  content: string;
  results?: MatchResult[];
}

interface Props {
  sessionId: string;
  // Injectable for tests — defaults to real API
  chatFn?: (sessionId: string, message: string) => Promise<ChatResponse>;
  historyFn?: (sessionId: string) => Promise<ChatTurn[]>;
}

export function ChatPanel({
  sessionId,
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
        { role: "assistant", content: response.reply, results: response.results },
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Ask me to find candidates — e.g. "Python engineers with 5+ years"
          </p>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} results={msg.results} />
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-400">
              Searching…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 flex gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          placeholder="Search candidates…"
          disabled={loading}
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="bg-indigo-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
