import type { MatchResult, JobDescription, Verdict } from "../types";
import { VerdictBadge } from "./VerdictBadge";

interface Props {
  jds: JobDescription[];
  selectedJdId: number | null;
  onJdSelect: (id: number) => void;
  results: MatchResult[];
  onCandidateSelect: (candidateId: number) => void;
  verdictFilter?: Verdict | null;
}

export function LeaderboardView({
  jds, selectedJdId, onJdSelect,
  results, onCandidateSelect, verdictFilter,
}: Props) {
  const visible = verdictFilter
    ? results.filter((r) => r.verdict === verdictFilter)
    : results;

  return (
    <div className="flex flex-col gap-4">
      {/* JD selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Job Description:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={selectedJdId ?? ""}
          onChange={(e) => onJdSelect(Number(e.target.value))}
        >
          <option value="" disabled>Select a JD</option>
          {jds.map((jd) => (
            <option key={jd.id} value={jd.id}>{jd.title} — {jd.company}</option>
          ))}
        </select>
      </div>

      {/* Candidate cards */}
      <div className="flex flex-col gap-2">
        {visible.map((result) => (
          <button
            key={result.candidate_id}
            onClick={() => onCandidateSelect(result.candidate_id)}
            className="text-left w-full border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{result.candidate_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-indigo-600">
                  {Math.round(result.score * 100)}%
                </span>
                <VerdictBadge verdict={result.verdict} />
              </div>
            </div>
            {result.strengths[0] && (
              <p className="text-sm text-gray-500 mt-1">✓ {result.strengths[0]}</p>
            )}
          </button>
        ))}
        {visible.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No candidates match this filter.</p>
        )}
      </div>
    </div>
  );
}
