import type { MatchResult } from "../types";
import { VerdictBadge } from "./VerdictBadge";

interface Props {
  result: MatchResult;
  onSelect?: (result: MatchResult) => void;
}

export function CandidateCard({ result, onSelect }: Props) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(result)}
      onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) onSelect(result); }}
      className={`bg-card border border-border rounded-md px-3 py-2.5 text-sm flex items-center justify-between gap-3 ${
        onSelect ? "cursor-pointer hover:border-brand hover:shadow-sm transition-all" : ""
      }`}
    >
      <div>
        <p className="font-semibold text-text-primary">{result.candidate_name}</p>
        {result.strengths[0] && (
          <p className="text-text-secondary text-xs mt-0.5">✓ {result.strengths[0]}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-bold text-brand">{Math.round(result.score * 100)}%</span>
        <VerdictBadge verdict={result.verdict} />
      </div>
    </div>
  );
}
