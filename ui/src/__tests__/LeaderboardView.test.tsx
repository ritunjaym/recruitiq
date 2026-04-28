import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaderboardView } from "../components/LeaderboardView";
import type { MatchResult, JobDescription } from "../types";

const JDS: JobDescription[] = [
  { id: 1, title: "Senior Python Engineer", company: "Acme Corp", description: "..." },
  { id: 2, title: "React Developer", company: "Beta Inc", description: "..." },
];

const RESULTS: MatchResult[] = [
  {
    candidate_id: 1, candidate_name: "Alex Chen",
    score: 0.92, verdict: "Strong Match",
    strengths: ["Python expertise", "REST APIs"],
    gaps: ["Missing Kubernetes"],
    reasoning: "Strong backend fit.", confidence: 0.9,
  },
  {
    candidate_id: 2, candidate_name: "Jordan Kim",
    score: 0.65, verdict: "Potential Match",
    strengths: ["React skills"],
    gaps: ["No Python", "Junior level"],
    reasoning: "Partial fit.", confidence: 0.7,
  },
  {
    candidate_id: 3, candidate_name: "Morgan Lee",
    score: 0.3, verdict: "Poor Match",
    strengths: ["Communication"],
    gaps: ["No technical skills"],
    reasoning: "Poor fit.", confidence: 0.95,
  },
];

describe("LeaderboardView", () => {
  // Behavior 1: renders candidate cards
  it("renders a card for each match result", () => {
    render(
      <LeaderboardView
        jds={JDS} selectedJdId={1} onJdSelect={vi.fn()}
        results={RESULTS} onCandidateSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("Jordan Kim")).toBeInTheDocument();
    expect(screen.getByText("Morgan Lee")).toBeInTheDocument();
  });

  // Behavior 2: each card shows name, score, verdict
  it("shows score and verdict on each card", () => {
    render(
      <LeaderboardView
        jds={JDS} selectedJdId={1} onJdSelect={vi.fn()}
        results={RESULTS} onCandidateSelect={vi.fn()}
      />
    );
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Strong Match")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("Potential Match")).toBeInTheDocument();
  });

  // Behavior 3: filter by verdict
  it("filters candidates by verdict", () => {
    render(
      <LeaderboardView
        jds={JDS} selectedJdId={1} onJdSelect={vi.fn()}
        results={RESULTS} onCandidateSelect={vi.fn()}
        verdictFilter="Strong Match"
      />
    );
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.queryByText("Jordan Kim")).not.toBeInTheDocument();
    expect(screen.queryByText("Morgan Lee")).not.toBeInTheDocument();
  });

  // Behavior 4: clicking a card calls onCandidateSelect
  it("calls onCandidateSelect with candidate_id when card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <LeaderboardView
        jds={JDS} selectedJdId={1} onJdSelect={vi.fn()}
        results={RESULTS} onCandidateSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("Alex Chen"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
