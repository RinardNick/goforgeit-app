# Design Overhaul Plan: "Sovereign Forge"

## 1. Objective
Unify the `app.goforgeit.com` application with the "Prometheus Group" and "Forge" brand identity. The goal is to create a "Sovereign Forge" aesthetic that blends architectural authority (Serif fonts, dark themes) with high-performance technical tools (Blueprint motifs, reactive animations).

## 2. Design Tokens

### Color Palette
*   **Backgrounds:**
    *   `deepBlue`: `#0A1931` (Main application background)
    *   `charcoal`: `#2C3E50` (Secondary surface, cards)
    *   `midnight`: `#050C16` (Darker contrast for sidebars/terminals)
*   **Accents:**
    *   `electricOrange`: `#FF6B00` (Primary Action, "Ignition" state)
    *   `forgeGreen`: `#00E676` (Success, Online Status)
    *   `vitalisTeal`: `#00BCD4` (Info, Technical Details)
*   **Typography:**
    *   `warmWhite`: `#FDFBF7` (Headings, Primary Text)
    *   `silver`: `#ECF0F1` (Body text, secondary info)
    *   `muted`: `#64748B` (Placeholders, inactive states)

### Typography
*   **Headings (The "Impact" Layer):**
    *   Font: **Playfair Display**
    *   Usage: Page titles, Hero sections, Modal headers.
    *   Style: Light/Regular weights, tighter letter spacing for large text.
*   **Interface (The "Action" Layer):**
    *   Font: **Inter**
    *   Usage: Buttons, Inputs, Data Tables, Visual Builder Nodes.
    *   Style: Clean, legible, variable weights.

## 3. Component Specifications

### A. The "Ignition" Card (Agents & Projects)
This is the signature component reflecting the "Ecosystem" hover effect.
*   **Default State:**
    *   Background: `charcoal` (or dark image overlay).
    *   Opacity: Slightly desaturated/dimmed.
    *   Border: Transparent or very subtle (`border-white/5`).
*   **Hover State ("Ignition"):**
    *   Transform: Slight scale up (`scale-[1.02]`).
    *   Visual: Image/Background saturates and brightens.
    *   **Border Animation:** A 1px border appearing from the center of each side and expanding outwards to the corners.
        *   *Technical Implementation:* Use `::before` (top/bottom) and `::after` (left/right) pseudo-elements with `scale-x-0` / `scale-y-0` transitioning to `scale-100` with `origin-center`.

### B. Navigation & App Shell
*   **Top Navigation:**
    *   Background: `deepBlue` with `bg-opacity-80` and `backdrop-blur-md` (Glassmorphism).
    *   Border: Bottom border `1px solid white/10`.
    *   Logo: Forge logo in `electricOrange`.
*   **Main Background:**
    *   Solid `deepBlue` base.
    *   Optional: A very subtle "noise" texture overlay to reduce banding and add grit.

### C. Buttons & Interactions
*   **Primary Button:**
    *   Background: `electricOrange`.
    *   Text: `white` (Inter, Bold).
    *   Hover: Glow effect (`shadow-[0_0_20px_rgba(255,107,0,0.4)]`).
*   **Secondary Button:**
    *   Background: Transparent.
    *   Border: `1px solid silver` (or `white/20`).
    *   Text: `warmWhite`.
    *   Hover: Background `white/5`.

### D. Visual Builder (ADK Specific)
*   **Canvas:**
    *   Background: `deepBlue`.
    *   Pattern: "Blueprint" grid (dots or fine lines) in `white/5`.
*   **Nodes:**
    *   Shape: Rounded rectangles (`rounded-lg`).
    *   Style: "Technical" look—dark backgrounds, `electricOrange` connection points, Serif headers for Node Titles.

## 4. Implementation Strategy

1.  **Configuration (Tailwind & CSS):**
    *   Update `tailwind.config.ts` with the exact palette and font families.
    *   Define the `origin-center` scale utilities if not present.
    *   Add global CSS variables for the themes.

2.  **Layout Refactor:**
    *   Update `app/layout.tsx` to use the new fonts and background.
    *   Refactor the main `Navigation` component to use the Glassmorphism style.

3.  **Component Creation:**
    *   Create a reusable `Card` component that encapsulates the "Ignition" border animation logic.
    *   Update the `ADKAgentsPage` grid to use these new cards.

4.  **Global Polish:**
    *   Apply `Playfair Display` to all major headings.
    *   Apply `Inter` to all UI text.
    *   Ensure contrast ratios meet accessibility standards.

## 5. Code Preview: "Ignition" Border Utility
```css
/* Example logic for the border animation */
.ignition-border {
  position: relative;
}
.ignition-border::before,
.ignition-border::after {
  content: '';
  position: absolute;
  background-color: #FF6B00; /* Electric Orange */
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
/* Top & Bottom */
.ignition-border::before {
  top: 0; left: 0; right: 0; height: 1px;
  transform: scaleX(0);
  transform-origin: center;
}
.ignition-border:hover::before {
  transform: scaleX(1);
}
/* Left & Right - would require a separate element or nested container for 4-side independent control, 
   or we use 4 spans for Top, Right, Bottom, Left to ensure perfect corner meeting. */
```
