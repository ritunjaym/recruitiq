import { useState, useEffect } from "react";
import { LeaderboardView } from "./components/LeaderboardView";
import { CandidateDetailView } from "./components/CandidateDetailView";
import type { JobDescription, MatchResult, Verdict } from "./types";
import { api } from "./api/client";

export default function App() {
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [selectedJdId, setSelectedJdId] = useState<number | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getJds().then(setJds).catch(() => setError("Failed to load job descriptions"));
  }, []);

  const handleJdSelect = async (id: number) => {
    setSelectedJdId(id);
    setSelectedResult(null);
    setLoading(true);
    setError(null);
    try {
      const data = await api.match(id);
      setResults(data);
    } catch {
      setError("Failed to run matching pipeline");
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateSelect = (candidateId: number) => {
    const result = results.find((r) => r.candidate_id === candidateId) ?? null;
    setSelectedResult(result);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-700">RecruitIQ</h1>
        {results.length > 0 && !selectedResult && (
          <div className="flex gap-2">
            {(["Strong Match", "Potential Match", "Poor Match", null] as const).map((v) => (
              <button
                key={String(v)}
                onClick={() => setVerdictFilter(v)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  verdictFilter === v
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                {v ?? "All"}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto py-8 px-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {selectedResult ? (
          <CandidateDetailView
            result={selectedResult}
            onBack={() => setSelectedResult(null)}
          />
        ) : (
          <>
            {loading && (
              <div className="text-center py-12 text-gray-500">Running matching pipeline…</div>
            )}
            {!loading && (
              <LeaderboardView
                jds={jds}
                selectedJdId={selectedJdId}
                onJdSelect={handleJdSelect}
                results={results}
                onCandidateSelect={handleCandidateSelect}
                verdictFilter={verdictFilter}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
