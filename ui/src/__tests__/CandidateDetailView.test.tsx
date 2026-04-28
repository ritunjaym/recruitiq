import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandidateDetailView } from "../components/CandidateDetailView";
import type { MatchResult } from "../types";

const RESULT: MatchResult = {
  candidate_id: 1,
  candidate_name: "Alex Chen",
  score: 0.92,
  verdict: "Strong Match",
  strengths: ["Python expertise", "REST API design", "5 years experience"],
  gaps: ["Missing Kubernetes", "No cloud certifications"],
  reasoning: "Alex is an excellent fit for the backend role. Their Python depth matches the JD requirements closely. The main gap is cloud infrastructure experience.",
  confidence: 0.9,
};

describe("CandidateDetailView", () => {
  // Behavior 5: renders name and score
  it("renders candidate name and score", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  // Behavior 6: shows strengths list
  it("renders all strengths", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText("Python expertise")).toBeInTheDocument();
    expect(screen.getByText("REST API design")).toBeInTheDocument();
    expect(screen.getByText("5 years experience")).toBeInTheDocument();
  });

  // Behavior 7: shows gaps list
  it("renders all gaps", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText("Missing Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("No cloud certifications")).toBeInTheDocument();
  });

  // Behavior 8: shows reasoning
  it("renders reasoning text", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText(/excellent fit for the backend role/i)).toBeInTheDocument();
  });

  it("renders verdict badge", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText("Strong Match")).toBeInTheDocument();
  });

  it("renders confidence as percentage", () => {
    render(<CandidateDetailView result={RESULT} onBack={vi.fn()} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});
