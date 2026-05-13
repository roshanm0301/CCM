## **1. Interface Overview**
The landing screen utilizes a **Card-Based Modular Layout** to provide a clean, scannable overview for call center agents.

- **Header:** Standard navigation bar with branding and a global notification bell.
- **Primary Action Bar:** A high-visibility top bar for call status and queue management.
- **Navigation:** The home icon (Home Icon as home-05, #EB6A2C)
- **Main Content Area (Left/Center):** Includes performance metrics and a scrollable announcements feed.
- **Sidebar (Right):** Personal agent profile, time tracking visualization, and detailed status logs.

## **2. Component Specifications**

## **2.1 Call Status Bar (Top Header)**

| **Feature** | **Details** |
|---|---|
| **Status Indicator** | Icon (phone-call icon.svg, # CC7A00, ) and text indicating current state (e.g., "Waiting For Incoming Call!"). |
| **Queue Counter** | Real-time display of "Calls are in queue" (Variable: 04). |
| **Status Toggle** | A dropdown menu (Primary color: border - #F4B07D) allowing agents to switch states (e.g., "Ready for calls"). |

## **2.2 Performance Overview**
Displays Key Performance Indicators (KPIs) with independent time-range filtering.

- **Calls Handled Card:** Large integer display (e.g., **123**).
- **Average Handle Time (AHT) Card:** Time format m s (e.g., **4m 33s**).

**Time Filter Dropdown:** Supports "Today", "Week to date", and "Month to date" (indicated with a shadow-depth menu).

## **2.3 Announcements Section**
A centralized hub for operational updates and campaign scripts.

(Announcement Icon as annoucement-02.svg, #6A7682) 

- **Category Tabs:** Segmented filters with record counts: **All (5)**, **Pending (1)**, **Acknowledged (4)**.
- **Status Badges:** "Pending" (warning: `warning[50]` = `#fff7e5` as bg color, `warning[200]` = `#ffdd99` as border color, `warning[600]` = `#cc7a00` as text color) or "Acknowledged" (success: `success[50]` = `#f6ffed` as bg color, `success[200]` = `#b7eb8f` as border color, `success[600]` = `#389e0d` as text color).
- **Action Buttons:** 
**- Review & Acknowledge:** Primary solid button for high-priority/new items. (#EB6A2C as bg color, #EB6A2C as border color, #FFFFFF as text color).
**- Review:** Outline button for historical items. (#FFFFFF as bg color, #F4B07D as border color, #EB6A2C as text color).

## **2.4 Agent Sidebar**
Focuses on individual accountability and time management.

- **Profile Card:** Name (**Ashish Jha**), ID (**ES-1199**), and Assigned Queue (**Inbound Queue**).
- **Time Tracker:** A multi-colored segmented horizontal progress bar representing the proportional distribution of time spent across different states.
- **Status Legend & Logs:****Ready for calls:** 00:45:43 (#52C41A)
- **Break:** 00:01:43 (#F5222D)
- **Training:** 00:50:43 (#3697FF)
- **Offline:** 01:01:45 (#A8B5C2)
- **Knowledge Transfer:** 02:01:46 (#9E320E)

> ⚠️ Note: "Knowledge Transfer" status is not implemented in Phase 1. Implemented statuses are: Ready for Calls, Break, Training, Offline.

## **3. Visual & UX Standards**
- **Typography:** Clean Sans-serif for high legibility (Noto Sans).
- **Color Palette:****Primary:** Orange (#EB6A2C as bg color, #EB6A2C as border color, #FFFFFF as text color) for calls to action and active states.
- **Status Colors:**  Semantic coding “Pending” (warning: `warning[50]` = `#fff7e5` as bg color, `warning[200]` = `#ffdd99` as border color, `warning[600]` = `#cc7a00` as text color) “Acknowledged” (success: `success[50]` = `#f6ffed` as bg color, `success[200]` = `#b7eb8f` as border color, `success[600]` = `#389e0d` as text color).
- **Background:** Neutral light grey (#F4F7FA) for announcements section to reduce eye strain. Overall, bg should be #FFFFFF.

**Interaction:** Dropdowns should show a shadow-depth effect (as seen in the "Month to date" menu) to indicate hierarchy.
## **4. Technical Requirements**
- **Real-time Updates:** The "Calls are in queue" and "Time tracker" require WebSocket integration for sub-second updates.

> ⚠️ Phase 2 dependency: WebSocket integration for real-time call queue and timer requires CTI integration (Phase 2 scope). Phase 1 uses polling or manual status updates.

- **State Management:** Switching the "Update status" dropdown must immediately reflect in the sidebar's time log.
