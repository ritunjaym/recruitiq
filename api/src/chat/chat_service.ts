import { RunnableWithMessageHistory, RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Db } from "../db/client.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";

export interface ChatResponse {
  reply: string;
  results: CandidateResult[];
  session_id: string;
}

export interface CandidateResult {
  candidate_id: number;
  candidate_name: string;
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a recruiting assistant for RecruitIQ.
Help recruiters find the right candidates using natural language.
When the user asks to find candidates, extract the key skills and requirements from their message
and use them to search. Always be helpful and conversational.
If the user refines their search (e.g., "now filter those to senior level"),
incorporate the context from the conversation.
Keep replies concise — 1-2 sentences introducing the results.`;

export class ChatService {
  private readonly histories = new Map<string, InMemoryChatMessageHistory>();
  private readonly chain: RunnableWithMessageHistory<{ input: string }, string>;

  constructor(private readonly llm: BaseChatModel) {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);

    const baseChain = RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    this.chain = new RunnableWithMessageHistory({
      runnable: baseChain,
      getMessageHistory: (sessionId) => this.getOrCreateHistory(sessionId),
      inputMessagesKey: "input",
      historyMessagesKey: "history",
    });
  }

  async send(
    sessionId: string,
    message: string,
    sidecar: SidecarClient,
    db: Db
  ): Promise<ChatResponse> {
    const reply = await this.chain.invoke(
      { input: message },
      { configurable: { sessionId } }
    );

    // Use the user message as the FAISS search query
    const queryResults = await sidecar.queryIndex(message, 5);
    const results = await this.fetchCandidateResults(queryResults, db);

    // Persist turn to DB
    db.prepare(
      "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)"
    ).run(sessionId, "user", message);
    db.prepare(
      "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)"
    ).run(sessionId, "assistant", reply);

    return { reply, results, session_id: sessionId };
  }

  private getOrCreateHistory(sessionId: string): InMemoryChatMessageHistory {
    if (!this.histories.has(sessionId)) {
      this.histories.set(sessionId, new InMemoryChatMessageHistory());
    }
    return this.histories.get(sessionId)!;
  }

  private async fetchCandidateResults(
    queryResults: Array<{ id: string; score: number }>,
    db: Db
  ): Promise<CandidateResult[]> {
    if (queryResults.length === 0) return [];

    const ids = queryResults.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM candidates WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{
        id: number; name: string; skills: string;
        years_exp: number; bio: string; past_roles: string;
      }>;

    return rows.map((row) => ({
      candidate_id: row.id,
      candidate_name: row.name,
      score: queryResults.find((r) => r.id === String(row.id))?.score ?? 0,
      verdict: "Potential Match",
      strengths: (JSON.parse(row.skills) as string[]).slice(0, 2),
      gaps: [],
      reasoning: `Semantic match from conversational search.`,
      confidence: 0.7,
    }));
  }
}
