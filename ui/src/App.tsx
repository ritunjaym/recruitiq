import { useState, useEffect } from "react";
import { LeaderboardView } from "./components/LeaderboardView";
import { CandidateDetailView } from "./components/CandidateDetailView";
import { ChatPanel } from "./components/ChatPanel";
import type { JobDescription, MatchResult, Verdict } from "./types";
import { api } from "./api/client";

type MobileTab = "match" | "chat";

export default function App() {
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [selectedJdId, setSelectedJdId] = useState<number | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("match");
  const [sessionId] = useState(() => `session-${Date.now()}`);

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

  const FILTERS: Array<Verdict | null> = ["Strong Match", "Potential Match", "Poor Match", null];

  return (
    <div className="min-h-screen bg-page font-sans overflow-x-hidden flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border-warm px-6 py-4 flex items-center justify-between gap-3 flex-wrap shrink-0">
        <h1 className="text-xl font-bold text-brand shrink-0">RecruitIQ</h1>

        {results.length > 0 && !selectedResult && mobileTab === "match" && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((v) => (
              <button
                key={String(v)}
                onClick={() => setVerdictFilter(v)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  verdictFilter === v
                    ? "bg-brand text-white border-brand"
                    : "bg-card text-text-secondary border-border hover:border-brand hover:text-brand"
                }`}
              >
                {v ?? "All"}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b border-border bg-card shrink-0">
        {(["match", "chat"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              mobileTab === tab
                ? "text-brand border-b-2 border-brand"
                : "text-text-secondary"
            }`}
          >
            {tab === "match" ? "Match" : "Chat"}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Leaderboard */}
        <div
          className={`flex flex-col overflow-y-auto w-full md:w-1/2 md:border-r border-border ${
            mobileTab === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex-1 p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
                {error}
              </div>
            )}

            {selectedResult ? (
              <CandidateDetailView
                result={selectedResult}
                onBack={() => setSelectedResult(null)}
                loading={detailLoading}
              />
            ) : (
              <>
                {loading && (
                  <div className="text-center py-12 text-text-secondary text-sm">
                    Running matching pipeline…
                  </div>
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
          </div>
        </div>

        {/* Right — Chat */}
        <div
          className={`flex flex-col w-full md:w-1/2 min-h-0 ${
            mobileTab === "match" ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatPanel
            sessionId={sessionId}
            onCandidateSelect={async (result, query) => {
              setMobileTab("match");
              setDetailLoading(true);
              setSelectedResult(result); // show placeholder while loading
              try {
                const enriched = await api.judge(result.candidate_id, query);
                setSelectedResult(enriched);
              } catch {
                // keep the semantic result if judge fails
              } finally {
                setDetailLoading(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
