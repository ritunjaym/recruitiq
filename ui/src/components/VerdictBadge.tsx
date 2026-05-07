import type { Verdict } from "../types";

const STYLES: Record<Verdict, string> = {
  "Strong Match": "bg-brand-green/10 text-brand-green border border-brand-green/30",
  "Potential Match": "bg-amber-100 text-amber-800 border border-amber-200",
  "Poor Match": "bg-red-100 text-red-700 border border-red-200",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${STYLES[verdict]}`}>
      {verdict}
    </span>
  );
}
