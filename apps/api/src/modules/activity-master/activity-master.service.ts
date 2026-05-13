// =============================================================================
// CCM API — Activity Master Service
//
// Business logic for Activity Master management.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import type { CreateActivityInput, UpdateActivityInput } from './activity-master.validator';
import {
  findAllActivities,
  findActiveActivities,
  findActivityById,
  findActivityByCode,
  createActivity,
  updateActivity,
  type ActivityMasterRow,
} from './activity-master.repository';

// ---------------------------------------------------------------------------
// Response DTO
// ---------------------------------------------------------------------------

export interface ActivityMasterDto {
  id: string;
  code: string;
  displayName: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;   // Fix 8: expose updatedBy
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function toDto(row: ActivityMasterRow): ActivityMasterDto {
  return {
    id:          row.id,
    code:        row.code,
    displayName: row.displayName,
    description: row.description,
    isActive:    row.isActive,
    createdBy:   row.createdBy,
    updatedBy:   row.updatedBy,  // Fix 8
    createdAt:   row.createdAt.toISOString(),
    updatedAt:   row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/** Return all activities (for catalog grid). */
export async function listActivitiesService(): Promise<ActivityMasterDto[]> {
  const rows = await findAllActivities();
  return rows.map(toDto);
}

/** Return only active activities (for template step Activity dropdown). */
export async function listActiveActivitiesService(): Promise<ActivityMasterDto[]> {
  const rows = await findActiveActivities();
  return rows.map(toDto);
}

/** Create a new activity — code must be unique (case-insensitive, trimmed). */
export async function createActivityService(
  input: CreateActivityInput,
  userId: string,
): Promise<ActivityMasterDto> {
  const existing = await findActivityByCode(input.code);
  if (existing) {
    throw AppError.conflict('Activity code already exists.');
  }
  const row = await createActivity(
    { code: input.code, displayName: input.displayName, description: input.description ?? '', isActive: input.isActive ?? true },
    userId,
  );
  return toDto(row);
}

/** Update an existing activity. */
export async function updateActivityService(
  id: string,
  input: UpdateActivityInput,
  userId: string,   // Fix 8: no longer suppressed with underscore
): Promise<ActivityMasterDto> {
  const existing = await findActivityById(id);
  if (!existing) {
    throw AppError.notFound('Activity', id);
  }

  // Code uniqueness check (excluding self)
  if (input.code !== undefined) {
    const conflict = await findActivityByCode(input.code, id);
    if (conflict) {
      throw AppError.conflict('Activity code already exists.');
    }
  }

  const row = await updateActivity(
    id,
    {
      code:        input.code,
      displayName: input.displayName,
      description: input.description,
      isActive:    input.isActive,
    },
    userId,   // Fix 8: pass actor to repository
  );
  return toDto(row);
}
