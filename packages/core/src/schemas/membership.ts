import { z } from 'zod';
import { MemberRole } from '../constants.js';

export const MembershipSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(MemberRole),
  invited_by: z.string().uuid().nullable(),
  /** Null until accepted. */
  accepted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type Membership = z.infer<typeof MembershipSchema>;

export const InviteCreateSchema = z.object({
  board_id: z.string().uuid(),
  /** Either email (sends invitation) or user_id (for already-known users). */
  email: z.string().email().optional(),
  user_id: z.string().uuid().optional(),
  role: z.enum(MemberRole).default('editor'),
});

export type InviteCreate = z.infer<typeof InviteCreateSchema>;
