import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "../components/ChatPanel";

const MOCK_RESULT = {
  candidate_id: 1,
  candidate_name: "Alex Chen",
  score: 0.92,
  verdict: "Strong Match" as const,
  strengths: ["Python"],
  gaps: ["Kubernetes"],
  reasoning: "Good fit.",
  confidence: 0.9,
};

const mockChat = vi.fn().mockResolvedValue({
  reply: "Here are Python developers matching your query.",
  results: [MOCK_RESULT],
  session_id: "test-session",
});

const noHistory = vi.fn().mockResolvedValue([]);

describe("ChatPanel", () => {
  it("renders a text input and send button", () => {
    render(<ChatPanel sessionId="s1" chatFn={mockChat} historyFn={noHistory} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("shows user message after submitting", () => {
    render(<ChatPanel sessionId="s1" chatFn={mockChat} historyFn={noHistory} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "find Python developers" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.getByText("find Python developers")).toBeInTheDocument();
  });

  it("shows assistant reply after send", async () => {
    render(<ChatPanel sessionId="s1" chatFn={mockChat} historyFn={noHistory} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Python developers" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText("Here are Python developers matching your query.")).toBeInTheDocument();
    });
  });

  it("shows candidate cards inline with assistant reply", async () => {
    render(<ChatPanel sessionId="s1" chatFn={mockChat} historyFn={noHistory} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Python" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    });
  });

  it("loads conversation history on mount", async () => {
    const historyFn = vi.fn().mockResolvedValue([
      { role: "user", content: "previous question" },
      { role: "assistant", content: "previous answer" },
    ]);
    render(<ChatPanel sessionId="s2" chatFn={mockChat} historyFn={historyFn} />);
    await waitFor(() => {
      expect(screen.getByText("previous question")).toBeInTheDocument();
      expect(screen.getByText("previous answer")).toBeInTheDocument();
    });
  });

  it("clears the input after submitting", () => {
    render(<ChatPanel sessionId="s1" chatFn={mockChat} historyFn={noHistory} />);
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "find React developers" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(input.value).toBe("");
  });
});
