import type { MatchResult } from "../types";
import { VerdictBadge } from "./VerdictBadge";

interface Props {
  result: MatchResult;
  onBack: () => void;
}

export function CandidateDetailView({ result, onBack }: Props) {
  const scorePct = Math.round(result.score * 100);
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{result.candidate_name}</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-4xl font-black text-indigo-600">{scorePct}%</span>
          <VerdictBadge verdict={result.verdict} />
        </div>
      </div>

      {/* Reasoning */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Analysis
        </h3>
        <p className="text-gray-700 leading-relaxed">{result.reasoning}</p>
      </div>

      {/* Strengths + Gaps */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-2">
            Strengths
          </h3>
          <ul className="flex flex-col gap-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-emerald-500 mt-0.5">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
            Gaps
          </h3>
          <ul className="flex flex-col gap-1">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-400 mt-0.5">✗</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Judge confidence:</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">{confidencePct}%</span>
      </div>
    </div>
  );
}
