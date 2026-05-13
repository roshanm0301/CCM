/**
 * Agent Status Store — Zustand-based.
 *
 * Shared across all AgentStatusWidget instances and any component that needs
 * to gate behaviour on the agent's current operational status (e.g. the
 * "Start New Interaction" button is only enabled when status is READY_FOR_CALLS).
 *
 * Intentionally kept separate from authStore — status changes frequently during
 * a session and must not trigger auth-state re-renders.
 *
 * Source: CCM_Phase1_Agent_Interaction_Documentation.md §C11, §D2
 */

import { create } from 'zustand';
import { AgentStatus } from '@ccm/types';

interface AgentStatusState {
  /** Current operational status of the signed-in agent. */
  currentStatus: AgentStatus;
  /** True while a PATCH /agent/status request is in flight. */
  updating: boolean;

  setCurrentStatus: (status: AgentStatus) => void;
  setUpdating: (updating: boolean) => void;
}

export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  currentStatus: AgentStatus.OFFLINE,
  updating: false,

  setCurrentStatus: (status) => set({ currentStatus: status }),
  setUpdating: (updating) => set({ updating }),
}));
