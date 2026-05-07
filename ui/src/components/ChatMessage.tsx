import type { MatchResult } from "../types";
import { CandidateCard } from "./CandidateCard";

interface Props {
  role: "user" | "assistant";
  content: string;
  results?: MatchResult[];
  query?: string;
  onCandidateSelect?: (result: MatchResult, query: string) => void;
}

export function ChatMessage({ role, content, results, query, onCandidateSelect }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-brand text-white rounded-br-sm"
            : "bg-page border border-border-warm text-text-primary rounded-bl-sm"
        }`}
      >
        {content}
      </div>

      {results && results.length > 0 && (
        <div className="w-full flex flex-col gap-2 mt-1">
          {results.map((r) => (
            <CandidateCard
              key={r.candidate_id}
              result={r}
              onSelect={onCandidateSelect && query
                ? (result) => onCandidateSelect(result, query)
                : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
