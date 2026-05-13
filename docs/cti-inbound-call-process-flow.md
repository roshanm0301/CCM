# Inbound Call Handling in CCM — How It Works (Plain English Guide)

> **Audience:** Business stakeholders, product owners, QA, and new team members.
> **Purpose:** Explains what happens from agent login through a completed inbound call, covering every possible scenario and a critical review of current gaps.
> **Based on:** Source code analysis of CTI Wave 2 implementation + Phase 1 Agent Interaction requirements — April 2026.

---

## The Big Picture (Before We Dive In)

Think of CCM as a call centre desk system. When a customer calls the contact centre:

1. The phone rings on the agent's computer screen (not a physical desk phone — it uses the browser).
2. The agent answers.
3. A work record is created automatically — this is called an **Interaction**.
4. The agent searches for who called, confirms their details, and logs what the call was about.
5. The call ends, the agent files the record, and the desk is ready for the next call.

**The phone system is called TeleCMI.** It is the service that brings calls to the agent's browser. CCM and TeleCMI talk to each other so CCM knows a call is coming and can create the right records automatically.

---

## Part 1 — Step-by-Step: From Login to a Completed Call

---

### Step 1 — Agent Logs In

**What the agent does:** Opens CCM in their browser and signs in with their username and password.

**What the system does:**
- Checks that the credentials are correct.
- Checks that the account is active and that the person is an Agent (not a Supervisor or Dealer).
- Opens the CCM workspace.
- Sets the agent's status to **"Offline"** by default.

> **Example:**
> Jethalal opens `ccm.apt.com` and logs in with his credentials. CCM verifies he is an active Agent. The workspace loads. His status badge in the top bar shows "Offline".
>
> At this point, **no calls will ring for him** because he is Offline. He is not yet available.

**Why status starts as Offline:** This is intentional. The agent needs to be ready before calls start coming in. They may need a moment to settle in, review pending cases, or respond to a team briefing before taking calls.

---

### Step 2 — Agent Goes "Ready for Calls"

**What the agent does:** Clicks their status badge and changes it to **"Ready for Calls"**.

**What the system does:**
- Updates the agent's status in the system.
- From this moment, the phone routing system knows to send calls to this agent.

> **Example:**
> Jethalal clicks "Offline" in the top bar. A menu appears with options: Offline, Break, Training, Ready for Calls. He clicks "Ready for Calls." The badge turns green.
>
> Now whenever a customer calls the contact centre number, Jethalal is eligible to receive that call.

**Important:** The phone software in the browser (the part that makes calls work) loaded automatically in Step 1 when the workspace opened — it silently connected to the phone network in the background. Going "Ready for Calls" is about telling the routing system to start sending calls, not about connecting to the phone.

---

### Step 3 — A Customer Calls the Contact Centre

**What happens:** A customer dials the contact centre's published phone number (e.g., 1800-XXX-XXXX).

**What the system does:**
1. The phone network (TeleCMI) receives the call.
2. TeleCMI asks CCM: "Who should I send this call to?" CCM checks which agents are currently "Ready for Calls" and sends back the list.
3. TeleCMI routes the call to one of those agents.
4. The CCM workspace on that agent's screen shows an incoming call banner.

> **Example:**
> Mrs. Riya Raheja calls 1800-XXX-XXXX. TeleCMI checks with CCM and gets back: "Jethalal is Ready." TeleCMI sends the call to Jethalal's browser screen.

**What if nobody is Ready for Calls?**
TeleCMI gets an empty list from CCM. The caller will hear something like "All agents are busy, please try again" depending on TeleCMI's configuration. No call comes through to CCM. No record is created. This is a current gap — see Part 3, Problem 2.

---

### Step 4 — The Call Rings on the Agent's Screen

**What the agent sees:** A coloured banner floats up at the top of the screen showing:
- The caller's phone number (e.g., +91 9860 777 888)
- The caller's name — **if the phone number is found in the customer database** (covered in detail in Part 2)
- Two buttons: **Answer** and **Decline**

**What the system does in the background while it's ringing:**
- As soon as the call comes in, CCM silently looks up the calling number in the customer database.
- If it finds a match, the caller's name appears in the banner.
- This lookup happens automatically — the agent did not trigger it.

> **Example (Known Caller):**
> The banner shows: "Riya Raheja — +91 9860 777 888 — Incoming Call" with Answer / Decline buttons.
>
> **Example (Unknown Caller):**
> The banner shows: "+91 9744 123 456 — Incoming Call" with Answer / Decline buttons. No name appears because this number is not in the database.

The phone rings for up to **60 seconds** waiting for the agent to answer.

---

### Step 5 — Agent Answers the Call

**What the agent does:** Clicks the **Answer** button.

**What the system does:**
1. The call is connected — both the agent and customer can now hear each other.
2. The floating ringing banner disappears.
3. Call controls appear in the workspace header: Mute, Hold, Hang Up, and a running timer (e.g., 01:32 min).
4. **CCM automatically creates an Interaction record** — this is the work record for this call. It is assigned a unique ID and its status is set to **"Identifying"** (meaning: the agent needs to identify the customer).
5. The search panel opens on the left side of the screen so the agent can search for the customer.

> **Example:**
> Jethalal clicks Answer. The banner disappears. A call timer starts (00:01, 00:02...). The workspace now shows a search panel on the left and a blank context area. CCM has created Interaction "INT-00347" automatically in the background. Jethalal can now talk to Riya while he searches for her details.

**This Interaction record is what ties the call to the customer's history.** Every action from this point is logged against it.

---

### Step 6 — Agent Searches for the Customer

**What the agent does:** Types in the search box using one of four search methods:
- Mobile number
- Vehicle Registration Number
- Customer Name
- Email address

**What the system does:**
1. Validates the input (e.g., mobile must be 10 digits).
2. Searches the Install Base first (the main customer and vehicle database).
3. If nothing found there, searches the Customer Master (a broader customer list).
4. Shows the results.

> **Example:**
> Jethalal types the caller's number "9860777888" in the Mobile field and clicks Search. The system finds one result: "Riya Raheja — MH12PY0987 — Amin Automobiles, Baner." Jethalal clicks "Select."

What happens after selection depends on the situation — covered in Part 2.

---

### Step 7 — Customer Context is Confirmed

Once the agent selects a customer, the system:

1. Loads and displays three information cards: **Customer**, **Vehicle**, and **Dealer**.
2. Updates the Interaction status to **"Context Confirmed"**.
3. Locks these cards as read-only (the agent can still change their selection if they picked the wrong person).

> **Example:**
> After Jethalal selects Riya, three cards appear:
> - **Customer Card:** Riya Raheja, mobile 9860777888, email riya@example.com, Pune address.
> - **Vehicle Card:** MH12PY0987, Bajaj Avenger, sold 15-Jan-2024, last serviced 10-Dec-2025.
> - **Dealer Card:** Amin Automobiles, Baner — Active.

The agent is now fully informed about who they are talking to and the customer's vehicle and service history — all while the call is still live.

---

### Step 8 — Agent Fills the Wrap-Up Form

**What the agent does:** When the call conversation is complete, the agent clicks **"Start Wrap-Up"**.

**What the system does:** Presents a short form with three required dropdowns:

| Field | What It Captures | Example |
|---|---|---|
| Contact Reason | Why did the customer call? | Complaint |
| Identification Outcome | Was the customer identified? | Customer and Vehicle Identified |
| Interaction Disposition | What was the outcome? | Information Provided |

Some dispositions require the agent to type a remark. For example, if the outcome is "Incomplete Interaction" or "Abusive Caller", a text box appears and remarks become mandatory.

> **Example:**
> Riya called to complain that her vehicle's service was not completed properly. Jethalal fills in:
> - Contact Reason: **Complaint**
> - Identification Outcome: **Customer and Vehicle Identified**
> - Interaction Disposition: **Information Captured**
> - No remarks needed for this combination.
>
> He clicks Save.

The Interaction status becomes "Wrap-Up" once the form is saved.

> **Important:** The agent can fill this form **while still on the call**. The call controls (Mute, Hold, Hang Up) are still visible at the top. They do not have to hang up first before doing the wrap-up.

---

### Step 9 — Agent Closes the Interaction

After the wrap-up form is saved, the agent clicks either:

- **Close** — The call was handled successfully. Interaction status becomes "Closed." ✅
- The agent selects **"Incomplete Interaction"** as disposition — Interaction status becomes "Incomplete." ❌

> **Example (Close):**
> Call handled, information logged, Riya's complaint is noted. Jethalal clicks "Close." INT-00347 is now Closed. The workspace resets. Jethalal is ready for the next call.
>
> **Example (Incomplete):**
> The caller hung up suddenly before Jethalal could confirm their context. He selects "Incomplete Interaction" with a remark: "Caller disconnected before vehicle could be confirmed." He marks it Incomplete and closes. The record is saved for potential follow-up.

---

### Step 10 — What Happens in the Background After the Call Ends

After the call disconnects, TeleCMI sends CCM a **call summary record** that includes:
- How long the call lasted
- Whether it was answered or missed
- Any recording filename if recording is enabled

CCM receives this in the background and links it to the Interaction record created in Step 5. This is how the actual call duration gets recorded. The agent does not need to do anything for this — it is fully automatic.

---

## Part 2 — All Scenarios: What Can Happen During a Call

---

### Scenario 1 — Caller Is NOT in the Database (Unknown Caller)

**Situation:** Someone calls from a number that has never been registered in the customer system. No name appears in the ringing banner.

**What happens:**
1. Banner shows the number but no name.
2. Agent answers. Interaction created (status: Identifying).
3. Agent searches by mobile — zero results returned.
4. Agent may try searching by name or registration number (if the caller provides one).
5. Still no match found.
6. Agent fills wrap-up with **"No Match Found"** or another suitable disposition.
7. Interaction closed.

> **Example 1 — True unknown caller:**
> A call comes in from 9744123456. The banner shows only the number. Jethalal answers. Types "9744123456" in the search box — no results. Asks the caller their name: "Ramesh Patil." Searches by name — still nothing found. The person may be a new customer who has not been registered yet.
> - Disposition: **No Match Found**, Remark: "Caller Ramesh Patil — new customer enquiry, not in system." Close.
>
> **Example 2 — Wrong number:**
> Caller confirms they dialled the wrong number.
> - Disposition: **Wrong Number**. Close. Total time: 45 seconds.
>
> **Example 3 — Transferred enquiry:**
> The caller needs a different department and is not CCM's customer.
> - Disposition: **Transferred Outside CCM**. Close.

---

### Scenario 2 — Caller's Number IS in the Database — Single Clear Match

**Situation:** The caller's number is registered to exactly one customer. This is the most common and smooth scenario.

**What happens:**
1. During ringing — the caller's **name already appears** in the ringing banner because CCM found them automatically.
2. Agent answers. Interaction created (status: Identifying).
3. Agent types the caller's number in the search box (the search panel does not auto-fill it — this is a known gap, see Part 3, Problem 1).
4. Search returns one result. Agent clicks Select.
5. Customer, Vehicle, and Dealer cards load.
6. Agent confirms with the caller (e.g., "Am I speaking with Riya Raheja?").
7. Agent handles the call, fills wrap-up, closes.

> **Example:**
> Riya Raheja (9860777888) calls. The banner shows "Riya Raheja — +91 9860 777 888."
> Jethalal answers, types "9860777888" in the search field, finds Riya immediately, clicks Select.
> Cards load: Riya has one vehicle (MH12PY0987, Bajaj Avenger).
> Riya says her service reminder SMS came with the wrong date. Jethalal logs:
> - Contact Reason: **Query**
> - Identification Outcome: **Customer and Vehicle Identified**
> - Disposition: **Information Captured**
> Closes. Total call time: ~5 minutes.

---

### Scenario 3 — Caller's Number IS in the Database — Multiple Matches

**Situation:** The same mobile number is linked to more than one customer. This can happen when family members share a phone or when data was entered for the same number more than once.

**What happens:**
1. During ringing — the banner shows the number **without a name** because the system found multiple people and cannot be certain which one is calling.
2. Agent answers. Interaction created.
3. Search returns multiple results.
4. Agent asks the caller identifying questions: "Can I have your name?" or "What is your vehicle registration number?"
5. Agent finds the right person in the list and selects them.
6. Identification Outcome: **"Multiple Matches Resolved by Agent"**

> **Example:**
> Number 9730111222 is linked to two customers:
> - Arvind Mehta — KA03AB1234 (Bajaj Avenger, Bangalore)
> - Priya Mehta — MH14CD5678 (Bajaj Pulsar, Mumbai)
>
> Banner shows only "9730111222." Jethalal answers. Search returns both Arvind and Priya.
> Jethalal asks: "May I know your good name?" → Caller: "Priya Mehta."
> Jethalal selects Priya. Context loads correctly.
> Identification Outcome: **Multiple Matches Resolved by Agent**.

---

### Scenario 4 — Caller Has Multiple Vehicles

**Situation:** A customer is identified correctly, but they have more than one vehicle registered in their name. The system cannot guess which vehicle the call is about.

**What happens:**
1. Agent selects the customer from search results.
2. Instead of immediately showing the context cards, a **vehicle selection list** appears showing all their vehicles.
3. Agent asks the caller: "Which vehicle are you calling about?"
4. Agent selects the correct vehicle.
5. Context cards load with the selected vehicle details.

> **Example:**
> Devendra Patel calls about his Bajaj Pulsar that had a breakdown.
> When Jethalal selects Devendra from search results, a vehicle selection list appears:
> - MH01AA1111 — Bajaj Pulsar 150
> - MH01AA2222 — Bajaj CT100
>
> Jethalal asks: "Which vehicle are you calling about?" → Devendra: "The Pulsar 150."
> Jethalal selects the Pulsar. Context cards load with the Pulsar's service history and dealer details.

---

### Scenario 5 — Caller Is in the System But Has No Vehicle (Customer Master Only)

**Situation:** The caller is a registered customer but their vehicle is not in the database — either it has not been delivered yet, ownership was transferred, or it was simply never registered in the Install Base.

**What happens:**
1. Agent searches, finds the customer, selects them.
2. Only the **Customer card** appears — Vehicle and Dealer cards are empty.
3. Agent handles the call with customer information only.
4. Identification Outcome: **"Customer Identified, Vehicle Unresolved"**

> **Example:**
> Anil Sharma calls about a vehicle he recently booked but has not yet received for delivery.
> Jethalal searches, finds Anil, clicks Select.
> Only the Customer card loads — address, contact details, email. No vehicle registered yet.
> Anil wants to know the estimated delivery date. Jethalal notes the enquiry.
> - Contact Reason: **Query**
> - Identification Outcome: **Customer Identified, Vehicle Unresolved**
> - Disposition: **Information Captured**
> Closes.

---

### Scenario 6 — Agent Declines the Call

**What the agent does:** Clicks the red **"Decline"** button in the ringing banner.

**What happens:**
- The call is rejected.
- The ringing banner disappears.
- **No Interaction record is created.** It is as if the call never arrived in CCM.
- TeleCMI may try to route the same call to another agent (it attempts up to 2 times per the configuration).

> **Example:**
> Jethalal is in the middle of updating notes when a call comes in unexpectedly. He is not ready to take a call. He clicks Decline.
> TeleCMI tries to route the same call to Sunita (another Ready agent). Sunita answers it.
> Jethalal's CCM screen is unchanged — no record created, workspace unaffected.

---

### Scenario 7 — Caller Hangs Up Before the Agent Answers (Missed Call)

**What happens:**
- The caller disconnects before the 60-second ring timeout.
- The ringing banner disappears from the agent's screen.
- **No Interaction record is created in CCM.**
- TeleCMI sends CCM a background note recording the missed call — caller's number, time, and that it was not answered. This is stored in a background log but is **not visible to the agent or supervisor** in the current system. This is a gap — see Part 3, Problem 9.

> **Example:**
> Mrs. Lakshmi calls in but hangs up after 15 seconds — she could not wait.
> Jethalal's screen shows the ringing banner for 15 seconds, then it disappears.
> Nothing is created in CCM's visible workflow. The background log records Lakshmi's number and the time of the missed call, but there is no task created for calling her back and no supervisor notification. Lakshmi is simply forgotten.

---

### Scenario 8 — The Caller Hangs Up Immediately After the Agent Answers

**Situation:** The agent clicks Answer, the call connects for a few seconds, and the caller immediately disconnects — dropped call, accidental call, or impatient caller.

**What happens:**
1. Agent answered → Interaction is created at status "Identifying."
2. Call drops within seconds of connecting.
3. CCM automatically moves the Interaction to **"Wrap-Up"** status. This is because the call ended while the interaction was still being worked on — the system knows the agent must log something even for a very short call.
4. Agent fills the wrap-up quickly.
5. Suitable dispositions: "Silent Call," "Wrong Number," or "Incomplete Interaction."

> **Example:**
> A call comes in from 9999988888. Jethalal clicks Answer. Immediately the line goes dead. The call lasted 3 seconds.
> CCM automatically shows the wrap-up form.
> Jethalal selects:
> - Contact Reason: **Other**
> - Identification Outcome: **No Verified Match**
> - Disposition: **Silent Call**
> Closes. Total time: about 30 seconds.

---

### Scenario 9 — Agent Selects the Wrong Customer, Then Corrects

**Situation:** The agent selects a customer from search results but mid-conversation realises they picked the wrong person.

**What happens:**
1. Context cards load with the wrong customer's details.
2. Agent clicks the **Re-select** option (available on the context panel).
3. The current context is cleared.
4. Agent searches again and selects the correct customer.
5. New context cards load.
6. CCM internally records that a re-selection was made (for audit purposes).
7. Call and wrap-up proceed normally.

> **Example:**
> Search for "9860777888" returns two results — Riya Raheja and Ritu Raheja (very similar names). Jethalal selects Riya by mistake.
> While talking, the caller says: "I'm Ritu, not Riya."
> Jethalal clicks Re-select, searches again, picks Ritu. The correct context cards load for Ritu.
> The audit trail notes that a re-selection was made and by whom.

---

### Scenario 10 — Agent Refreshes the Browser During a Call

**Situation:** The call is active and the agent accidentally presses F5 or the browser refreshes.

**What happens:**
- The call audio disconnects immediately — the customer hears silence or gets cut off.
- The page reloads. The agent's session is restored automatically from the saved login cookie.
- The workspace opens. CCM detects that there was an open Interaction that was never closed.
- The Interaction is shown on screen in the state it was at before the reload.
- The agent can complete the wrap-up and close the Interaction, even though the call is gone.
- The customer would need to call back if they need to continue the conversation.

> **Example:**
> Jethalal's browser refreshes accidentally mid-call. Riya hears silence and the call drops.
> CCM reloads. It detects INT-00347 is still open at "Identifying." It shows the Interaction so Jethalal can complete it.
> Jethalal selects:
> - Disposition: **Incomplete Interaction**
> - Remarks: "Browser refresh caused call disconnect. Customer to call back."
> He marks it Incomplete and closes.

---

### Scenario 11 — Agent Has an Existing Open Interaction When a New Call Arrives

**Situation:** An agent already has an open work record (from a previous call they forgot to close, or a manual interaction they started) and a new inbound call comes in.

**What happens:**
- The call rings normally on the agent's screen.
- The agent clicks Answer.
- The call connects. However, **CCM cannot create a new Interaction** because the agent already has one open. Only one open Interaction is allowed per agent at a time.
- The agent is on a live call but CCM will not create a new record for it.
- There is **no visible warning to the agent** about this. — This is a critical gap. See Part 3, Problem 3.

> **Example:**
> Jethalal has INT-00220 still open from yesterday — he closed his browser instead of closing the interaction properly. Today a new call comes in. He answers. Talks to the customer for 15 minutes about a service complaint. Fills in the wrap-up form. Clicks Save.
>
> Nothing saves. CCM silently rejected the creation of a new work record.
> This call has **no CCM record at all.** The 15-minute conversation is lost entirely.

---

### Scenario 12 — "Start New Interaction" (Manual) vs CTI Inbound Call

**Context:** Before the phone integration was introduced, agents handled calls on a regular desk phone and manually logged them in CCM by clicking a button. This is called a **Manual Interaction**. CTI calling automates that same logging step.

| | Manual Interaction | CTI Inbound Call |
|---|---|---|
| **How it starts** | Agent clicks "+ Start Interaction" button | Agent answers a phone call in the browser |
| **Who creates the record** | Agent manually clicks a button | CCM creates it automatically when agent answers |
| **Phone number in record** | Not recorded (no phone link) | Caller's number recorded automatically |
| **Name in banner** | Not applicable | Shown if number matches database |
| **Call controls** | None — no phone integration | Mute, Hold, Hang Up, Timer visible |
| **Everything after** | Search → Confirm → Wrap-Up → Close | Exactly the same steps |

> **Example (Manual):**
> A customer calls Jethalal on his office desk phone (not through CCM). He handles the conversation normally. After the call, he opens CCM, clicks "+ Start Interaction," and manually logs what happened — searches the customer, confirms context, fills wrap-up, closes.
>
> **Example (CTI):**
> The same customer calls the contact centre number. CCM rings Jethalal's browser. He clicks Answer. The Interaction is created automatically. He talks, searches, confirms, wraps up, closes — the same steps, but the manual "click Start" at the beginning is replaced by "click Answer."

**Both types converge at the same workflow from the "Identifying" stage onward.** The only practical difference is how the work record gets created at the very start.

#### What Happens If Both Are Open?

CCM only allows one open Interaction per agent at any time. An agent cannot have:
- A manual interaction open AND answer a CTI call
- Two CTI calls active at the same time

If either is attempted, CCM blocks it (and silently, without a visible warning — see Problem 3).

---

## Part 3 — Critical Review: What Needs to Be Improved

This section is an honest assessment of what is not working well, what is at risk, and what should be fixed. Each problem includes a practical solution.

---

### Problem 1 — The System Already Knows Who Is Calling But Still Makes the Agent Search Again

**Severity: HIGH — Affects every single call from a known customer**

**What is happening:** When a call rings, CCM silently looks up the caller's number and finds the customer. The customer's name appears in the ringing banner — CCM clearly knows who it is. But the moment the agent answers and the Interaction opens, the system forgets that it just identified the caller. The agent is presented with a completely blank search panel and has to type the number again themselves.

It is like a receptionist who recognises a visitor's face at the door, greets them by name, opens the door — and then asks them to fill in a visitor form from scratch as if they have never met.

> **Example:**
> Riya's name is shown in the banner before the agent answers: "Riya Raheja — +91 9860 777 888."
> Agent clicks Answer.
> The Interaction opens. The search panel is completely empty.
> Agent must type "9860777888" again and click Search.
>
> **This adds 20–40 seconds to every call with a known customer.** Multiplied across hundreds of calls per day, this is significant wasted agent time.

**What should be done:**
- When a known caller's number matches exactly one customer, either:
  - Auto-confirm the context and skip the search step entirely (with a small "Change" link for overrides), OR
  - At minimum: pre-fill the search box with the caller's mobile number and show the matched result highlighted, so the agent clicks "Confirm" with one click instead of repeating the full search.
- This single fix would be the highest-value improvement in the whole inbound call flow.

---

### Problem 2 — If Nobody Is Available, Callers Get No Proper Waiting Experience

**Severity: HIGH — Operational and customer satisfaction risk**

**What is happening:** When all agents are on calls or set to Offline, CCM returns an empty list to TeleCMI. The caller gets whatever TeleCMI's default "no agents" behaviour is — which is not configured in CCM. There is no waiting queue, no "you are number 3 in queue," no supervisor view showing how many people are waiting, and no SLA tracking for how long someone waited.

> **Example:**
> It is 9:05 AM. Three agents are still in their morning briefing. A customer calls about a vehicle breakdown. No agents are Ready. The call fails silently. The customer never gets through. Nobody in CCM knows this happened.

**What should be done:**
- Configure TeleCMI to hold callers in a queue with on-hold music and a position announcement.
- Build a supervisor view in CCM showing: "2 callers currently waiting — longest wait: 3 minutes."
- When a caller waits more than a defined threshold (e.g., 5 minutes), send a notification to the supervisor.
- Log missed and abandoned calls in a way supervisors can act on them.

---

### Problem 3 — Open Record Blocks New Call, But the Agent Is Not Warned

**Severity: HIGH — Data integrity risk**

**What is happening:** CCM only allows one open work record per agent at a time. If an agent has a record still open from a previous interaction and a new call comes in and they answer it, CCM tries to create a new record, fails silently, and the call happens with no CCM record at all. The agent sees no error, no warning — nothing.

> **Example:**
> Jethalal had INT-00220 open from two days ago — he closed his browser tab instead of closing the interaction. Today a call comes in. He answers. Talks for 15 minutes about a service complaint. Fills the form. Hits Save. Nothing saves. No error appears.
>
> This call has no CCM record. The conversation is lost entirely.

**What should be done:**
- When the agent answers a call and CCM detects they already have an open record, show a clear **red warning banner immediately:** "You have an open work record from [date/time]. Please close it first — this call will not be recorded until you do."
- Offer a quick action: "View open record" or "Close it and continue."
- As a safety net: automatically close work records that have been idle for more than 24 hours (with a supervisor report of what was auto-closed).

---

### Problem 4 — Agent Status Does Not Change Automatically During or After a Call

**Severity: MEDIUM — Routing and workload risk**

**What is happening:** When an agent is on a call, their CCM status still shows "Ready for Calls." This means TeleCMI's routing could send another call to them the moment they hang up — even while they are in the middle of filling the wrap-up form. There is no automatic cooldown or "after-call work" time.

> **Example:**
> Jethalal just finished a long, complex complaint call and hung up. He has 30 seconds of wrap-up to complete. While he is typing his notes, a new call rings immediately. He is forced to either rush his notes or ignore the new call.
>
> Or worse: he is still ON the first call, but because his status is "Ready for Calls," TeleCMI could route an additional call attempt to him if another agent declines.

**What should be done:**
- When a call is answered: automatically set agent status to "On Call" so no new calls are routed.
- When the call ends: automatically set status to "After-Call Work" for a brief buffer period (e.g., 2 minutes), giving the agent time to finish wrap-up.
- When the work is closed: return status to "Ready for Calls" automatically, or prompt the agent to confirm readiness.
- This is standard call centre practice ("After Call Work time") and is currently missing.

---

### Problem 5 — If Record Creation Fails, the Agent Has No Idea

**Severity: MEDIUM — Hidden failure risk**

**What is happening:** When the agent answers a call, CCM creates the work record automatically in the background. If this creation fails for any reason (server error, network issue, or the concurrent-record issue from Problem 3), the error is only written to a developer log file. No message appears on the agent's screen.

> **Example:**
> The server has a brief issue. Jethalal answers a call. Nothing looks wrong to him — the call works, the search panel is there. He talks to the customer for 10 minutes. Fills out the wrap-up. Clicks Save. Nothing happens. Clicks Save again. Still nothing. He calls IT and finds out the work record was never created.

**What should be done:**
- When record creation fails, show a clear red notification on screen immediately: "Could not create work record for this call. Please note the caller's number (+91 9860 777 888) and contact your supervisor."
- In the specific case where the failure is due to an existing open record, automatically detect it and guide the agent to resolve it.
- Agents should never be left uncertain about whether their work is being saved.

---

### Problem 6 — The Call Reference Number May Be Missing When the Record Is Created

**Severity: MEDIUM — Reporting accuracy risk**

**What is happening:** TeleCMI assigns every call a unique tracking ID. However, due to a timing limitation in TeleCMI's phone software, this ID may not be available the instant the agent answers. The work record gets created without it.

Later, when TeleCMI sends the call summary (duration, recording, etc.), it uses a fallback approach: it looks for a work record created from the same phone number within the last 5 minutes. In the vast majority of cases this works. But there is a scenario where it can fail.

> **Example (works fine):**
> Riya calls at 10:00 AM. Jethalal answers. Work record created without the TeleCMI ID. Call lasts 8 minutes. At 10:08 AM, TeleCMI sends the summary. The system finds the record by Riya's number within the 5-minute fallback window. Links correctly. ✅
>
> **Example (can fail):**
> Riya's call drops and she redials immediately. Her second call comes in 3 minutes after the first. The fallback could accidentally link the second call's summary to the first record — duration, recording, and outcome would be linked to the wrong call. ❌

**What should be done:**
- Narrow the 5-minute fallback window and make it configurable by operations.
- More robustly: capture TeleCMI's call ID from an earlier event that fires before the agent answers, so the record is always created with the correct ID attached.
- Operations should be aware this is a risk for customers who redial quickly.

---

### Problem 7 — Refreshing the Browser Drops the Live Call Permanently

**Severity: MEDIUM — Call quality and customer experience risk**

**What is happening:** The browser-based phone system is not persistent. If the browser refreshes for any reason — network hiccup, accidental key press, browser bug — the call drops immediately. The customer is disconnected mid-conversation.

> **Example:**
> Priya's browser crashes mid-call due to a memory issue. The customer was in the middle of explaining their complaint. They get disconnected and must call back, re-explain the issue from scratch, and face a worse experience.

**What should be done:**
- This is a technical limitation of browser-based calling — there is no way to prevent a browser crash from dropping a call.
- Practical mitigations:
  - When the workspace reloads after a refresh, show a clear warning: "Your previous call may have been interrupted. Call back the customer at +91 9860 777 888" (shown as a clickable button that opens the dialpad).
  - Train agents to avoid refreshing mid-call and to minimise other browser activity during calls.
  - Warn the agent if they attempt to close the tab or navigate away while a call is active.

---

### Problem 8 — Caller's Name Is Shown in the Banner, Then Disappears

**Severity: LOW — Agent usability issue**

**What is happening:** While the call is ringing, the agent sees the caller's name (e.g., "Riya Raheja"). Once they click Answer and the banner disappears, that name is gone. The search panel opens blank. The agent had the information, lost it, and now has to find it again.

> **Example:**
> "Riya Raheja — Answer / Decline" is shown in the ringing banner.
> Agent clicks Answer. Banner disappears.
> Search panel opens empty. Agent cannot remember if it was Riya or Rita. They type the number to search again.

**What should be done:**
- When the Interaction opens, carry the caller's name into the workspace — show a small banner or chip: "Known caller: Riya Raheja — click to pre-fill search."
- Auto-populate the search input with the caller's phone number when the interaction opens.
- This is a low-effort fix with a noticeable day-to-day usability improvement.

---

### Problem 9 — Missed Calls Are Invisible to the Team

**Severity: LOW (but operationally important)**

**What is happening:** When a caller hangs up before being answered, CCM stores a background note of it but nobody sees it. No supervisor is notified. No callback task is created. In an automotive service contact centre, a missed call from a customer with a vehicle breakdown or an urgent complaint is not a trivial event.

> **Example:**
> At 11:45 AM, three calls were missed while all agents were on calls. Supervisors have no idea. No one calls back. The three customers eventually post negative reviews online.

**What should be done:**
- When a call is missed, automatically create a callback task assigned to the queue: "Missed call from +91 9744123456 at 11:45 AM — please call back."
- Show missed calls in a supervisor panel in real time.
- For high-priority numbers (e.g., known complaint accounts or breakdown cases), trigger an immediate alert.

---

### Problem 10 — An Agent Without Phone Setup Gets No Warning

**Severity: LOW — Operational confusion risk**

**What is happening:** When a new agent account is created, CCM tries to set up their phone account in TeleCMI automatically. If this setup fails (TeleCMI unavailable, network issue), the error is written to a server log but the agent sees nothing. They log in, set status to "Ready for Calls," and wait — but no calls ever come to them. They don't know why.

> **Example:**
> Neha is a new agent whose TeleCMI phone account could not be set up due to a TeleCMI API issue on the day she was onboarded. She logs in, sets herself Ready for Calls, and waits the whole morning. No calls come. After two hours she raises a support ticket. IT finds the provisioning failure in the server logs.

**What should be done:**
- When an agent logs in and their phone account is not configured, show a visible yellow warning banner: "Your phone account is not set up. You will not receive inbound calls. Please contact your administrator."
- Admins should have a simple view showing which agents are missing phone configuration.
- When a phone account setup fails, send an alert to the admin team — not just a server log entry.

---

## Summary: All Gaps at a Glance

| # | Problem | How Often It Affects Work | Severity |
|---|---|---|---|
| 1 | Known caller lookup not carried forward — agent re-searches unnecessarily | Every call with a known customer | HIGH |
| 2 | No call queue — waiting callers get no holding experience, supervisors have no visibility | Every period with no free agents | HIGH |
| 3 | Open record blocks new call silently — call goes unrecorded with no warning | Any agent with a forgotten open record | HIGH |
| 4 | Agent status not auto-managed during or after calls — wrap-up disrupted by next call | Every call handled | MEDIUM |
| 5 | Record creation failure is silent — no screen notification to agent | Occasional (server errors, edge cases) | MEDIUM |
| 6 | Call tracking ID missing at creation — summary could link to wrong record for repeat diallers | Callers who redial quickly | MEDIUM |
| 7 | Browser refresh permanently drops the live call | Rare but severe when it happens | MEDIUM |
| 8 | Caller's name disappears when agent answers — search panel opens blank | Every call with a known customer | LOW |
| 9 | Missed calls are invisible — no callback task, no supervisor view | Every missed call | LOW |
| 10 | Agent without phone setup gets no warning at login | New agents and provisioning failures | LOW |

---

*Document based on source code analysis of CCM CTI Wave 2 implementation and Phase 1 Agent Interaction requirements.*
*Key reference files: `apps/web/src/features/cti/useCtiClient.ts`, `apps/api/src/modules/cti/cti.call.service.ts`, `apps/api/src/modules/cti/cti.routing.service.ts`, `apps/api/src/modules/cti/cti.webhook.service.ts`, `input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md`.*

---

---

# Outbound Call Handling in CCM — How It Works

---

## The Big Picture

An outbound call is when the **agent calls the customer** — not the other way around. In CCM this happens as a follow-up activity: agents call customers to provide an update, confirm a service appointment, or follow through on a complaint that was logged earlier.

The agent dials directly from the CCM workspace using a built-in dialpad. The call connects through the browser (no desk phone needed), using the same TeleCMI phone system that handles inbound calls.

**One major difference from inbound calls:** an outbound call does **not** automatically create an Interaction record. It is a standalone call — the phone rings on the customer's mobile, they talk, the call ends. The only automatic record created is a background call log capturing the number dialled, duration, and outcome. Linking the call to a customer or case is the agent's responsibility through other actions (like logging a resolution activity against a case).

---

## Part 4 — Step-by-Step: How an Agent Makes an Outbound Call

---

### Step 1 — Agent Must Be "Ready for Calls"

Before the dialpad can be used, the agent's status must be set to **"Ready for Calls."** If the status is Offline, Break, or Training, the Dial button is greyed out and cannot be clicked.

> **Example:**
> Sunita wants to call back a customer. Her status shows "Break." She changes it to "Ready for Calls" — the Dial button becomes active.

This is the same status requirement as for receiving inbound calls. The agent cannot make an outbound call while inactive.

---

### Step 2 — Agent Opens the Dialpad

In the workspace, there is a **"Make a Call"** option that reveals a simple dialpad — a phone number input box and a "Dial" button.

The Dial button is disabled until the agent types at least 10 digits. The input accepts standard formats: plain 10-digit number (9876543210), number with +91, or with dashes and spaces — the system normalises all of these automatically.

> **Example:**
> Jethalal needs to call back Devendra Patel at 9730111222 regarding his Pulsar breakdown case.
> He opens the dialpad, types "9730 111 222", and the Dial button becomes active.

---

### Step 3 — Agent Clicks Dial

**What the agent does:** Clicks the blue "Dial" button (or presses Enter on the keyboard).

**What the system does:**
1. Validates the number (must be a valid Indian mobile — 10 digits or full format with country code).
2. Sends the request to TeleCMI's phone system: "Place a call from this agent to this number."
3. TeleCMI sends back a confirmation with a tracking reference for this call attempt.
4. The dialpad shows "Dialling…" and locks so the agent cannot accidentally dial twice.
5. The browser-based phone places a call leg to TeleCMI, which then dials out to the customer's mobile on the other side.

> **Example:**
> Jethalal types "9730111222" and clicks Dial. The button shows "Dialling…" The number input is locked. TeleCMI places a call to Devendra's mobile.

**Rate limit:** To prevent accidental repeated dialling or misuse, CCM limits each agent to a maximum of **3 outbound call attempts per 30 seconds.** If this is exceeded, the system shows an error: "Too many outbound call attempts. Please wait before dialling again."

---

### Step 4 — The Customer's Phone Rings

**What happens:**
- The customer's mobile rings as a regular phone call.
- On the agent's screen, the status bar shows that the call is in progress — TeleCMI has accepted it and is connecting.
- There is no separate "ringing" visual change beyond the dialling state that was already shown.
- The agent waits.

> **Example:**
> Devendra's mobile rings. Jethalal waits. On his screen, the dialpad area shows the call is in progress.

---

### Step 5A — Customer Answers

**What happens:**
1. The call connects — both the agent and customer can now hear each other.
2. The dialpad area transitions to show active call controls: **Mute**, **Hold**, **Hang Up**, and a running timer.
3. The agent and customer have their conversation.

> **Example:**
> Devendra answers. Jethalal introduces himself: "Hello, this is Jethalal from Bajaj customer support calling about your Pulsar breakdown." They discuss the case update. Jethalal confirms the dealer will contact Devendra within 24 hours.

**Important difference from inbound:** No Interaction record is created at this point. No search panel opens. No context cards appear. The workspace behind the call controls is unchanged — the agent is simply on a phone call. Any case updates (like noting that the customer was called back) must be logged separately by the agent as a resolution activity against the relevant case.

---

### Step 5B — Customer Does Not Answer

**What happens:**
- The customer's phone rings but they do not pick up within the ring timeout.
- The call attempt ends — TeleCMI disconnects.
- The dialpad resets to idle. The agent can try again.
- The call is recorded in the background log as an unanswered attempt: the number dialled, time, and that it was not answered.

> **Example:**
> Devendra does not answer. After about 30 seconds, the dialling state ends. Jethalal's dialpad becomes available again. He may try once more or note on the case: "Customer not reachable — will retry tomorrow." He logs this manually as a resolution activity.

---

### Step 5C — Customer's Number Is Busy or Invalid

**What happens:**
- TeleCMI immediately returns a failure.
- An error message appears on the dialpad: the reason (busy, invalid number, not reachable).
- The dialpad resets to idle so the agent can correct the number or try later.

> **Example:**
> Jethalal dials a number that has been disconnected. The dialpad shows: "Failed to initiate call. Please try again." He checks the case for the correct number and finds there is an alternate contact. He dials the alternate number instead.

---

### Step 6 — Call Ends

**What happens:**
1. Either the agent clicks **Hang Up** or the customer disconnects.
2. The call controls disappear. The dialpad resets to idle.
3. **No wrap-up form appears.** There is nothing to file. The workspace simply returns to its resting state.

> **Example:**
> The conversation with Devendra is done. Jethalal clicks Hang Up. The timer stops. The call controls disappear. Jethalal is back to the idle workspace.

---

### Step 7 — Background Call Record (Automatic)

After the call ends, TeleCMI sends CCM a call summary in the background:
- The number that was dialled
- Whether it was answered or not
- How long the call lasted
- Any recording filename if applicable

This is stored as a call log record. It is **not visible to the agent** in the current system — it is a background audit record for operations and reporting purposes only.

> **Example:**
> The call log records: Jethalal → 9730111222, answered, duration 4m 12s, 2:35 PM, 4 April 2026.

---

## Part 5 — All Scenarios: What Can Happen on an Outbound Call

---

### Scenario 1 — Normal Call: Customer Answers and Conversation Completes

**Situation:** The most straightforward case — the agent dials, the customer picks up, they talk, and the call ends.

**What happens:** Steps 1–6 above play out normally.

> **Example:**
> Sunita calls Mrs. Lakshmi (9876543210) to confirm that her vehicle service is scheduled for the next morning. Lakshmi answers, confirms the appointment, thanks Sunita. Sunita hangs up. Workspace resets. Sunita then opens the relevant case and logs a resolution activity: "Customer confirmed service appointment for 5 April 2026."

**Key point:** The outcome of the conversation — confirmation, update, customer's response — must be logged manually by the agent against the relevant case. The outbound call itself does not create any case note automatically.

---

### Scenario 2 — Customer Does Not Answer (No Pickup)

**Situation:** The agent dials and the phone rings, but the customer does not pick up.

**What happens:**
- After ringing for some time, TeleCMI ends the call attempt.
- The dialpad resets to idle. No error is shown — this is a normal outcome.
- The background call log records the attempt as unanswered.

> **Example:**
> Jethalal tries to call Devendra at 2:00 PM. No answer. At 4:00 PM he tries again. No answer again.
> He opens the case and adds a note: "Called customer twice — 2:00 PM and 4:00 PM. No response. Will escalate to supervisor if no contact by EOD."
>
> Nothing in CCM reminds Jethalal to make these retry attempts. He must manage this himself or rely on a follow-up task created separately — outbound call retries are not automatically scheduled.

---

### Scenario 3 — Customer's Number Is Wrong or Disconnected

**Situation:** The number stored in the case is incorrect, or the customer's SIM has been deactivated.

**What happens:**
- TeleCMI immediately returns a failure response.
- An error message appears on the dialpad (e.g., "Failed to initiate call").
- The dialpad resets to idle.

> **Example:**
> Priya tries to call a customer from a two-year-old case. The number is no longer in service. The dialpad shows an error. Priya checks the case for an alternate number — there is none. She logs a note: "Contact number unreachable — customer details may be outdated."

---

### Scenario 4 — Agent Tries to Dial While Already on a Call

**Situation:** An agent is already on an active call (inbound or outbound) and tries to dial again.

**What happens:**
- The Dial button is greyed out and cannot be clicked.
- The dialpad input is disabled.
- A tooltip explains: "A call is already in progress."

> **Example:**
> Jethalal is midway through an inbound call from Riya. He sees the dialpad and tries to open it. The Dial button is greyed out. He cannot make an outbound call until the current call ends. This is by design — the phone system only handles one call at a time per agent.

---

### Scenario 5 — Agent Status Is Not "Ready for Calls"

**Situation:** The agent's status is Offline, Break, or Training when they attempt to use the dialpad.

**What happens:**
- The Dial button is greyed out.
- A tooltip explains: "Set your status to Ready for Calls to make a call."
- The agent must change their status first.

> **Example:**
> Sunita is on a Break and remembers she needs to call back a customer. She opens the dialpad. The Dial button is greyed out with the tooltip message. She changes her status to "Ready for Calls," and the button becomes active.

---

### Scenario 6 — Too Many Dial Attempts in Quick Succession

**Situation:** The agent clicks Dial multiple times rapidly (accidentally double-clicking, or retrying very quickly after an error).

**What happens:**
- The first attempt goes through normally.
- If the agent makes more than 3 call attempts within any 30-second window, CCM blocks further attempts and shows: "Too many outbound call attempts. Please wait before dialling again."
- The block lifts automatically after 30 seconds.

> **Example:**
> Jethalal misreads a number and dials three times in quick succession when correcting it. On the fourth attempt within 30 seconds, he sees the rate limit error. He waits a moment, then dials the correct number successfully.

This limit exists to prevent accidental repeated calls to the same number and to avoid running up unnecessary phone charges.

---

### Scenario 7 — Agent Not Set Up for Phone Access

**Situation:** A newly onboarded agent whose phone account was not set up correctly tries to use the dialpad.

**What happens:**
- Clicking Dial shows an error: "Agent is not provisioned in TeleCMI — cannot initiate outbound call."
- The call does not go through.
- No background record is created.

> **Example:**
> New agent Neha joined last week. Her phone account setup failed silently during onboarding. She tries to make an outbound call. The error appears. She reports it to IT. The root cause — her TeleCMI account was never created — is found in the server logs. IT manually triggers reprovisioning.
>
> *This is the same provisioning gap described in Inbound Problem 10 — the agent also gets no visible warning at login that their phone is not set up.*

---

### Scenario 8 — Call Drops Mid-Conversation (Browser or Network Issue)

**Situation:** The browser crashes, the network drops, or the agent accidentally closes the tab while on an outbound call.

**What happens:**
- The call audio disconnects. The customer is cut off.
- When the workspace reloads, the call controls are gone — the call state is reset.
- **No work record was created**, so there is nothing to resume or complete.
- If the agent remembers the customer's number, they can call back from the dialpad.

> **Example:**
> Jethalal is on an outbound call with Devendra when his laptop freezes and requires a restart. When CCM reloads, the call is gone. There is no trace of it in the CCM workspace (though the background call log will eventually record the partial duration once TeleCMI's summary arrives). Jethalal manually notes on the case: "Call dropped at 3:12 PM due to technical issue. Called back at 3:20 PM."

---

## Part 6 — Inbound vs Outbound: Key Differences at a Glance

| | Inbound Call | Outbound Call |
|---|---|---|
| **Who initiates** | Customer calls the contact centre | Agent dials the customer from CCM |
| **How it appears** | Floating ringing banner on screen | Agent types number in dialpad and clicks Dial |
| **Work record created?** | Yes — Interaction created automatically when agent answers | No — only a background call log is created |
| **Customer lookup** | CCM looks up caller's number automatically while ringing | Agent must look up customer separately before or after the call |
| **Context cards shown?** | Yes — after agent searches and selects the customer | No — workspace does not change during the call |
| **Wrap-up form?** | Yes — mandatory before closing | No — nothing to file after the call |
| **Call controls** | Mute, Hold, Hang Up, Timer | Mute, Hold, Hang Up, Timer |
| **Call timer** | Starts when agent answers | Starts when customer answers |
| **What gets recorded** | Full Interaction lifecycle (search, context, wrap-up, closure) | Call log only (number, duration, answered/missed) |
| **Missed call handling** | Background log, no action (gap) | Unanswered — background log, no action |

---

## Part 7 — Critical Review: Outbound Call Gaps

---

### Problem 1 — No Work Record Means the Conversation Lives Nowhere

**Severity: HIGH — Operational and audit risk**

**What is happening:** An outbound call creates only a background call log — number, duration, answered or not. Nothing about what was discussed, what the customer said, or what the outcome was. That information exists only if the agent manually logs it as a note or resolution activity on the relevant case.

If the agent forgets to log it, or runs out of time, the conversation is lost. There is no structured record that this customer was called, what they said, or what the next step is.

> **Example:**
> Jethalal calls Devendra about his breakdown. Devendra says he wants to escalate because the dealer still hasn't contacted him after 5 days. This is critical information. But unless Jethalal manually opens the case and types a note, CCM has no record of what Devendra said on this call.

**What should be done:**
- After an outbound call ends, prompt the agent with a simple post-call note form: "What was the outcome of this call?" with a free-text field and a link to open the related case.
- At minimum: show a reminder banner after hang-up: "Remember to log the outcome of this call against the relevant case."

---

### Problem 2 — No Automatic Call-Back Scheduling for Unanswered Calls

**Severity: MEDIUM — Follow-up risk**

**What is happening:** When the customer does not answer an outbound call, the system resets to idle as if nothing happened. There is no automatic reminder, retry schedule, or escalation trigger. The agent must manually remember to try again and must manually create a follow-up task.

> **Example:**
> Jethalal tries to reach Devendra twice on the same day — no answer both times. He has 20 other cases to handle. By end of day he has forgotten. Devendra never gets a call back. The case sits open.

**What should be done:**
- When an outbound call goes unanswered, prompt the agent: "Customer did not answer. Create a callback reminder?" with a suggested time.
- If an outbound call to a customer is unanswered twice within a day, automatically flag the case for supervisor attention.

---

### Problem 3 — No Link Between the Outbound Call and the Case at the Time of Dialling

**Severity: MEDIUM — Traceability risk**

**What is happening:** The agent clicks Dial and the call goes out. The call log records: who dialled, what number, duration. But there is no automatic link between that call and the specific case or customer it was made for. The agent could be calling from memory or from a Post-it note.

> **Example:**
> Sunita makes 15 outbound calls in a day. The call log shows 15 numbers dialled with durations. If a manager asks "Which of these calls was for case ISR-00347?", the answer cannot be found from the call log alone. Sunita has to remember which case each call was for.

**What should be done:**
- Provide a "Call Customer" button on the case itself, which pre-fills the dialpad with the customer's number and tags the call with the case reference at initiation time.
- This way, the background call log would include the case ID, making every outbound call traceable to its origin.

---

### Problem 4 — Background Call Records Are Not Visible to Agents or Supervisors

**Severity: LOW — Visibility gap**

**What is happening:** The background call log (which records every outbound call made — number, duration, answered/missed) is stored in the database but is not surfaced anywhere in the CCM interface. Agents cannot see a history of calls they made. Supervisors cannot monitor outbound call activity.

> **Example:**
> A supervisor wants to know how many calls Jethalal made today in response to the escalated breakdown cases. There is no screen in CCM to answer this. The data exists, but there is no way to view it without a developer running a database query.

**What should be done:**
- Add an outbound call history view (even a simple list: number, time, duration, answered/unanswered) accessible to agents and supervisors.
- Include this in any future supervisor monitoring or reporting dashboard.

---

### Problem 5 — No Caller ID Shown to the Customer

**Severity: LOW — Customer experience issue**

**What is happening:** When an agent calls a customer from CCM, the number that appears on the customer's phone is determined by TeleCMI's configuration (a DID — a configured outbound caller ID). This is not prominently shown to the agent before dialling, and customers may not recognise the number and decline the call.

> **Example:**
> Jethalal calls Devendra. Devendra sees an unknown number (+91 9000000000 — the company's DID) and does not answer it, thinking it is a spam call. Jethalal logs it as "no answer." In reality, the customer was available — they just didn't recognise the number.

**What should be done:**
- Show the agent the outbound caller ID before they dial: "This call will display as +91 9000000000 to the customer."
- Consider using a recognisable branded number, and train agents to mention the number in any SMS or prior communication so customers know to expect it.

---

## Summary: Outbound Call Gaps at a Glance

| # | Problem | How Often It Affects Work | Severity |
|---|---|---|---|
| 1 | No work record created — conversation outcome lives nowhere unless manually logged | Every outbound call | HIGH |
| 2 | No automatic callback scheduling when customer does not answer | Every unanswered outbound call | MEDIUM |
| 3 | No automatic link between the outbound call and the case it was made for | Every outbound call | MEDIUM |
| 4 | Background call records not visible to agents or supervisors | Always | LOW |
| 5 | Customer does not recognise the outbound caller ID and declines | Frequent in practice | LOW |

---

*Document based on source code analysis of CCM CTI Wave 2 and Phase 6 implementation.*
*Additional key reference files for outbound: `apps/api/src/modules/cti/cti.outbound.service.ts`, `apps/web/src/features/cti/CtiDialpad.tsx`, `apps/api/src/modules/cti/cti.webhook.service.ts`.*
