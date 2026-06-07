import { z } from 'zod';
import { ExtractedPlacesPayloadSchema } from './place';

/**
 * Edge Function `extract-youtube` request/response contracts.
 * Used both for invocation (client → function) and for tests.
 */

export const ExtractYouTubeRequestSchema = z.object({
  link_id: z.string().uuid(),
});

export type ExtractYouTubeRequest = z.infer<typeof ExtractYouTubeRequestSchema>;

export const ExtractYouTubeResponseSchema = z.object({
  link_id: z.string().uuid(),
  status: z.enum(['ready', 'failed', 'manual_review']),
  places_extracted: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
  error: z.string().nullable(),
});

export type ExtractYouTubeResponse = z.infer<typeof ExtractYouTubeResponseSchema>;

/**
 * Internal LLM output contract — kept separate from Place schema because the
 * LLM may return loose data we clean up before persisting.
 */
export const LLMExtractionOutputSchema = z.object({
  reasoning: z.string().max(2000).optional(),
  ...ExtractedPlacesPayloadSchema.shape,
  video_summary_ko: z.string().max(800).optional(),
});

export type LLMExtractionOutput = z.infer<typeof LLMExtractionOutputSchema>;
