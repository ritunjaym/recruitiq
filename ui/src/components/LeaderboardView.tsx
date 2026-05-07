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
      <div className="flex flex-col gap-1 w-full">
        <label className="text-sm font-semibold text-text-primary">
          Job Description
        </label>
        <select
          className="w-full min-w-0 border border-border rounded-md px-3 py-2 text-sm bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          value={selectedJdId ?? ""}
          onChange={(e) => onJdSelect(Number(e.target.value))}
        >
          <option value="" disabled>Select a JD…</option>
          {jds.map((jd) => (
            <option key={jd.id} value={jd.id}>{jd.title} — {jd.company}</option>
          ))}
        </select>
      </div>

      {/* Candidate rows */}
      <div className="flex flex-col gap-2">
        {visible.map((result) => (
          <button
            key={result.candidate_id}
            onClick={() => onCandidateSelect(result.candidate_id)}
            className="text-left w-full bg-card border border-border rounded-md px-4 py-3 hover:border-brand hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary">{result.candidate_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-brand">
                  {Math.round(result.score * 100)}%
                </span>
                <VerdictBadge verdict={result.verdict} />
              </div>
            </div>
            {result.strengths[0] && (
              <p className="text-xs text-text-secondary mt-1">✓ {result.strengths[0]}</p>
            )}
          </button>
        ))}
        {visible.length === 0 && selectedJdId && (
          <p className="text-text-secondary text-sm text-center py-8">
            No candidates match this filter.
          </p>
        )}
        {!selectedJdId && (
          <p className="text-text-secondary text-sm text-center py-8">
            Select a job description above to run matching.
          </p>
        )}
      </div>
    </div>
  );
}
