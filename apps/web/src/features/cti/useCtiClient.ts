/**
 * useCtiClient — initialises the TeleCMI piopiyjs WebRTC SDK and wires all
 * call lifecycle events to the ctiStore and interactionStore.
 *
 * Mount this hook exactly once in WorkspacePage.  It runs only on mount and
 * cleans up on unmount.  If the agent has no TeleCMI configuration (404 from
 * sdk-config) the hook silently returns without error.
 *
 * Controls (answer, decline, hangUp, mute, hold, outboundCall) are registered
 * in the ctiStore via registerControls() so any component can consume them
 * without prop drilling.
 *
 * Source: CCM Wave 2 spec — TeleCMI CTI integration (frontend)
 *         CCM Phase 6 — outbound calling extension
 *
 * --- Key piopiyjs SDK behaviours (discovered from source inspection) --------
 *
 * 1. inComingCall event payload is `{ from: display_name }` only.
 *    The `uuid` field is NOT included — it is set on the internal cmi_session
 *    AFTER the event is emitted.  Reading via getCallId() inside the handler
 *    returns the PREVIOUS session's id.  We read it via setTimeout(0) so the
 *    SIP call_id is available after the synchronous invite() stack unwinds.
 *    Note: getCallId() returns the SIP call-id, not TeleCMI's X-cmi-uuid;
 *    the real cmiuuid arrives later via the CDR webhook and is matched by
 *    from_number + agent fallback in the webhook service.
 *
 * 2. React Strict Mode double-mount guard.
 *    useEffect cleanup sets `mounted=false` and calls piopiy.logout().
 *    Because init() is async, the first mount's init() can continue running
 *    after cleanup completes.  Without a post-await `if (!mounted) return`
 *    guard, a stale piopiy instance calls login() and registers with TeleCMI
 *    SBC.  TeleCMI then routes the inbound SIP INVITE to that stale instance,
 *    whose inComingCall handler silently drops it (!mounted).  The live
 *    instance never fires inComingCall — no banner appears.
 *    Fix: check `mounted` immediately after every await inside init().
 *
 * 3. `missed` event — piopiyjs fires `missed` when the caller hangs up
 *    before the agent answers.  Without a handler, ctiStore stays stuck in
 *    `ringing` state indefinitely.
 */

import { useEffect, useRef } from 'react';
import PIOPIY from 'piopiyjs';
import { useCtiStore } from './ctiStore';
import { fetchSdkConfig, fetchCallerLookup, fetchCallerContext, createInteractionFromCall, initiateOutboundCall } from './ctiApi';
import { useInteractionStore } from '@/features/interaction/interactionStore';
import { useAgentStatusStore } from '@/features/agent-status/agentStatusStore';
import { AgentStatus, InteractionStatus } from '@ccm/types';

export function useCtiClient() {
  const piopiyRef = useRef<InstanceType<typeof PIOPIY> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const config = await fetchSdkConfig();

      // ── CRITICAL: guard against stale async init from React Strict Mode ──
      // React Strict Mode runs cleanup between the two mounts. fetchSdkConfig()
      // is async, so this init() may still be running after cleanup has set
      // mounted=false. Without this guard, the stale instance calls login()
      // and registers with TeleCMI SBC — causing inbound calls to be silently
      // dropped by the stale handler (see comment at top of file).
      if (!mounted) return;

      // Agent not provisioned in TeleCMI — silently skip
      if (!config || !config.telecmiAgentId) return;

      const piopiy = new PIOPIY({ name: 'CCM Agent', debug: false, autoplay: true, ringTime: 60 });
      piopiyRef.current = piopiy;

      // ── Build call controls and register them in the store ────────────────
      function answer() {
        piopiyRef.current?.answer();
      }
      function decline() {
        piopiyRef.current?.reject();
      }
      function hangUp() {
        piopiyRef.current?.terminate();
      }
      function mute() {
        const { isMuted } = useCtiStore.getState();
        if (isMuted) {
          piopiyRef.current?.unMute();
          useCtiStore.getState().setMuted(false);
        } else {
          piopiyRef.current?.mute();
          useCtiStore.getState().setMuted(true);
        }
      }
      function hold() {
        const { isOnHold } = useCtiStore.getState();
        if (isOnHold) {
          piopiyRef.current?.unHold();
          useCtiStore.getState().setOnHold(false);
        } else {
          piopiyRef.current?.hold();
          useCtiStore.getState().setOnHold(true);
        }
      }

      async function outboundCall(destination: string) {
        const { callStatus } = useCtiStore.getState();
        // Guard: do not initiate if a call is already in progress
        if (callStatus !== 'idle') {
          // eslint-disable-next-line no-console
          console.warn('[CTI] Outbound call attempted while callStatus is not idle — ignoring');
          return;
        }
        try {
          const result = await initiateOutboundCall(destination);
          useCtiStore.getState().setDialing(destination, result.requestId);
          // Trigger the WebRTC SIP call leg from the browser
          piopiyRef.current?.call(destination, { requestId: result.requestId, ccm: true });
        } catch (err: unknown) {
          // On failure: reset to idle so the dialpad becomes usable again.
          // Use clearCallState() (not reset()) — piopiy is still mounted and
          // callControls must remain valid for the next call.
          useCtiStore.getState().clearCallState();
          // eslint-disable-next-line no-console
          console.error('[CTI] Outbound call failed', err);
          throw err; // re-throw so CtiDialpad can show the error
        }
      }

      useCtiStore.getState().registerControls({ answer, decline, hangUp, mute, hold, outboundCall });

      // ── SBC connection ────────────────────────────────────────────────────

      piopiy.on('login', (obj) => {
        if (obj.code === 200) {
          // Always log — critical diagnostic confirming SBC WebRTC registration
          // eslint-disable-next-line no-console
          console.info('[CTI] Connected to TeleCMI SBC', { agentId: config.telecmiAgentId });
        }
      });

      piopiy.on('loginFailed', (obj) => {
        // eslint-disable-next-line no-console
        console.error('[CTI] TeleCMI SBC login failed', obj);
      });

      piopiy.on('logout', () => {
        // eslint-disable-next-line no-console
        console.info('[CTI] Logged out from TeleCMI SBC');
      });

      // ── Outbound: trying (code 100 — SBC accepted the outbound INVITE) ────
      piopiy.on('trying', (_obj) => {
        if (!mounted) return;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info('[CTI] Outbound call trying (SBC accepted INVITE)');
        }
      });

      // ── Ringing (code 183 — destination is ringing) ──────────────────────
      piopiy.on('ringing', (_obj) => {
        if (!mounted) return;
        // No state transition: 'dialing' already shows the ringing overlay.
      });

      // ── Incoming call ─────────────────────────────────────────────────────
      //
      // piopiyjs emits inComingCall with `{ from: display_name }` only.
      // The SIP call_id is set on the internal session AFTER this emit returns,
      // so we schedule a setTimeout(0) to read it once the stack unwinds.

      piopiy.on('inComingCall', (call) => {
        if (!mounted) return;
        const fromNumber = call.from ?? '';

        // Guard: only accept calls when the agent is in READY_FOR_CALLS status.
        // Any other status (break, offline, training, on_call, wrap_up) triggers
        // an immediate piopiy.reject() so TeleCMI can re-route the call to an
        // available agent without waiting for the 60-second ring timeout.
        // Use the static Zustand accessor (not the hook) because this runs inside
        // an event callback outside the React render cycle.
        const { currentStatus } = useAgentStatusStore.getState();
        if (currentStatus !== AgentStatus.READY_FOR_CALLS) {
          // eslint-disable-next-line no-console
          console.info('[CTI] Inbound call auto-rejected — agent not ready for calls', {
            status: currentStatus,
            from: fromNumber,
          });
          piopiyRef.current?.reject();
          return;
        }

        // Always log so we can confirm the event fires in all environments
        // eslint-disable-next-line no-console
        console.info('[CTI] Incoming call received', { from: fromNumber });

        // Set ringing immediately with empty cmiuuid — it is updated below
        // after piopiyjs sets the call_id on its internal session
        useCtiStore.getState().setRinging('', fromNumber);

        // After the synchronous invite() stack unwinds, piopiyjs sets call_id.
        // Read it and update the store so the answered handler can use it.
        setTimeout(() => {
          if (!mounted) return;
          const rawCallId = piopiyRef.current?.getCallId();
          const sipCallId = rawCallId ? String(rawCallId) : '';
          if (sipCallId) {
            useCtiStore.getState().updateCmiuuid(sipCallId);
          }
        }, 0);

        // Async caller lookup — result stored in ctiStore; call bar re-renders
        if (fromNumber) {
          fetchCallerLookup(fromNumber)
            .then((result) => {
              if (!mounted) return;
              useCtiStore
                .getState()
                .setCallerInfo(result.found ? (result.name ?? null) : null, result.found);
            })
            .catch(() => {
              if (!mounted) return;
              useCtiStore.getState().setCallerInfo(null, false);
            });

          // Proactive pre-fetch — fetch the full customer record before the agent
          // answers so results appear instantly in the search panel.
          //
          // Uses /api/v1/cti/caller-context which requires no interactionId
          // (the interaction doesn't exist yet at this point — it's created
          // in the 'answered' handler). Server-side normalisation strips the
          // international prefix and matches against the stored 10-digit mobile.
          fetchCallerContext(fromNumber)
            .then((results) => {
              if (!mounted) return;
              useCtiStore.getState().setPreFetchedResults(results);
            })
            .catch(() => {
              if (!mounted) return;
              useCtiStore.getState().setPreFetchedResults([]);
            });
        } else {
          // No from number — number is withheld or unrecognised
          useCtiStore.getState().setIsWithheld(true);
        }
      });

      // ── Call answered ─────────────────────────────────────────────────────

      piopiy.on('answered', () => {
        if (!mounted) return;
        const { callDirection, fromNumber } = useCtiStore.getState();

        if (callDirection === 'inbound') {
          // fromNumber is the minimum required to create an interaction.
          // cmiuuid may be empty if piopiyjs did not expose it — the backend
          // CDR webhook will link by from_number fallback in that case.
          if (!fromNumber) return;
          useCtiStore.getState().setAnswered();

          // Read cmiuuid after setAnswered — it may have been updated by the
          // setTimeout(0) in inComingCall by this point
          const { cmiuuid } = useCtiStore.getState();

          // eslint-disable-next-line no-console
          console.info('[CTI] Inbound call answered', { cmiuuid, fromNumber });

          // Fire-and-forget: create the interaction record in the backend.
          // IMPORTANT: do NOT snapshot preFetchedResults here at answer time —
          // the pre-fetch HTTP call may still be in-flight when the agent answers
          // quickly (e.g. hard refresh, fast pick-up). Instead, read from the live
          // store INSIDE .then(), after the createInteractionFromCall round-trip
          // (~200–500 ms) has given the pre-fetch time to resolve.
          //
          // isWithheld is set once in inComingCall when fromNumber is empty
          // (genuinely withheld number) and does not change, so reading it at
          // either point is equivalent — we read it inside .then() for consistency.
          createInteractionFromCall(cmiuuid ?? '', fromNumber)
            .then((result) => {
              if (!mounted) return;

              // Always set the interaction — do NOT discard if callStatus is
              // 'ended'. On some networks / Docker setups piopiyjs fires hangup
              // BEFORE this HTTP response returns. If we discard here:
              //   • interactionId is never set in the frontend
              //   • The backend DID create the interaction record
              //   • The next call attempt returns 409 INTERACTION_ALREADY_ACTIVE
              //   • Every subsequent call fails → agent sees "Ready for Calls" forever
              //
              // Use the server-supplied startedAt so the elapsed timer is accurate.
              const startedAt = result.startedAt ?? new Date().toISOString();
              const { preFetchedResults, isWithheld } = useCtiStore.getState();
              const seedResults =
                !isWithheld && preFetchedResults && preFetchedResults.length > 0
                  ? preFetchedResults
                  : null;

              // Diagnostic: log what preFetchedResults contains at response time.
              // preFetchedResults should be non-empty for a known caller number.
              // If it is null or [] here, the pre-fetch either hasn't completed
              // yet (race) or the caller's number is not in the customer database.
              // eslint-disable-next-line no-console
              console.info('[CTI] Interaction created', {
                interactionId: result.interactionId,
                callStatus: useCtiStore.getState().callStatus,
                preFetchedCount: preFetchedResults?.length ?? 'null',
                seedResultsCount: seedResults?.length ?? 'null',
                fromNumber,
              });

              useInteractionStore
                .getState()
                .setInboundCallInteraction(
                  result.interactionId,
                  InteractionStatus.IDENTIFYING,
                  startedAt,
                  fromNumber,
                  seedResults,
                );

              // NOTE: Do NOT call triggerWrapupIfNeeded() here even if
              // callStatus === 'ended'.
              //
              // When hangup fires before this HTTP response (quick test calls):
              //   - hangup's triggerWrapupIfNeeded() fired with the OLD interaction
              //     ID (INCOMPLETE/CLOSED → no-op) or null (fresh session → no-op).
              //   - Calling it again here would skip the SearchPanel entirely,
              //     throwing the agent directly into WrapupForm without ever seeing
              //     customer details.
              //
              // Instead, InteractionPanel renders a "Call Ended — Start Wrap-up"
              // banner in IDENTIFYING state when ctiCallStatus === 'ended', giving
              // the agent a chance to search for the customer first.  The hangup /
              // ended handlers correctly trigger WRAPUP for calls that end AFTER
              // the interaction is created (the normal path).
            })
            .catch((err: unknown) => {
              if (!mounted) return;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const httpStatus = (err as any)?.response?.status as number | undefined;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const errData = (err as any)?.response?.data as Record<string, unknown> | undefined;
              // eslint-disable-next-line no-console
              console.error('[CTI] Failed to create interaction from call', {
                httpStatus,
                errData,
                message: err instanceof Error ? err.message : String(err),
              });

              if (httpStatus === 409) {
                // 409 means there is already an open interaction for this agent
                // (left open from a prior call that was not closed or completed).
                // Resume it so the agent can complete wrapup for the old record.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingId = (errData as any)?.error?.details?.existingInteractionId as string | undefined;
                if (existingId) {
                  // eslint-disable-next-line no-console
                  console.info('[CTI] Resuming existing open interaction from 409', { existingId });
                  useInteractionStore.getState().resumeInteraction({
                    id: existingId,
                    status: InteractionStatus.IDENTIFYING,
                    startedAt: new Date().toISOString(),
                    channel: 'inbound_call',
                    ctiFromNumber: fromNumber,
                  });
                  // CTI call state resets — the ringing/active overlay clears
                  useCtiStore.getState().clearCallState();
                  return;
                }
              }

              // Use clearCallState() (not reset()) — piopiy is still mounted and
              // callControls must remain registered for the next inbound call.
              useCtiStore.getState().clearCallState();
            });

        } else if (callDirection === 'outbound') {
          // Outbound: destination answered — transition dialing → active
          // No interaction is created for outbound calls
          useCtiStore.getState().setOutboundAnswered();
        }
      });

      // ── Call ended / hung up ──────────────────────────────────────────────
      //
      // piopiyjs fires TWO separate events when a call terminates:
      //   'hangup' — fires when EITHER side hangs up (including agent terminate())
      //   'ended'  — fires when the call is fully torn down (may fire after hangup,
      //              or may not fire at all for agent-initiated termination)
      //
      // Previously the wrapup transition was only in 'ended'.  In practice, when
      // the agent clicks "Hang Up" (piopiy.terminate()), TeleCMI fires 'hangup'
      // but NOT 'ended' — so the wrapup form never appeared.  Both handlers now
      // call the shared triggerWrapupIfNeeded() so the transition fires regardless
      // of which event TeleCMI sends.  The terminal-status guard prevents the
      // wrapup from being triggered twice if both events do fire.

      function triggerWrapupIfNeeded() {
        // WRAPUP transition only applies to inbound_call interactions that were
        // successfully created (interactionId !== null).
        //
        // Cases handled:
        //
        //   1. hangup/ended fires BEFORE createInteractionFromCall returns:
        //      interactionId is still null → outer guard fails → no-op.
        //      .then() creates the interaction in IDENTIFYING state and the
        //      amber "Call ended" banner guides the agent to Start Wrap-up.
        //
        //   2. hangup/ended fires AFTER interaction created but status is
        //      IDENTIFYING (fast/test calls — piopiyjs often fires 'ended'
        //      within milliseconds of 'answered' on short calls):
        //      IDENTIFYING guard below fires → no-op.
        //      Agent sees the SearchPanel + "Call ended" banner and can search
        //      for the customer before manually clicking "Start Wrap-up".
        //
        //   3. hangup/ended fires AFTER agent has selected a customer
        //      (status = CONTEXT_CONFIRMED — the normal long-call path):
        //      interactionId set, channel inbound_call, status not terminal →
        //      WRAPUP is triggered correctly.
        //
        //   4. Both hangup AND ended fire (piopiyjs fires both on termination):
        //      First event sets status=WRAPUP. Second event finds WRAPUP in
        //      terminalStatuses → idempotent no-op.
        const { interactionId, channel, status, setStatus, setWrapupPending } =
          useInteractionStore.getState();
        const terminalStatuses: string[] = ['WRAPUP', 'CLOSED', 'INCOMPLETE'];

        // ── CRITICAL: never auto-advance out of IDENTIFYING ─────────────────
        // When a call ends while the agent is still in IDENTIFYING state, the
        // agent has not yet seen or selected a customer.  Forcing WRAPUP here
        // skips the SearchPanel entirely — the WrapupForm renders with no
        // customer context and the agent is left with a blank form.
        //
        // The "Call ended" amber banner in InteractionPanel already handles
        // this case: it appears whenever ctiCallStatus === 'ended' &&
        // channel === 'inbound_call' && status === IDENTIFYING, and offers a
        // "Start Wrap-up" button the agent can click after searching.
        if (status === InteractionStatus.IDENTIFYING) return;

        if (
          interactionId &&
          channel === 'inbound_call' &&
          status &&
          !terminalStatuses.includes(status)
        ) {
          setStatus(InteractionStatus.WRAPUP);
          // Lock navigation until wrapup is submitted (CTI mode only)
          setWrapupPending(true);
        }
      }

      // setEnded() only writes { callStatus: 'ended' } — calling it from both
      // handlers is fully idempotent: the second call writes the same value and
      // no other fields are mutated.  No callStatus guard is needed here.
      piopiy.on('ended', () => {
        if (!mounted) return;
        useCtiStore.getState().setEnded();
        triggerWrapupIfNeeded();
      });

      piopiy.on('hangup', () => {
        if (!mounted) return;
        useCtiStore.getState().setEnded();     // idempotent — safe to call twice
        triggerWrapupIfNeeded();
      });

      // ── Missed call (caller hung up before agent answered) ────────────────
      // piopiyjs fires 'missed' when the inbound call times out or the caller
      // disconnects before the agent clicks Answer.  Without this handler the
      // ctiStore stays stuck in 'ringing' state permanently.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (piopiy as any).on('missed', () => {
        if (!mounted) return;
        // eslint-disable-next-line no-console
        console.info('[CTI] Incoming call missed — resetting to idle');
        // Use clearCallState() (not reset()) — piopiy is still mounted.
        useCtiStore.getState().clearCallState();
      });

      // ── Provider-side hold / unhold ───────────────────────────────────────
      // Fired when a supervisor barges, a system hold is applied, or the
      // provider toggles hold state independently of the agent's own
      // hold() / unHold() calls (e.g. TeleCMI quality monitoring).
      // Guard to 'active' to avoid spurious state mutations during call
      // setup or teardown.  Agent-initiated hold already calls setOnHold()
      // synchronously before issuing the SDK command — these handlers keep
      // the store in sync when the hold originates from the provider side.
      piopiy.on('hold', () => {
        if (!mounted) return;
        if (useCtiStore.getState().callStatus === 'active') {
          useCtiStore.getState().setOnHold(true);
        }
      });

      piopiy.on('unhold', () => {
        if (!mounted) return;
        if (useCtiStore.getState().callStatus === 'active') {
          useCtiStore.getState().setOnHold(false);
        }
      });

      // ── Provider-side mute / unmute ───────────────────────────────────────
      // Fired when the provider system mutes the agent (e.g. compliance
      // intervention, quality monitoring).  Keeps isMuted in sync so the
      // CtiActiveCallBar reflects the true audio state regardless of how
      // the mute was initiated.
      piopiy.on('mute', () => {
        if (!mounted) return;
        if (useCtiStore.getState().callStatus === 'active') {
          useCtiStore.getState().setMuted(true);
        }
      });

      piopiy.on('unmute', () => {
        if (!mounted) return;
        if (useCtiStore.getState().callStatus === 'active') {
          useCtiStore.getState().setMuted(false);
        }
      });

      piopiy.on('error', (obj) => {
        // eslint-disable-next-line no-console
        console.error('[CTI] piopiyjs error', obj);
        // If an error fires while dialing, reset to idle.
        // Use clearCallState() (not reset()) — piopiy is still mounted.
        const { callStatus } = useCtiStore.getState();
        if (callStatus === 'dialing') {
          useCtiStore.getState().clearCallState();
        }
      });

      // ── Login ─────────────────────────────────────────────────────────────
      piopiy.login(config.telecmiAgentId, config.telecmiSipPassword, config.sbcUri);
    }

    init().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[CTI] Initialisation error', err);
    });

    return () => {
      mounted = false;
      if (piopiyRef.current) {
        try {
          piopiyRef.current.logout();
        } catch {
          // ignore logout errors on unmount
        }
        piopiyRef.current = null;
      }
    };
  }, []); // mount-only — piopiy SDK is a singleton for the session
}
