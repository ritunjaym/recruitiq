import type { MatchResult } from "../types";
import { CandidateCard } from "./CandidateCard";

interface Props {
  role: "user" | "assistant";
  content: string;
  results?: MatchResult[];
}

export function ChatMessage({ role, content, results }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        {content}
      </div>

      {results && results.length > 0 && (
        <div className="w-full flex flex-col gap-2 mt-1">
          {results.map((r) => (
            <CandidateCard key={r.candidate_id} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
