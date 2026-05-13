/**
 * CTI store — Zustand.
 *
 * Holds all client-side state for the TeleCMI WebRTC call lifecycle:
 *   Inbound:  idle → ringing → active → ended → (reset to idle)
 *   Outbound: idle → dialing → active → ended → (reset to idle)
 *
 * Also stores registered piopiy call controls so that any component can
 * trigger answer / decline / hangUp / mute / hold / outboundCall without
 * prop drilling or a separate React context.
 *
 * Source: CCM Wave 2 spec — TeleCMI CTI integration (frontend)
 *         CCM Phase 6 — outbound calling extension
 */

import { create } from 'zustand';
import type { SearchResultItem } from '@/features/interaction/interactionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CtiCallStatus = 'idle' | 'ringing' | 'active' | 'ended' | 'dialing';

export type CtiCallDirection = 'inbound' | 'outbound' | null;

export interface CtiCallControls {
  answer: () => void;
  decline: () => void;
  hangUp: () => void;
  mute: () => void;
  hold: () => void;
  /** Initiate an outbound click2call to the given destination */
  outboundCall: (destination: string) => void;
}

interface CtiState {
  callStatus: CtiCallStatus;
  /** Direction of the current or most recent call */
  callDirection: CtiCallDirection;
  cmiuuid: string | null;
  fromNumber: string | null;
  callerName: string | null;    // null = pending lookup, '' = not found
  callerFound: boolean | null;  // null = pending
  isMuted: boolean;
  isOnHold: boolean;
  callStartedAt: Date | null;   // set when call becomes active — used for elapsed timer
  callControls: CtiCallControls | null;
  /** Outbound: destination number being dialled */
  outboundDestination: string | null;
  /** Outbound: click2call request_id returned by the API before cmiuuid is assigned */
  outboundRequestId: string | null;
  /**
   * Results proactively fetched by mobile number when inbound call starts ringing.
   * null = not yet fetched; [] = fetched but no results found.
   */
  preFetchedResults: SearchResultItem[] | null;
  /** True when the caller's number is withheld or unrecognised. */
  isWithheld: boolean;
}

interface CtiActions {
  setRinging(cmiuuid: string, fromNumber: string): void;
  /** Update cmiuuid after piopiyjs exposes the SIP call_id asynchronously */
  updateCmiuuid(cmiuuid: string): void;
  setCallerInfo(name: string | null, found: boolean): void;
  setAnswered(): void;
  setMuted(muted: boolean): void;
  setOnHold(hold: boolean): void;
  setEnded(): void;
  reset(): void;
  /**
   * Clears all call-related fields back to their initial values WITHOUT clearing
   * callControls.  Use this for mid-session resets (missed call, failed call,
   * short call) where the piopiy instance is still mounted and the registered
   * answer/decline/hangUp closures are still valid.
   *
   * Use reset() only when the piopiy hook is being unmounted (logout) or when
   * you explicitly want to force re-registration of controls on next mount.
   */
  clearCallState(): void;
  registerControls(controls: CtiCallControls): void;
  /** Outbound: transition idle → dialing */
  setDialing(destination: string, requestId: string): void;
  /** Outbound: transition dialing → active (call answered by destination) */
  setOutboundAnswered(): void;
  /** Store proactively fetched search results for the ringing caller */
  setPreFetchedResults(results: SearchResultItem[]): void;
  /** Mark the caller's number as withheld or unrecognised */
  setIsWithheld(withheld: boolean): void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: CtiState = {
  callStatus: 'idle',
  callDirection: null,
  cmiuuid: null,
  fromNumber: null,
  callerName: null,
  callerFound: null,
  isMuted: false,
  isOnHold: false,
  callStartedAt: null,
  callControls: null,
  outboundDestination: null,
  outboundRequestId: null,
  preFetchedResults: null,
  isWithheld: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCtiStore = create<CtiState & CtiActions>((set) => ({
  ...initialState,

  setRinging: (cmiuuid, fromNumber) =>
    set({
      callStatus: 'ringing',
      callDirection: 'inbound',
      cmiuuid,
      fromNumber,
      callerName: null,
      callerFound: null,
      isMuted: false,
      isOnHold: false,
      callStartedAt: null,
      outboundDestination: null,
      outboundRequestId: null,
      preFetchedResults: null,
      isWithheld: false,
    }),

  updateCmiuuid: (cmiuuid) =>
    set((state) => state.callStatus === 'ringing' ? { cmiuuid } : {}),

  setCallerInfo: (name, found) =>
    set({ callerName: name, callerFound: found }),

  setAnswered: () =>
    set({ callStatus: 'active', callStartedAt: new Date() }),

  setMuted: (isMuted) => set({ isMuted }),

  setOnHold: (isOnHold) => set({ isOnHold }),

  setEnded: () =>
    set({ callStatus: 'ended' }),

  reset: () =>
    set({
      callStatus: 'idle',
      callDirection: null,
      cmiuuid: null,
      fromNumber: null,
      callerName: null,
      callerFound: null,
      isMuted: false,
      isOnHold: false,
      callStartedAt: null,
      outboundDestination: null,
      outboundRequestId: null,
      preFetchedResults: null,
      isWithheld: false,
      // callControls is cleared on reset: the piopiy instance that registered
      // them may have been unmounted (e.g. logout), so retaining a stale
      // reference could silently no-op answer/decline clicks on the next call.
      // useCtiClient re-registers controls on each mount.
      callControls: null,
    }),

  clearCallState: () =>
    set({
      callStatus: 'idle',
      callDirection: null,
      cmiuuid: null,
      fromNumber: null,
      callerName: null,
      callerFound: null,
      isMuted: false,
      isOnHold: false,
      callStartedAt: null,
      outboundDestination: null,
      outboundRequestId: null,
      preFetchedResults: null,
      isWithheld: false,
      // callControls intentionally NOT cleared — the piopiy instance that
      // registered them is still mounted.  Clearing here would disable
      // Answer/Decline buttons on the very next incoming call.
      // Only reset() clears callControls (used when the hook unmounts).
    }),

  registerControls: (controls) =>
    set({ callControls: controls }),

  setDialing: (destination, requestId) =>
    set({
      callStatus: 'dialing',
      callDirection: 'outbound',
      outboundDestination: destination,
      outboundRequestId: requestId,
      cmiuuid: null,
      fromNumber: null,
      callerName: null,
      callerFound: null,
      isMuted: false,
      isOnHold: false,
      callStartedAt: null,
    }),

  setOutboundAnswered: () =>
    set({ callStatus: 'active', callStartedAt: new Date() }),

  setPreFetchedResults: (results) =>
    set({ preFetchedResults: results }),

  setIsWithheld: (withheld) =>
    set({ isWithheld: withheld }),
}));
