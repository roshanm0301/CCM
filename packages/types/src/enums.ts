// =============================================================================
// CCM Phase 1 — Shared Enums
//
// Source: CCM_Phase1_Agent_Interaction_Documentation.md, ccm-scope.md
// These are the canonical controlled values for the CCM Phase 1 domain.
// Do not add future-phase values here without a phase document change.
// =============================================================================

/**
 * Tracks the lifecycle state of a CCM interaction.
 * Maps to the `interactions.status` column.
 * State machine: NEW → IDENTIFYING → CONTEXT_CONFIRMED → WRAPUP → CLOSED
 *                                                                ↘ INCOMPLETE
 * Source: phase1-technical-blueprint.md § 6 Interaction State Machine
 */
export enum InteractionStatus {
  /** Interaction record created; immediately transitions to IDENTIFYING. */
  NEW = 'NEW',
  /** Agent is identifying the customer/vehicle — initial active state. */
  IDENTIFYING = 'IDENTIFYING',
  /** Customer/vehicle context has been confirmed by the agent. */
  CONTEXT_CONFIRMED = 'CONTEXT_CONFIRMED',
  /** Agent has captured wrap-up data; ready to close or mark incomplete. */
  WRAPUP = 'WRAPUP',
  /** Interaction has been wrapped up and closed by the agent. */
  CLOSED = 'CLOSED',
  /** Interaction was left in an unresolved state. */
  INCOMPLETE = 'INCOMPLETE',
}

/**
 * Tracks the current availability state of an agent.
 * Maps to reference_values with reference_type = 'agent_status'.
 */
export enum AgentStatus {
  READY_FOR_CALLS = 'ready_for_calls',
  BREAK = 'break',
  OFFLINE = 'offline',
  TRAINING = 'training',
  // Phase 1.5 — system-managed CTI statuses. Not agent-selectable.
  ON_CALL  = 'on_call',
  WRAP_UP  = 'wrap_up',
}

/**
 * Search filter options available to agents when searching for a customer or vehicle.
 * Maps to reference_values with reference_type = 'search_filter'.
 */
export enum SearchFilter {
  MOBILE = 'mobile',
  REGISTRATION_NUMBER = 'registration_number',
  CUSTOMER_NAME = 'customer_name',
  EMAIL = 'email',
}

/**
 * The reason the customer contacted the call centre.
 * Captured as part of the interaction wrap-up.
 * Maps to reference_values with reference_type = 'contact_reason'.
 */
export enum ContactReason {
  COMPLAINT = 'complaint',
  QUERY = 'query',
  SUGGESTION = 'suggestion',
  FEEDBACK = 'feedback',
  OTHER = 'other',
}

/**
 * The outcome of the agent's customer/vehicle identification attempt.
 * Captured as part of the interaction wrap-up.
 * Maps to reference_values with reference_type = 'identification_outcome'.
 */
export enum IdentificationOutcome {
  CUSTOMER_VEHICLE_IDENTIFIED = 'customer_vehicle_identified',
  CUSTOMER_IDENTIFIED_VEHICLE_UNRESOLVED = 'customer_identified_vehicle_unresolved',
  VEHICLE_IDENTIFIED_CUSTOMER_PARTIALLY_RESOLVED = 'vehicle_identified_customer_partially_resolved',
  NO_VERIFIED_MATCH = 'no_verified_match',
  MULTIPLE_MATCHES_RESOLVED_BY_AGENT = 'multiple_matches_resolved_by_agent',
}

/**
 * The final disposition of an interaction — how it was concluded.
 * Captured as part of the interaction wrap-up.
 * Maps to reference_values with reference_type = 'interaction_disposition'.
 */
export enum InteractionDisposition {
  INFORMATION_PROVIDED = 'information_provided',
  INFORMATION_CAPTURED = 'information_captured',
  NO_MATCH_FOUND = 'no_match_found',
  WRONG_NUMBER = 'wrong_number',
  SILENT_CALL = 'silent_call',
  ABUSIVE_CALLER = 'abusive_caller',
  TECHNICAL_ISSUE = 'technical_issue',
  TRANSFERRED_OUTSIDE_CCM = 'transferred_outside_ccm',
  INCOMPLETE_INTERACTION = 'incomplete_interaction',
  OTHERS = 'others',
}

/**
 * The channel through which an interaction was initiated.
 */
export enum InteractionChannel {
  MANUAL = 'manual',
  INBOUND_CALL = 'inbound_call',
}

/**
 * The mode of interaction start.
 */
export enum InteractionMode {
  MANUAL = 'manual',
}

/**
 * Bajaj product type — classifies the vehicle segment.
 * Master values for CCM Phase 1.
 * Maps to the productType field on vehicle context data.
 */
export enum ProductType {
  MOTORCYCLE        = 'Motorcycle',
  COMMERCIAL_VEHICLE = 'Commercial Vehicle',
  PROBIKING         = 'Probiking',
  CHETAK            = 'Chetak',
}

/**
 * Controlled event names for the interaction event log.
 * Maps to interaction_events.event_name CHECK constraint.
 * Source: phase1-technical-blueprint.md §10.2
 * Values must be lowercase snake_case to match DB CHECK and audit.repository.ts.
 */
export enum InteractionEventName {
  INTERACTION_CREATED           = 'interaction_created',
  SEARCH_STARTED                = 'search_started',
  SEARCH_RESULT_RETURNED        = 'search_result_returned',
  CUSTOMER_SELECTED             = 'customer_selected',
  VEHICLE_SELECTED              = 'vehicle_selected',
  DEALER_LOADED                 = 'dealer_loaded',
  CUSTOMER_RESELECTED           = 'customer_reselected',
  DISPOSITION_SAVED             = 'disposition_saved',
  INTERACTION_CLOSED            = 'interaction_closed',
  INTERACTION_MARKED_INCOMPLETE = 'interaction_marked_incomplete',
  AGENT_STATUS_CHANGED          = 'agent_status_changed',
}
