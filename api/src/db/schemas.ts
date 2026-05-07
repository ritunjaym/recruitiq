import { z } from "zod";

export const CandidateRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  skills: z.string(),
  years_exp: z.number().int().nonnegative(),
  bio: z.string(),
  past_roles: z.string(),
  embedding_id: z.string().nullable().optional(),
});

export const JdRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string(),
  source: z.string().nullable().optional(),
  embedding_id: z.string().nullable().optional(),
});

export const MatchResultRowSchema = z.object({
  id: z.number().int().positive(),
  jd_id: z.number().int().positive(),
  candidate_id: z.number().int().positive(),
  score: z.number().min(0).max(1),
  verdict: z.enum(["Strong Match", "Potential Match", "Poor Match"]),
  strengths: z.string(),
  gaps: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  created_at: z.string().optional(),
});

export const ChatMessageRowSchema = z.object({
  id: z.number().int().positive().optional(),
  session_id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string().optional(),
});

export type CandidateRow = z.infer<typeof CandidateRowSchema>;
export type JdRow = z.infer<typeof JdRowSchema>;
export type MatchResultRow = z.infer<typeof MatchResultRowSchema>;
export type ChatMessageRow = z.infer<typeof ChatMessageRowSchema>;

/** Parse and validate a single DB row; throws ZodError on schema mismatch. */
export function parseRow<T>(schema: z.ZodType<T>, raw: unknown, context: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new TypeError(`DB schema mismatch in ${context}: ${result.error.message}`);
  }
  return result.data;
}

/** Parse and validate an array of DB rows. */
export function parseRows<T>(schema: z.ZodType<T>, raws: unknown[], context: string): T[] {
  return raws.map((raw) => parseRow(schema, raw, context));
}
