import type { MatchResult } from "../types";
import { VerdictBadge } from "./VerdictBadge";

export function CandidateCard({ result }: { result: MatchResult }) {
  return (
    <div className="border rounded-lg p-3 bg-white text-sm flex items-center justify-between gap-3">
      <div>
        <p className="font-medium text-gray-900">{result.candidate_name}</p>
        {result.strengths[0] && (
          <p className="text-gray-500 text-xs mt-0.5">✓ {result.strengths[0]}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-bold text-indigo-600">{Math.round(result.score * 100)}%</span>
        <VerdictBadge verdict={result.verdict} />
      </div>
    </div>
  );
}
