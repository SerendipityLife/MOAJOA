import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  display_name: z.string().min(1).max(60),
  avatar_url: z.string().url().nullable(),
  locale: z.enum(['ko', 'ja', 'en']).default('ko'),
  created_at: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const UserUpdateSchema = UserSchema.pick({
  display_name: true,
  avatar_url: true,
  locale: true,
}).partial();

export type UserUpdate = z.infer<typeof UserUpdateSchema>;
