// =============================================================================
// CCM API — Role Constants
//
// Centralised list of role names used across authentication guards and
// authorization checks. Sourced from migration 020 which seeds the dealer
// roles into the roles table.
//
// Source: phase1-technical-blueprint.md §5.1; CCM_Phase6_Resolution_Activities.md
// =============================================================================

/**
 * All 8 dealer workspace roles seeded by migration 020.
 * Use this array wherever a guard needs to allow any dealer user through.
 */
export const DEALER_ROLES = [
  'dealer_service_advisor',
  'dealer_workshop_controller',
  'dealer_parts_executive',
  'dealer_crm_executive',
  'dealer_warranty_executive',
  'dealer_service_manager',
  'dealer_bodyshop_advisor',
  'dealer_ev_technician',
] as const;

/**
 * Every role that may hold an authenticated CCM session — agent-side roles
 * plus all dealer roles. Useful for middleware that permits any valid login.
 */
export const ALL_AUTHENTICATED_ROLES: string[] = ['agent', 'ccm_agent', ...DEALER_ROLES];
