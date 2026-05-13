**Overview**

This interface represents a **Customer Service Representative (CSR) Dashboard**, specifically tailored for automotive support (inferred from "Vehicle details" and "Dealer details"). It is designed to provide agents with a holistic view of the customer, their active call status, vehicle history, and case history, alongside AI-assisted standard operating procedures (SOPs).

**1. Layout Structure**

The application follows a standard complex web app structure, divided into five main sections:

- **Global Header (Top Bar):** Agent profile, active call controls, and system notifications.
- **Primary Navigation (Left Edge):** Global module switching.
- **Contextual Information Panel (Left Column):** Search, Customer, Vehicle, and Dealer details.
- **Main Content Area (Center Column):** Case history table and actions.
- **Assistant Panel (Right Column):** AI suggestions and SOP documents.

**2. Component Breakdown**

**A. Global Header (Top Bar)**

- **Background Color:** #1B1D21.
- **Agent Identity (Left):**App grid icon.
- Agent Name: Jethalal Gada (White text).
- Location: Pune - Maharashtra India (Light Grey, smaller text).

**Active Call Status (Center):**- Caller Number: +91 9860 777 888 with label "Incoming number".
- Timer: 01:32 min (Prominent white text).
- Status Badge: Connected (Green pill background, white text).

**Call Controls & Utilities (Right):**- Icons (White): Mic (Muted/Unmuted toggle), Pause, Keypad/Dialer.
- End Call Button: Prominent outline button with red text (End call) and red hang-up icon.
- System Icons: Notifications (Bell with red dot), Megaphone/Announcements.
- Profile: Agent avatar image.

**B. Primary Navigation (Left Edge)**

- **Width:** Narrow rail.
- **Items:** Stacked icons representing different app modules.
- **Active State:** The second icon (Analytics/Chart) is highlighted with a vertical Brand Orange bar on its left edge.
- **Bottom:** Company logo mark (circular, orange/black stripes).

**C. Contextual Information Panel (Left Column)**

- **Search Component:**Label: "Search" with a collapse/expand arrow.
- Input Field: Dropdown selector (currently Mobile) + text input (Search mobile number).

**Customer Details Card:**- Header: Customer Name (Riya Raheja), Action Link (360 View in orange).
- Fields: Contact (Mobile numbers), Email, Address. Layout uses secondary grey text for labels and primary dark text for values.

**Vehicle Details Card:**- Header: Registration Number (MH12PY0987), Action Link (Vehicle history in orange).
- Fields: Model (Bajaj Avenger), Variant, Chassis no., Engine no., Date of sale, Last service date.

**Dealer Details Card:**- Header: Dealer Name (Amin Automobiles, Baner), Status Badge (Active with green text/border).
- Fields: Code, Dealer Type (Sales / Service), Branch Name, ASC, Contact, Address.

**D. Main Content Area (Center Column)**

- **Header Section:**Title: "Case history" with a circular numeric badge indicating total count (3).
- Primary Action Button: + New case (Solid Brand Orange background, white text).

**Data Table:**- **Headers:** Document Name, Date & Time, Case nature, Case status, Activity status, Actions.
- **Row 1:** ISR - 124529732 | 20 March 2026, 02:25 PM | Complaint | Status: Open (Yellow outline) | Activity: Contacted (Blue outline) | Action: View (Eye icon).
- **Row 2:** ISR - 124529732 | 15 March 2026, 02:25 PM | Enquiry | Status: In Progress (Green outline) | Activity: Resolved (Grey outline) | Action: View (Eye icon).
- **Row 3:** ISR - 124529732 | 12 March 2026, 02:25 PM | Complaint | Status: Resolved (Grey outline) | Activity: Resolved (Grey outline) | Action: View (Eye icon).
- *(Note: The UI currently has a typo, spelling "Resolved" as "Resloved" in the activity status tags. This should be corrected in development).*

**E. Assistant Panel (Right Column)**

- **Header:**Background: Light Purple gradient.
- Title: Sparkle Icon + "AI Suggestions".
- Language Selector: Dropdown (English selected).

**SOP Section:**- Search Bar: Search SOP... with a magnifying glass icon.
- List Items: Document icons paired with titles (Warranty policy guidelines, Customer Special list, Escalation matrix).

**3. Typography & Color Palette (Inferred)**

**Colors**

- **Primary Brand Color:** Orange (#F37021 or similar) - Used for primary buttons, active states, and action links.
- **Backgrounds:** * App Background: Very light grey/off-white.Header Background: Dark Charcoal/Black.
- Cards/Panels: White (#FFFFFF) with subtle drop shadows or light grey borders.

**Semantic / Status Colors (Pill Badges):**- **Success/Active:** Green text/border (e.g., Connected, Active, In Progress).
- **Warning/Open:** Golden Yellow text/border (e.g., Open).
- **Information:** Blue text/border (e.g., Contacted).
- **Neutral/Closed:** Grey text/border (e.g., Resolved).
- **Destructive:** Red text/border (e.g., End call).

**Typography**

- **Font Family:** Modern Sans-Serif (likely Inter, Roboto, or standard system fonts).
- **Hierarchy:****H1/H2 (Headers):** 16px - 18px, Bold (e.g., "Case history", Customer Name).
- **Body Text:** 13px - 14px, Regular (Data table text, input text).
- **Small/Metadata:** 11px - 12px, Regular, Light Grey (Labels like "Model:", "Date & Time").

## Implementation Notes (CCM Phase 1)

The following corrections apply to the implemented Phase 1 design vs. the reference spec above:

| Reference Spec | Implemented Reality |
|---|---|
| Dealer Details shows "ASC" field | **ASC field removed** — not in Phase 1 scope |
| Dealer Details shows "Contact" field | **Contact field removed** — not in Phase 1 scope |
| Vehicle Details shows "Engine no." | **Engine no. not implemented** — only Chassis Number (masked) is shown |
| Vehicle Details shows separate "Model" and "Variant" rows | **Combined as "Model/Variant"** single row |
| Primary Brand Color: `#F37021` | **Correct value: `#EB6A2C`** (from `systemColor.primary`, Product brand) |
| Font: "likely Inter, Roboto" | **Actual font: Noto Sans** (`NotoSans-Regular`, `NotoSans-Medium`, `NotoSans-SemiBold`) |

The Dealer Card currently shows: Code, Type, Branch, City, Address.
The Vehicle Card currently shows: Model/Variant (combined), Chassis Number (masked), Sold On, Last Service, Dealer.
