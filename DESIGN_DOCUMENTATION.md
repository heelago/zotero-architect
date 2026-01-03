# Zotero Architect - Design & Display Logic Documentation

## Overview
Zotero Architect is a React-based web application for managing and cleaning up Zotero bibliographic libraries. It uses a light theme with a clean, functional design focused on data management and metadata verification.

---

## 1. Design System & Color Palette

### Color Variables (CSS Custom Properties)
- **Background Colors:**
  - `--bg-main`: `#fafafa` (main page background)
  - `--bg-secondary`: `#ffffff` (cards, inputs)
  - `--bg-tertiary`: `#f5f5f5` (hover states, sections)
  - `--bg-card`: `#ffffff` (card backgrounds)
  - `--bg-card-hover`: `#f8f8f8` (card hover state)

- **Border Colors:**
  - `--border`: `#e0e0e0` (default borders)
  - `--border-hover`: `#c0c0c0` (hover borders)

- **Text Colors:**
  - `--text`: `#1a1a1a` (primary text)
  - `--text-muted`: `#666666` (secondary text)
  - `--text-dim`: `#999999` (tertiary/placeholder text)

- **Accent Colors:**
  - `--accent`: `#2563eb` (primary blue - buttons, links, active states)
  - `--accent-light`: `#eff6ff` (light blue backgrounds)

- **Semantic Colors:**
  - Success: `--success: #10b981`, `--success-light: #d1fae5`
  - Warning: `--warning: #f59e0b`, `--warning-light: #fef3c7`
  - Info: `--info: #3b82f6`, `--info-light: #dbeafe`
  - Danger: `--danger: #ef4444`, `--danger-light: #fee2e2`

### Design Philosophy
- **Light, clean aesthetic** with minimal shadows
- **High contrast** for readability
- **Color-coded semantic states** (success, warning, error, info)
- **Consistent spacing** using rem units
- **Subtle transitions** (0.2s) for interactive elements

---

## 2. Typography

### Font Stack
- **Primary Font:** `'DM Sans'` (Google Fonts) - weights: 400, 500, 600, 700
- **Monospace Font:** `'JetBrains Mono'` (Google Fonts) - weights: 400, 500
- **Fallback:** `-apple-system, BlinkMacSystemFont, sans-serif`

### Font Sizes & Hierarchy
- **H1 (Setup):** `2rem` (32px), weight 700
- **H2 (Content Headers):** `1.75rem` (28px), weight 700
- **H3 (Section Headers):** `1.1rem` (17.6px), weight 600
- **H4 (Card Titles):** `0.95rem` (15.2px), weight 600
- **Body Text:** `0.9rem` (14.4px) - `0.95rem` (15.2px)
- **Small Text:** `0.85rem` (13.6px)
- **Labels:** `0.75rem` - `0.8rem` (12px - 12.8px), uppercase, letter-spacing
- **Monospace (codes, DOIs):** `0.75rem` - `0.85rem` (12px - 13.6px)

### Text Styling Patterns
- **Uppercase labels:** Used for form labels, badges, section headers
- **Letter spacing:** `0.05em` for uppercase text
- **Line height:** `1.4` - `1.6` for body text
- **Text truncation:** Ellipsis for long titles with `white-space: nowrap`

---

## 3. Layout Structure

### Application Shell
```
┌─────────────────────────────────────┐
│  Sidebar (280px) │  Main Content    │
│  (sticky)        │  (flex: 1)       │
│                  │  (max-width:     │
│                  │   1200px)        │
└─────────────────────────────────────┘
```

### Sidebar (`.sidebar`)
- **Width:** `280px` fixed
- **Position:** Sticky, `height: 100vh`
- **Background:** `--bg-secondary`
- **Border:** Right border `1px solid --border`
- **Padding:** `1.5rem`
- **Scroll:** `overflow-y: auto`

**Components:**
- Logo (40x40px square with accent background)
- Navigation items (`.nav-item`)
- Footer actions

### Main Content (`.main-content`)
- **Flex:** `flex: 1`
- **Padding:** `2rem`
- **Max-width:** `1200px`
- **Background:** `--bg-main`
- **Scroll:** `overflow-y: auto`

---

## 4. Component Patterns

### 4.1 Setup Panel (`.setup-panel`)
**Layout:** Centered, full viewport height
- **Display:** Flex column, centered
- **Background:** `--bg-main`
- **Padding:** `2rem`

**Setup Form (`.setup-form`):**
- **Max-width:** `480px`
- **Background:** `--bg-card`
- **Border:** `1px solid --border`
- **Padding:** `2rem`

**Form Sections:**
- **Spacing:** `margin-bottom: 2rem`
- **Optional sections:** Border-top separator
- **Section headers:** Uppercase, small font, muted color

**Input Groups:**
- **Label:** Small, uppercase, muted
- **Input:** Full width, padding `0.75rem 1rem`
- **Focus state:** Blue border + `box-shadow: 0 0 0 3px --accent-light`
- **Icons:** Absolute positioned left (18px), muted color

**Toggle Group (`.toggle-group`):**
- **Background:** `--bg-tertiary`
- **Padding:** `4px`
- **Active button:** `--accent` background, white text

**Connect Button:**
- **Full width**
- **Padding:** `1rem`
- **Background:** `--accent`
- **Hover:** Darker blue (`#1d4ed8`)

### 4.2 Progress Panel (`.progress-panel`)
**Layout:** Centered, full viewport
- **Progress Icon:** 80x80px, `--accent-light` background
- **Progress Bar:** 300px width, 6px height
- **Fill:** `--accent` color, animated width transition

### 4.3 Notifications (`.notifications`)
**Position:** Fixed, top-right
- **Z-index:** `200`
- **Animation:** Slide in from right
- **Max-width:** `400px`
- **Backdrop filter:** `blur(20px)`
- **Types:** Success (green), Error (red), Info (blue)

### 4.4 Stats Grid (`.stats-grid`)
**Layout:** CSS Grid, responsive
- **Template:** `repeat(auto-fit, minmax(180px, 1fr))`
- **Gap:** `1rem`
- **Stat Cards:**
  - Background: `--bg-card`
  - Border: `1px solid --border`
  - Padding: `1.5rem`
  - Hover: Border color change + background shift
  - **Value:** Large monospace font (`2.5rem`)
  - **Label:** Small, uppercase, muted

### 4.5 Dashboard Sections (`.dashboard-section`)
**Structure:**
- **Header (`.section-header-toggle`):**
  - Full width button
  - Flex layout: icon + content + actions
  - Padding: `1.25rem 1.5rem`
  - Hover: Background change
  - **Icon:** 48x48px, `--accent-light` background
  - **Badge:** Accent color, rounded, small font
  - **Chevron:** Rotates 180deg when expanded

- **Content (`.section-content`):**
  - Padding: `1.5rem`
  - Border-top separator
  - Slide-down animation on expand

### 4.6 Issue Cards (`.issue-card`)
**Structure:**
- **Background:** `--bg-card`
- **Border:** `1px solid --border`
- **Hover:** Border color change
- **States:**
  - `.has-repair`: Warning border + shadow
  - `.expanded`: Info border
  - `.selected`: Accent border + background
  - `.flagged-item`: Left border accent (3px)

**Header (`.issue-header`):**
- **Layout:** Flex, space-between
- **Padding:** `1rem 1.25rem`
- **Clickable:** Expands/collapses card

**Issue Info:**
- **Title:** Truncated with ellipsis
- **Authors:** Inline display, comma-separated
- **Meta Summary:** Flex wrap, small muted text
- **Badges:** Color-coded by severity (high/medium/low)

**Actions:**
- **Verify Button:** Info-colored, icon + text
- **Apply Button:** Success-colored
- **Chevron:** Rotates on expand

**Body (`.issue-body`):**
- **Padding:** `0 1.25rem 1.25rem`
- **Border-top separator**

### 4.7 Repair Form (`.repair-form`)
**Layout:** CSS Grid, 2 columns
- **Template:** `1fr 1fr`
- **Gap:** `1rem`
- **Full-width rows:** `.form-row.full` spans 2 columns

**Form Rows:**
- **Label:** Small, uppercase, muted, letter-spaced
- **Input/Text:** Standard sizing
- **Monospace:** Used for DOIs, ISBNs, dates

**Field with Suggestion (`.field-with-suggestion`):**
- **Grid:** 2 columns (Current | Suggested)
- **Current Value:**
  - Right border separator
  - Padding-right: `1rem`
  - Standard text styling
- **Suggested Value:**
  - Green border on input (`--success`)
  - Label: Green color, "new" indicator
  - **Apply Button:** Inline, small primary button

### 4.8 Citation Formatter Section
**Layout:**
- **Margin-top:** `2rem`
- **Padding-top:** `2rem`
- **Border-top:** Separator

**Style Toggle:**
- **Buttons:** Small secondary buttons
- **Active:** Accent background, white text
- **Layout:** Flex row, gap `0.5rem`

**Citation Card:**
- **Background:** `--bg-secondary`
- **Padding:** `1rem`
- **Border-radius:** `0.5rem`
- **Header:** Flex, space-between
- **Actions:** Copy, Edit buttons (icon buttons)
- **Preview:** Italic text, pre-wrap for formatting

### 4.9 Creators Editor (`.creators-editor`)
**Layout:** Flex column
- **List:** Flex column, gap `0.5rem`
- **Creator Item (`.creator-item.editable`):**
  - **Inputs Grid:** `1fr 1fr 1fr auto auto`
  - **Fields:** Last Name, First Name, Full Name, Type Select, Delete Button
  - **Background:** `--bg-tertiary`
  - **Border:** `1px solid --border`
  - **Padding:** `0.5rem`

**Apply Authors Button:**
- **Position:** Top-right of editor
- **Style:** Small primary button

### 4.10 Duplicate Groups (`.duplicate-group`)
**Layout:** Flex, space-between
- **Left border:** 4px danger color
- **Padding:** `1.25rem`
- **Hover:** Border color change + translateX(4px)
- **Group Badge:** Danger-colored, uppercase
- **Count Display:** Right side, danger background, large monospace number

### 4.11 Modal (`.merge-modal`)
**Layout:**
- **Overlay:** Fixed, full viewport, backdrop blur
- **Modal:** Max-width `1200px`, max-height `90vh`
- **Animation:** Scale + fade in
- **Structure:**
  - **Header:** Sticky, border-bottom, tertiary background
  - **Body:** Scrollable, padding `1.5rem`
  - **Footer:** Actions centered

**Modal Header:**
- **Icon:** 48x48px, colored background
- **Title:** Large, bold
- **Actions:** Close button, secondary actions

**Compare Cards:**
- **Layout:** Horizontal scroll
- **Card Width:** `350px`
- **Flex-shrink:** `0`
- **Padding:** `1.5rem`

**Field Selection Grid:**
- **Layout:** CSS Grid
- **Columns:** `150px + repeat(auto-fit, minmax(180px, 1fr))`
- **Row:** Field label + source columns
- **Source Buttons:**
  - Min-height: `60px`
  - Border: `2px solid --border`
  - Hover: Accent border
  - Selected: Accent background

---

## 5. Button System

### Button Variants

**Primary (`.btn-primary`):**
- **Background:** `--accent`
- **Color:** White
- **Padding:** `0.75rem 1.25rem`
- **Font:** Weight 600, size `0.9rem`
- **Hover:** Darker blue
- **Disabled:** 50% opacity

**Secondary (`.btn-secondary`):**
- **Background:** `--bg-card`
- **Border:** `1px solid --border`
- **Color:** `--text`
- **Hover:** `--bg-tertiary` background

**Icon Buttons:**
- **`.btn-icon`:** 40x40px, border, muted color
- **`.btn-icon-tiny`:** 24x24px, small border
- **`.btn-icon-small`:** 32x32px
- **Hover:** Background + color change

**Semantic Buttons:**
- **`.btn-apply`:** Success colors (green)
- **`.btn-verify`:** Info colors (blue)
- **`.btn-merge`:** Accent light colors
- **`.btn-dismiss`:** Transparent, border

**Size Variants:**
- **`.btn-sm`:** `padding: 0.4rem 0.8rem`, `font-size: 0.8rem`

---

## 6. Form Elements

### Inputs
- **Base:** Full width, padding `0.75rem 1rem`
- **Border:** `1px solid --border`
- **Background:** `--bg-secondary`
- **Focus:** Accent border + `box-shadow: 0 0 0 3px --accent-light`
- **Placeholder:** `--text-dim` color

### Textareas
- **Same as inputs**
- **Resize:** Vertical only (typically)

### Selects
- **Same styling as inputs**
- **Cursor:** Pointer

### Checkboxes
- **Accent color:** Uses `accent-color` CSS property
- **Sizing:** Varies (18px, 24px typically)

### Toggle Groups
- **Background:** `--bg-tertiary`
- **Padding:** `4px`
- **Buttons:** Equal flex, active state with accent

---

## 7. Badges & Tags

### Badges (`.badge`)
- **Background:** Varies by context
- **Padding:** `0.15rem 0.5rem` - `0.25rem 0.6rem`
- **Font:** Small, uppercase, weight 600-700
- **Border-radius:** `4px` - `12px` (varies)

**Context Variants:**
- **Section Badge:** Accent color, rounded
- **Issue Badge:** Severity colors (high/medium/low)
- **Missing Field Badge:** Required (danger) / Recommended (info)
- **Nav Badge:** Accent background, white text

### Tags (`.tag`)
- **Background:** `--info-light`
- **Color:** `--info`
- **Padding:** `0.25rem 0.75rem`
- **Font:** `0.8rem`, weight 500

**Variants:**
- **`.old-tag`:** Danger colors, strikethrough
- **`.canonical-tag`:** Success color, bold

---

## 8. Interactive States

### Hover States
- **Cards:** Border color change + background shift
- **Buttons:** Background color darkens/shifts
- **Links:** Underline
- **Nav Items:** Background + color change

### Active States
- **Buttons:** Pressed state (darker)
- **Nav Items:** Accent background + color
- **Toggle Buttons:** Accent background, white text

### Focus States
- **Inputs:** Accent border + shadow ring
- **Buttons:** Outline (browser default or custom)

### Disabled States
- **Opacity:** `0.5` - `0.6`
- **Cursor:** `not-allowed`
- **No hover effects**

### Loading States
- **Spinner:** Rotating border animation
- **Button:** Spinner replaces icon
- **Processing:** Disabled state + spinner

---

## 9. Animations & Transitions

### Transitions
- **Duration:** `0.2s` (standard)
- **Properties:** `all` or specific (background, border, transform, opacity)
- **Easing:** Default (ease) or `ease` specified

### Keyframe Animations

**Slide In (Notifications):**
- From: `translateX(100%)`, opacity 0
- To: `translateX(0)`, opacity 1

**Fade In (Tab Content):**
- From: Opacity 0, `translateY(10px)`
- To: Opacity 1, `translateY(0)`

**Slide Down (Section Content):**
- From: Opacity 0, `translateY(-10px)`
- To: Opacity 1, `translateY(0)`

**Modal In:**
- From: `scale(0.95)`, opacity 0
- To: `scale(1)`, opacity 1

**Spin (Spinner):**
- Rotate 360deg continuously

---

## 10. Responsive Design

### Breakpoint: `768px` (Mobile)

**Layout Changes:**
- **Sidebar:** Full width, horizontal layout, no sticky
- **Main Content:** Reduced padding (`1rem`)
- **Stats Grid:** 2 columns instead of auto-fit
- **Forms:** Single column (grid-template-columns: 1fr)
- **Field Suggestions:** Stacked (single column)
- **Current Value:** Bottom border instead of right border
- **Modal:** Full viewport padding
- **Duplicate Compare:** Vertical stack
- **Field Selection:** Reduced column widths

**Navigation:**
- **Sidebar Nav:** Horizontal, wrap
- **Nav Items:** Smaller padding, smaller font

---

## 11. State Management UI Patterns

### Expanded/Collapsed States
- **Cards:** `.expanded` class, chevron rotation
- **Sections:** `.expanded` class on header, content visible
- **State:** React `Set<string>` for expanded card keys

### Selected States
- **Batch Mode:** `.selected` class on cards
- **Visual:** Accent border + accent-light background
- **Checkbox:** Visible in batch mode

### Processing States
- **Indicator:** Spinner in button
- **Disabled:** All interactive elements
- **Visual:** Opacity reduction on affected areas

### Flagged Items
- **Visual:** Left border accent (3px)
- **Button:** Warning-colored when flagged
- **State:** React `Set<string>` for flagged keys

### Repair States
- **Has Repair:** Warning border + shadow
- **Pending Repairs:** Stored in React state object
- **Applied:** Removed from pending, updated in allItems

---

## 12. Data Display Patterns

### Lists
- **Layout:** Flex column, gap `0.75rem`
- **Cards:** Consistent padding, border, hover effects

### Empty States (`.empty-state`)
- **Layout:** Centered, large padding
- **Icon:** 48px, muted or semantic color
- **Text:** Heading + description

### Metadata Display
- **Inline:** Comma-separated, muted color
- **Monospace:** DOIs, ISBNs, item keys
- **Truncation:** Ellipsis for long text

### Verification Reports
- **Border-left:** 4px semantic color (success/warning/error/info)
- **Tasks:** Left border accent (3px), status colors
- **Sections:** Border-top separators

---

## 13. Specific UI Sections

### 13.1 Missing Fields Alert
- **Background:** Warning light
- **Border:** 2px warning color
- **Badges:** Required (danger) / Recommended (info)
- **Layout:** Flex wrap for badges

### 13.2 Metadata Filters
- **Background:** Card background
- **Border:** Standard border
- **Border-radius:** `8px`
- **Checkboxes:** Scrollable container (max-height)
- **Results Count:** Border-top separator

### 13.3 Batch Actions Bar
- **Layout:** Flex, space-between
- **Background:** Card background
- **Border:** Standard border
- **Controls:** Checkbox + count + action buttons

### 13.4 Citation Style Toggle
- **Buttons:** Small secondary buttons
- **Active:** Accent background, white text
- **Layout:** Flex row, gap `0.5rem`

---

## 14. Icon System

### Icon Specifications
- **Size:** Typically `20px` (`.icon` class)
- **Variants:** `14px`, `16px`, `18px`, `24px`, `28px`, `36px`
- **Color:** Inherits from parent or `stroke: currentColor`
- **Style:** Stroke-based SVGs (no fill)

### Icon Usage
- **Buttons:** Inline with text, gap `0.4rem` - `0.5rem`
- **Headers:** Absolute positioned or flex aligned
- **Status:** Color-coded by semantic meaning

---

## 15. Spacing System

### Padding Patterns
- **Cards:** `1rem` - `1.5rem`
- **Sections:** `1.25rem` - `1.5rem`
- **Forms:** `2rem` (setup), `1.5rem` (sections)
- **Buttons:** `0.5rem 1rem` (small), `0.75rem 1.25rem` (standard)

### Margin Patterns
- **Sections:** `1.5rem` - `2rem` bottom
- **Headers:** `2rem` bottom
- **Lists:** Gap `0.75rem` between items

### Gap Patterns
- **Flex/Grid:** `0.5rem` - `1.5rem` (varies by context)
- **Form rows:** `0.4rem` vertical
- **Button groups:** `0.5rem` - `1rem`

---

## 16. Accessibility Considerations

### Current Implementation
- **Focus states:** Visible on inputs (border + shadow)
- **Button states:** Disabled states with cursor change
- **Color contrast:** High contrast text colors
- **Semantic HTML:** Proper heading hierarchy, button elements

### Areas for Improvement
- **ARIA labels:** Could be added to icon-only buttons
- **Keyboard navigation:** Modal focus trapping
- **Screen reader:** Announcements for state changes
- **Color-only indicators:** Should have text/icon alternatives

---

## 17. Performance Optimizations

### Current Patterns
- **CSS Variables:** Efficient theming
- **Transitions:** GPU-accelerated properties (transform, opacity)
- **Conditional Rendering:** React state-based show/hide
- **Lazy Loading:** Not currently implemented

### Potential Improvements
- **Virtual scrolling:** For long lists
- **Memoization:** React.memo for card components
- **Code splitting:** Route-based or component-based

---

## 18. Code Organization

### CSS Structure
- **Single file:** `styles.css`
- **Organization:** By component/section
- **Naming:** BEM-like (block-element-modifier)
- **Variables:** CSS custom properties in `:root`

### Component Structure
- **Single file:** `App.tsx` (large, ~3400 lines)
- **State:** React hooks (useState, useCallback, useMemo)
- **Styling:** Class names + inline styles (for dynamic values)
- **Icons:** Centralized in `constants.tsx`

---

## 19. Current Design Strengths

1. **Consistent color system** with semantic meanings
2. **Clear visual hierarchy** through typography and spacing
3. **Responsive design** with mobile considerations
4. **Smooth interactions** with transitions
5. **Accessible focus states** on form elements
6. **Semantic color coding** for status/severity

---

## 20. Areas for Design Improvement

1. **Visual hierarchy:** Could benefit from more distinct heading sizes
2. **Spacing consistency:** Some inconsistencies in padding/margin
3. **Card shadows:** Currently minimal, could add subtle elevation
4. **Border radius:** Inconsistent (some 8px, most square)
5. **Icon consistency:** Various sizes, could standardize
6. **Button variants:** Many semantic buttons, could consolidate
7. **Form layout:** Grid system could be more systematic
8. **Typography scale:** Could use a more defined scale
9. **Color palette:** Could expand with more nuanced shades
10. **Animation timing:** Could use easing functions for more polish

---

## 21. Technical Implementation Notes

### React Patterns
- **State management:** Local component state
- **Props:** TypeScript interfaces
- **Event handlers:** Inline or useCallback
- **Conditional rendering:** Ternary and logical operators

### Styling Approach
- **CSS classes:** Primary method
- **Inline styles:** For dynamic values (widths, colors from state)
- **CSS variables:** For theming and consistency
- **No CSS-in-JS:** Pure CSS file

### Component Composition
- **Functional components:** All components are functions
- **Hooks:** useState, useEffect, useCallback, useMemo
- **No context:** State passed via props
- **No routing:** Single-page application

---

This documentation provides a comprehensive overview of the current design system, component patterns, and implementation details. It should serve as a solid foundation for a design review and subsequent improvements.



