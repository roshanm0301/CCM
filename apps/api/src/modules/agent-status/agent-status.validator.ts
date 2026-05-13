// =============================================================================
// CCM API — Agent Status Input Validator
// =============================================================================

import { z } from 'zod';

export const updateAgentStatusSchema = z.object({
  // Phase 1.5: on_call and wrap_up are system-managed CTI statuses — excluded from
  // the agent-selectable allowlist. z.enum used instead of z.nativeEnum(AgentStatus)
  // so that adding new enum values does not silently widen the accepted set.
  status: z.enum(['ready_for_calls', 'break', 'offline', 'training'], {
    errorMap: () => ({ message: 'Invalid status. on_call and wrap_up are system-managed and cannot be set manually.' }),
  }),
});

export type UpdateAgentStatusInput = z.infer<typeof updateAgentStatusSchema>;
