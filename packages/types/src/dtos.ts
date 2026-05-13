// =============================================================================
// CCM Phase 1 — Shared DTOs (Data Transfer Objects)
//
// Stub file. Backend Engineer will populate the request/response shapes here.
// Keep these interfaces aligned with the API contract.
// =============================================================================

import type {
  AgentStatus,
  ContactReason,
  IdentificationOutcome,
  InteractionChannel,
  InteractionDisposition,
  InteractionMode,
  InteractionStatus,
  SearchFilter,
} from './enums';

// -----------------------------------------------------------------------------
// Common envelope
// -----------------------------------------------------------------------------

/** Standard API success envelope. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Standard API error envelope. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// -----------------------------------------------------------------------------
// Auth DTOs — stub, backend-engineer will expand
// -----------------------------------------------------------------------------

export interface LoginRequestDto {
  username: string;
  password: string;
}

/**
 * Login response body.
 * The JWT session token is NOT returned here — it is set as an httpOnly
 * cookie (ccm_session) by the server. Only the CSRF token and user summary
 * are returned in the response body.
 * Source: security-principles.md § Cookie / JWT strategy
 */
export interface LoginResponseDto {
  /** CSRF double-submit token. Frontend must send this in X-CSRF-Token header for all mutations. */
  csrfToken: string;
  user: UserSummaryDto;
}

export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  status: AgentStatus;
}

// -----------------------------------------------------------------------------
// Interaction DTOs — stub, backend-engineer will expand
// -----------------------------------------------------------------------------

export interface StartInteractionRequestDto {
  channel: InteractionChannel;
  mode: InteractionMode;
}

export interface InteractionSummaryDto {
  id: string;
  channel: InteractionChannel;
  mode: InteractionMode;
  status: InteractionStatus;
  startedAt: string;
  startedByUserId: string;
  correlationId: string;
}

export interface WrapUpRequestDto {
  interactionId: string;
  contactReason: ContactReason;
  identificationOutcome: IdentificationOutcome;
  interactionDisposition: InteractionDisposition;
  remarks?: string;
}

export interface WrapUpResponseDto {
  id: string;
  interactionId: string;
  contactReason: ContactReason;
  identificationOutcome: IdentificationOutcome;
  interactionDisposition: InteractionDisposition;
  remarks?: string;
  savedAt: string;
}

// -----------------------------------------------------------------------------
// Search DTOs — stub, backend-engineer will expand
// -----------------------------------------------------------------------------

export interface SearchRequestDto {
  interactionId: string;
  filter: SearchFilter;
  value: string;
}

export interface SearchResultItemDto {
  type: 'customer' | 'vehicle';
  sourceSystem: string;
  referenceId: string;
  displayLabel: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface SearchResponseDto {
  resultCount: number;
  results: SearchResultItemDto[];
  attemptId: string;
}

// -----------------------------------------------------------------------------
// Reference / master-data DTOs — stub, backend-engineer will expand
// -----------------------------------------------------------------------------

export interface ReferenceValueDto {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  /** When true, the agent must supply remarks before the wrapup can be saved. */
  remarksRequired?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ReferenceValueListDto {
  referenceType: string;
  values: ReferenceValueDto[];
}

// -----------------------------------------------------------------------------
// Health DTOs
// -----------------------------------------------------------------------------

export interface HealthLiveDto {
  status: 'ok';
  timestamp: string;
}

export interface HealthReadyDto {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: {
    postgres: 'ok' | 'fail';
    mongo: 'ok' | 'fail';
  };
}
