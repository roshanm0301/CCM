## **1. Component Overview**
The **Important Announcements Modal** is a high-interruption UI element (modal) that appears upon login or during critical updates. It enforces a "Blocker" workflow where the user is encouraged to acknowledge information before proceeding to an active status.

- **Overlay Type:** Center-aligned Modal.
- **Backdrop:** Dark semi-transparent overlay (#1B1D21 with approx. 60% opacity) to focus user attention and dim the background dashboard.
- **Purpose:** Compliance, training updates, and campaign awareness.

## **2. Component Specifications**

## **2.1 Modal Header**
- **Icon:** Megaphone/Announcement icon (#6A7682 as border, #F4F7FA as bg) as annoucement-02.svg.
- **Title:** "Important Announcements" (Bold, Sans-serif).
- **Sub-text:** "Please review & acknowledge before going available" — provides clear instructions on the expected action.
- **Close Action:** "X" icon in the top-right corner for dismissal (#6A7682) (if workflow allows) (x-close.svg)

## **2.2 Content Body**
- **Container:** Light cream/beige background (#FFF7F0) to distinguish the message area from the white modal frame.
- **Subject Line:** "New Recall Campaign Launched" (Bold).
- **Body Text:** Two paragraphs of descriptive text.*Note:* The current placeholder uses "Lorem Ipsum" but is intended for script changes, product recall details (e.g., model FZs-2024), and operational instructions.

**Typography:** High-readability sans-serif font with standard line spacing for rapid scanning.
## **2.3 Modal Footer (Actions)**
- **Primary Action:** **Acknowledge** Button.**Color:** Primary Brand Orange (#EB6A2C as bg color, #EB6A2C as border color, #FFFFFF as text color).
- **Style:** Solid fill with rounded corners (approx. 8px).
- **Alignment:** Right-aligned for standard "Next/Proceed" muscle memory.

## **3. Visual & Interaction Design**

| **Property** | **Specification** |
|---|---|
| **Corner Radius** | 12px on the main modal container; 8px on inner content cards. |
| **Padding** | 16px internal padding from all 4 sides. The header and body 12px; and for the content body 12px. |
| **Animation** | Fade-in and slight scale-up (0.95 to 1.0) on trigger. |

## **4. Technical Logic**
- **Persistence:** Once the "Acknowledge" button is clicked, a POST request is sent to the backend to mark the announcement ID as "Acknowledged" for that specific Agent ID.
- **Workflow Blocker:** If an announcement is marked as "Mandatory," the system should disable the "Ready for calls" status in the main dashboard until this modal has been successfully submitted.
- **Responsive Behavior:** On smaller screens, the modal should expand to 90% width, and the content body should become scrollable while keeping the header and footer fixed.
