// =============================================================================
// CCM API — Auth Input Validators (Zod)
// =============================================================================

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Enter User ID.'),
  password: z.string().min(1, 'Enter Password.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
