import { z } from 'zod';

// Phase 23 — moa share chat contract (CHAT-01). This is the single seam every
// downstream consumer imports: Phase 26 chat UI (web/iOS) and @moajoa/api.
// Shapes are locked 1:1 to the 0025 trip_messages columns — any drift breaks
// the share screen at runtime.
//
// nickname is DENORMALIZED (D-A2): a point-in-time snapshot at send, never
// re-joined from profiles — renames must not rewrite chat history.
//
// Phase 25 anonymous-session call contract (RESEARCH Pitfall 4): create the anon
// session with `signInAnonymously({ options: { data: { name: nickname } } })` —
// without the metadata injection the display_name falls back to 'user'.

/** trip_messages row (0025) — columns 1:1, timestamptz as z.string() (ledger.ts idiom). */
export const TripMessageSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  user_id: z.string().uuid(),
  nickname: z.string().min(1),
  body: z.string().min(1).max(140), // 0025 CHECK: char_length between 1 and 140
  reply_to_place_id: z.string().uuid().nullable(), // 장소 hard delete 시 set null (칩만 소멸)
  created_at: z.string(),
});
export type TripMessage = z.infer<typeof TripMessageSchema>;

/**
 * Client input for sending a message. id/user_id/created_at are server-side:
 * user_id is pinned by the 0025 INSERT RLS (`auth.uid()`), never client-supplied.
 */
export const TripMessageCreateSchema = TripMessageSchema.pick({
  trip_id: true,
  nickname: true,
  body: true,
}).extend({ reply_to_place_id: z.string().uuid().nullable().optional() });
export type TripMessageCreate = z.infer<typeof TripMessageCreateSchema>;
