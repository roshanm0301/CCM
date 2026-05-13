/**
 * agentStatusStore — pure Zustand store unit tests.
 *
 * Covers:
 * 1. Initial state shape — currentStatus OFFLINE, updating false.
 * 2. setCurrentStatus — updates currentStatus in the store.
 * 3. setUpdating — toggles the updating flag.
 *
 * No React rendering involved; tests operate directly on the store instance.
 *
 * Source: agentStatusStore.ts
 * Traceability: CCM_Phase1_Agent_Interaction_Documentation.md §C11, §D2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentStatus } from '@ccm/types';
import { useAgentStatusStore } from '../agentStatusStore';

// ---------------------------------------------------------------------------
// Reset store before every test so tests are fully isolated.
// ---------------------------------------------------------------------------

beforeEach(() => {
  useAgentStatusStore.setState({
    currentStatus: AgentStatus.OFFLINE,
    updating: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agentStatusStore — initial state', () => {
  it('has currentStatus initialised to OFFLINE', () => {
    const { currentStatus } = useAgentStatusStore.getState();
    expect(currentStatus).toBe(AgentStatus.OFFLINE);
  });

  it('has updating initialised to false', () => {
    const { updating } = useAgentStatusStore.getState();
    expect(updating).toBe(false);
  });
});

describe('agentStatusStore — setCurrentStatus', () => {
  it('updates currentStatus to READY_FOR_CALLS', () => {
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.READY_FOR_CALLS);
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.READY_FOR_CALLS);
  });

  it('updates currentStatus to BREAK', () => {
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.BREAK);
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.BREAK);
  });

  it('updates currentStatus to TRAINING', () => {
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.TRAINING);
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.TRAINING);
  });

  it('updates currentStatus back to OFFLINE', () => {
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.READY_FOR_CALLS);
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.OFFLINE);
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.OFFLINE);
  });
});

describe('agentStatusStore — setUpdating', () => {
  it('sets updating to true', () => {
    useAgentStatusStore.getState().setUpdating(true);
    expect(useAgentStatusStore.getState().updating).toBe(true);
  });

  it('sets updating back to false after being true', () => {
    useAgentStatusStore.getState().setUpdating(true);
    useAgentStatusStore.getState().setUpdating(false);
    expect(useAgentStatusStore.getState().updating).toBe(false);
  });

  it('does not mutate currentStatus when toggling updating', () => {
    useAgentStatusStore.getState().setCurrentStatus(AgentStatus.BREAK);
    useAgentStatusStore.getState().setUpdating(true);
    expect(useAgentStatusStore.getState().currentStatus).toBe(AgentStatus.BREAK);
  });
});
