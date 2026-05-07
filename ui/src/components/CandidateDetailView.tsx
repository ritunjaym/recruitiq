import type { MatchResult } from "../types";
import { VerdictBadge } from "./VerdictBadge";

interface Props {
  result: MatchResult;
  onBack: () => void;
  loading?: boolean;
}

export function CandidateDetailView({ result, onBack, loading = false }: Props) {
  const scorePct = Math.round(result.score * 100);
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-text-secondary hover:text-brand mb-2 transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary">{result.candidate_name}</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-4xl font-extrabold text-brand">{scorePct}%</span>
          <VerdictBadge verdict={result.verdict} />
        </div>
      </div>

      {/* Analysis */}
      <div className="bg-page border border-border-warm rounded-md p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Analysis
          {loading && <span className="ml-2 text-brand-green normal-case tracking-normal font-normal">Evaluating…</span>}
        </h3>
        <p className={`text-text-primary text-sm leading-relaxed ${loading ? "opacity-50" : ""}`}>{result.reasoning}</p>
      </div>

      {/* Strengths + Gaps */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-brand-green uppercase tracking-wider mb-2">
            Strengths
          </h3>
          <ul className="flex flex-col gap-1.5">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <span className="text-brand-green mt-0.5 shrink-0">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
            Gaps
          </h3>
          <ul className="flex flex-col gap-1.5">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
          Judge confidence
        </span>
        <div className="flex-1 bg-border rounded-full h-1.5">
          <div
            className="bg-brand h-1.5 rounded-full transition-all"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-text-primary">{confidencePct}%</span>
      </div>
    </div>
  );
}
