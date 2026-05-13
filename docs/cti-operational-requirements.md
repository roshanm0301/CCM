# CTI Operational Requirements

## Scope

This document defines the mandatory runtime environment for agents using CCM in CTI mode
(TeleCMI WebRTC integration via piopiyjs). Violating these requirements causes call-handling
failures that CCM cannot detect or recover from programmatically.

---

## Why these rules exist — technical background

The piopiyjs SDK registers one WebRTC SIP endpoint per browser session using the agent's
TeleCMI credentials (`telecmi_agent_id` + `telecmi_sip_password`). If a second SIP endpoint
registers against the same credential in the same browser session (via the TeleCMI softphone
portal, a browser extension, or a duplicate CCM tab), TeleCMI's SBC will route an inbound
call to whichever endpoint responds first. If that endpoint is NOT the CCM-registered one:

- CCM's `answered` event handler never fires.
- `ctiStore` never transitions from `ringing` to `active`.
- No interaction record is created (`createInteractionFromCall` is never called).
- The agent completes the call but CCM has no record of it — no wrapup, no case linkage.

---

## Requirement 1 — TeleCMI web softphone must NOT run in the same browser session as CCM

The TeleCMI web softphone portal (`app.telecmi.com` or any white-labelled equivalent) must
**not** be open in any tab within the same Chrome/Edge browser profile while CCM is in use.

**Why:** The softphone registers the same SIP agent credential in the same browser session,
creating a competing WebRTC endpoint. TeleCMI SBC routes to whichever answers first.

**Enforcement:**
- Agents must close all TeleCMI portal tabs before starting a CCM session.
- Supervisors should verify this during workstation setup and onboarding checks.
- Use a dedicated Chrome profile for CCM that has no TeleCMI portal bookmarks or pinned tabs.

---

## Requirement 2 — TeleCMI browser extension must NOT be active in the CCM browser profile

The TeleCMI Chrome/Edge extension (if installed) injects its own call control widget into
every page and registers a competing SIP endpoint.

**Why this matters:**
- The extension widget is injected into the browser chrome — outside the CCM DOM.
- CCM CSS cannot suppress it.
- If an agent answers a call via the extension widget, CCM receives no `answered` event.

**Enforcement:**
- Agents must use a Chrome profile that does not have the TeleCMI extension installed.
- Alternatively, disable the extension specifically in the profile used for CCM:
  `chrome://extensions` → TeleCMI extension → toggle OFF.

---

## Requirement 3 — Only one CCM tab per browser session

CCM mounts `useCtiClient` (the piopiyjs initialisation hook) once per `WorkspacePage` render.
Opening CCM in two tabs in the same browser profile creates two competing piopiyjs instances
registered to the same SIP agent.

**Symptoms of violation:** Calls ring on both tabs; answering on one leaves the other stuck
in `ringing` state; elapsed timer and wrapup lock may be inconsistent.

**Enforcement:** Close all duplicate CCM tabs. If a tab accidentally duplicates, refresh the
intended tab to force a clean piopiyjs re-registration.

---

## Summary — agent workstation checklist

Before starting a shift in CTI mode, agents must confirm:

| Check | Required state |
|---|---|
| TeleCMI softphone portal (`app.telecmi.com`) | ❌ Closed — no open tabs |
| TeleCMI browser extension | ❌ Disabled or not installed in this profile |
| CCM tabs open | ✅ Exactly one |
| Mode dialog selection | ✅ CTI — Telephony Connected |
| Agent status | ✅ Ready for Calls (to receive inbound calls) |

---

## What CCM handles automatically (no agent action required)

| Scenario | CCM behaviour |
|---|---|
| Caller hangs up before agent answers | `missed` event resets banner to idle |
| Agent-initiated mute | `isMuted` state updates immediately in CtiActiveCallBar |
| Provider-initiated mute (supervisor/compliance) | `on('mute')` event syncs `isMuted` state |
| Agent-initiated hold | `isOnHold` state updates immediately |
| Provider-initiated hold (supervisor barge) | `on('hold')` event syncs `isOnHold` state |
| Call ends before wrapup submitted | Navigation locked; agent must complete wrapup form |

---

## Future improvements (out of scope — current phase)

- **Competing registration detection:** Detect when piopiyjs `login` fires a second time in
  the same session (indicating a duplicate SIP registration) and display a warning banner.
- **Transfer:** `piopiy.transfer(destination)` — requires backend coordination.
- **DTMF tones:** `piopiy.sendDtmf(tone)` — required for IVR navigation during a call.

---

*Source: CCM Phase 1.5 CTI integration. Updated: 2026-04-05.*
