import type { Verdict } from "../types";

const COLORS: Record<Verdict, string> = {
  "Strong Match": "bg-emerald-100 text-emerald-800 border border-emerald-200",
  "Potential Match": "bg-amber-100 text-amber-800 border border-amber-200",
  "Poor Match": "bg-red-100 text-red-800 border border-red-200",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[verdict]}`}>
      {verdict}
    </span>
  );
}
