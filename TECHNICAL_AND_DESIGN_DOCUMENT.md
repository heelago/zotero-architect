# Zotero Architect - Technical and Design Documentation

**Version:** 1.0  
**Last Updated:** 2024  
**Purpose:** Comprehensive documentation of all functionalities, architecture, and UX patterns for improvement planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Architecture](#application-architecture)
3. [Core Features & Functionalities](#core-features--functionalities)
4. [Chat System - Detailed Specification](#chat-system---detailed-specification)
5. [User Interface & Design System](#user-interface--design-system)
6. [Data Flow & State Management](#data-flow--state-management)
7. [API Integrations](#api-integrations)
8. [Technical Implementation Details](#technical-implementation-details)
9. [Known Limitations & Technical Debt](#known-limitations--technical-debt)

---

## Executive Summary

**Zotero Architect** is a React-based single-page application that helps users manage, clean, and enhance their Zotero bibliographic libraries through AI-powered automation and intelligent organization tools. The application integrates with the Zotero Web API, Google Gemini AI, and external bibliographic services (Crossref, OpenAlex) to provide:

- **Library Health Management**: Duplicate detection, metadata completeness checking, and issue identification
- **AI-Powered Enhancement**: Smart tagging, metadata enrichment, and verification
- **Natural Language Interaction**: Conversational chat interface for querying and managing the library
- **Read-Only Mode Support**: Graceful degradation for users without write permissions, with RDF export functionality
- **Citation Formatting**: Multi-style citation generation (APA, MLA, Chicago) with live editing

The application is deployed to Firebase Hosting and designed with a warm, approachable UI emphasizing simplicity and clarity.

---

## Application Architecture

### Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS with CSS Variables for theming
- **State Management**: React Hooks (useState, useMemo, useCallback, useEffect)
- **External APIs**:
  - Zotero Web API v3
  - Google Gemini 3 Flash (AI)
  - Crossref API
  - OpenAlex API

### Project Structure

```
zotero-gemini-cleanupapp/
├── App.tsx                    # Main application component (5294 lines)
├── index.tsx                  # Application entry point
├── types.ts                   # TypeScript type definitions
├── constants.tsx              # Icons and constant mappings
├── styles.css                 # Global styles and design system
├── zoteroService.ts           # Zotero API integration
├── geminiService.ts           # Gemini AI integration
├── bibliographicService.ts    # Crossref/OpenAlex integration
├── verificationAgents.ts      # AI verification agents
├── chatService.ts             # Chat query parsing and execution
├── citationFormatter.ts       # Citation style formatting
└── utils.ts                   # Utility functions (RDF export, duplicates, etc.)
```

### Component Architecture

The application follows a **single-component architecture** with all UI logic in `App.tsx`. Features are organized by tabs and conditional rendering:

- **Setup Panel**: Initial configuration (API keys, library ID)
- **Home Tab**: Dashboard with overview and quick actions
- **Library Tab**: Main library management interface
- **Citations Tab**: Find citing papers functionality
- **Settings Tab**: Configuration and preferences
- **Chat Overlay**: Natural language interaction layer

---

## Core Features & Functionalities

### 1. Setup & Configuration

#### Setup Panel
- **Purpose**: Initial authentication and API key configuration
- **Inputs**:
  - Zotero API Key (required)
  - Library ID (required)
  - Library Type (user/group)
  - Gemini API Key (optional, for AI features)
- **Validation**: Checks API key validity and library access permissions
- **Error Handling**: 
  - Invalid API key → Shows error message
  - Insufficient permissions (403) → Automatically enables read-only mode
  - Library not found (404) → Shows error message
- **Dev Mode**: Supports base64-encoded pre-filled keys for testing

#### Connection Status
- Displays connected library name (Personal/Group)
- "Disconnect" button to reset configuration
- Connection status indicator

---

### 2. Home Tab

#### Connection Card
- Shows current library connection
- Quick disconnect option

#### Library Overview (Collapsible)
- **Stats Display**:
  - Total items count
  - Items needing attention (incomplete metadata)
  - Potential duplicates count
- **Collapsible**: Uses `<details>` HTML element for expand/collapse

#### Quick Actions
- **Action Cards** with icons:
  - "View Library" → Navigate to Library tab
  - "Find Duplicates" → Filter library to duplicates
  - "Incomplete Metadata" → Filter to items with missing fields
  - "Untagged Items" → Filter to items without tags

---

### 3. Library Tab

The Library tab is the **core interface** for managing bibliographic items. It provides comprehensive filtering, searching, sorting, batch operations, and individual item management.

#### Toolbar (Single Row Layout)

**Search Box**:
- Fixed width (180-200px)
- Real-time text search across:
  - Titles
  - Authors
  - Abstracts
  - Tags
- Updates `searchQuery` state immediately

**Filter Controls**:
- **Filter Mode Dropdown**:
  - `all`: Show all items
  - `incomplete`: Items with missing required/recommended fields
  - `duplicates`: Potential duplicate groups
  - `recent`: Recently added items
  - `reviewed`: Items that have been accepted/declined
  - `untagged`: Items without tags
  - `tag`: Filter by specific tag (triggers tag selector)
- **Tag Selector** (when `filterMode === 'tag'`):
  - Dropdown showing all unique tags in library
  - Updates `selectedTag` state
- **Sort Controls**:
  - Sort by: Date Added, Title, Author, Completeness
  - Sort order: Ascending/Descending (toggle button with ↑/↓ icon)
- **Chat Toggle Button**:
  - Opens/closes chat overlay
  - Icon + "Chat" label
  - Positioned on the right side

#### Batch Actions Bar

**Select All Checkbox**:
- Selects/deselects all visible items (disabled for duplicate groups)
- Shows count: "Select all (X items)"

**Batch Actions** (when items selected):
- **Selected Count**: "X selected"
- **Verify Selected**: Batch metadata verification using Gemini
- **Tag Selected**: Batch AI tagging for selected items
- Both actions show loading states

#### Item List View

**Two Rendering Modes**:

1. **Duplicate Groups View** (`filterMode === 'duplicates'`):
   - Renders `DuplicateGroup` cards
   - Each card shows:
     - Count: "X similar items"
     - Title (from first item)
     - Authors (joined with "·")
     - "Review →" action button
   - Clicking opens merge modal

2. **Flat Item List** (all other modes):
   - Renders individual `item-card` components
   - Each card includes:

**Item Card Structure**:

**Header Section** (always visible):
- **Checkbox**: For batch selection
- **Expand/Collapse Button**: Chevron icon
- **Item Info**:
  - Title (h4)
  - Metadata line: Authors, Date, Publication Title
  - Missing fields hint: "Could add: X, Y, Z" (shows up to 3 fields)
  - Tags display:
    - Clickable tag chips (up to 5 visible)
    - "+X more" indicator if more tags exist
    - "No tags" hint if untagged
- **Item Actions**:
  - If reviewed: "Undo Review" button
  - If not reviewed:
    - "Verify" button (triggers AI metadata verification)
    - "Suggest Tags" button (triggers AI tagging)
    - "Accept" / "Decline" buttons (if suggestions exist)

**Expanded Content** (when card is expanded):

1. **Verification Report** (if available):
   - Collapsible summary with verification status
   - Task results (publication existence, metadata accuracy, etc.)
   - Recommendations list

2. **Missing Fields Alert**:
   - Required fields section (badges)
   - Recommended fields section (badges)
   - Hint: "Use the fields below to add missing information, or click 'Verify' to search for it automatically."

3. **Metadata Source Indicator** (if repair data exists):
   - Shows source: "Crossref", "OpenAlex", "Gemini", etc.

4. **Repair Form** (editable metadata fields):
   - **Title**: Current value + suggested value (editable textarea) + "Apply" button
   - **Authors/Creators**: 
     - Editable creator list with:
       - Last Name, First Name, Full Name inputs
       - Creator Type dropdown (Author/Editor/Translator/Contributor)
       - Remove button
     - "Add Creator" button
     - "Apply Authors" button (if changes exist)
   - **Date**: Current + suggested (editable) + "Apply" button
   - **DOI**: Current + suggested (editable) + "Apply" button
   - **Abstract**: Current + suggested (editable textarea) + "Apply" button
   - **Publication Title**: Current + suggested (editable) + "Apply" button
   - **Volume/Issue/Pages**: Current + suggested (editable) + "Apply" button
   - **Tags Editor**:
     - Current tags (editable chips with remove button)
     - "Add Tag" input field
     - "Apply Tags" button

5. **Citation Formatter**:
   - Style selector: APA, MLA, Chicago
   - Live-formatted citation preview
   - Editable citation fields (parsed from citation text)
   - "Apply Citation Edits" button
   - "Copy Citation" button

6. **Action Buttons** (bottom of expanded card):
   - **Accept All**: Applies all pending suggestions
   - **Decline All**: Removes all pending suggestions
   - Both move item to "reviewed" state

#### Filtered Items Logic

The `filteredItems` useMemo hook applies:
1. **Search Query**: Text matching in title, authors, abstract, tags
2. **Filter Mode**: 
   - `incomplete`: Items with missing required/recommended fields
   - `duplicates`: Returns empty (duplicates shown separately)
   - `recent`: Items added in last 30 days
   - `reviewed`: Items in `reviewedItems` Set
   - `untagged`: Items with no tags
   - `tag`: Items with `selectedTag`
3. **Sort**: By selected field and order
4. **Result**: Returns filtered and sorted array

---

### 4. Smart Tagging System

#### Individual Item Tagging

**"Suggest Tags" Button** (on item card):
- Triggers `handleSuggestTags(item)`
- Calls `suggestOrganization([item], geminiApiKey)`
- AI analyzes:
  - Title
  - Abstract
  - Existing tags
  - Item type
- Returns suggested tags with confidence scores
- Updates `tagSuggestions[item.key]` state
- Shows suggestions in expanded card

**Tag Application**:
- User can edit suggested tags
- "Apply Tags" button adds tags to item
- In read-only mode: Stages tags in `pendingExportChanges`

#### Batch Tagging

**"Tag Selected" Button** (batch actions bar):
- Processes all selected items
- Shows loading state: "Tagging..."
- Calls `suggestOrganization(selectedItems, geminiApiKey)`
- Applies tags to all items (or stages for export)

#### Tag Display & Navigation

- Tags shown as clickable chips in item cards
- Clicking a tag:
  - Sets `selectedTag` to that tag
  - Sets `filterMode` to `'tag'`
  - Filters library to show only items with that tag

---

### 5. Metadata Verification & Enrichment

#### Verification Agents

The application uses **multiple AI verification agents** (defined in `verificationAgents.ts`):

1. **Publication Existence Checker**:
   - Verifies if publication exists in academic databases
   - Checks Crossref, PubMed, Google Scholar
   - Returns: exists (bool), confidence, matched title/DOI, warnings

2. **Metadata Accuracy Verifier**:
   - Validates title, authors, date, DOI consistency
   - Checks for common errors (typos, formatting issues)
   - Returns: accuracy score, issues found, corrections

3. **Completeness Analyzer**:
   - Identifies missing required/recommended fields
   - Suggests priority fields to add
   - Returns: missing fields list, recommendations

#### Verification Workflow

**"Verify" Button** (on item card):
1. Sets `processingItemKey` to item key
2. Calls `runComprehensiveVerification(item, geminiApiKey)`
3. Runs all three agents in parallel
4. Updates `verificationReports[item.key]` with results
5. Shows collapsible verification report in expanded card

**Batch Verification**:
- "Verify Selected" processes all selected items
- Shows progress indicator
- Updates verification reports for all items

#### Metadata Enrichment

**Automatic Enrichment** (via "Verify"):
- If missing fields detected, automatically searches:
  - Crossref (by DOI, title+author)
  - OpenAlex (by title, author)
- Fetches missing metadata (DOI, abstract, publication details)
- Updates `pendingRepairs[item.key]` with enrichment results
- Shows source in expanded card

**Manual Enrichment**:
- User can manually edit any field in repair form
- Changes stored in `editableSuggestions[item.key]`
- "Apply" buttons for individual fields
- "Accept All" applies all suggestions at once

---

### 6. Duplicate Detection & Merging

#### Duplicate Detection

**Algorithm** (in `utils.ts`):
- Compares items by:
  - Title similarity (fuzzy matching)
  - Author overlap
  - DOI match
  - Publication title match
- Groups similar items into `DuplicateGroup[]`
- Threshold-based matching (configurable)

**Display**:
- When `filterMode === 'duplicates'`:
  - Shows duplicate group cards
  - Each group shows count and representative item info
  - Clicking opens merge modal

#### Merge Modal

**Two-Step Flow**:

**Step 1: Comparison View**:
- Side-by-side comparison of all items in group
- Shows all fields for each item
- User selects "master" item (radio buttons)
- "Continue to Merge" button

**Step 2: Suggested Merge**:
- Pre-filled merge draft with:
  - Best values from all items (AI-selected)
  - Master item as default source
- **Editable Fields**:
  - All metadata fields are editable
  - User can modify any value
- **Field Selection** (for conflicting fields):
  - Dropdown to choose which item's value to use
  - Updates merge draft accordingly
- **Actions**:
  - "Merge & Delete Duplicates": 
    - Saves merged item to Zotero
    - Deletes duplicate items
    - Closes modal
  - "Cancel": Closes without saving

**Read-Only Mode**:
- Merge draft staged in `pendingExportChanges`
- Export includes merged item and deletion instructions

---

### 7. Citation Formatting

#### Citation Formatter Component

**Location**: Expanded item card, below repair form

**Features**:
- **Style Selector**: Dropdown (APA, MLA, Chicago)
- **Live Preview**: Formatted citation updates as fields change
- **Editable Fields**: 
  - Parses citation text into editable components
  - User can edit individual parts
  - "Apply Citation Edits" updates item metadata
- **Copy to Clipboard**: One-click copy button

#### Formatting Rules

**APA**:
- Format: `Author, A. A. (Year). Title. Journal, Volume(Issue), Pages.`
- Handles missing fields gracefully

**MLA**:
- Format: `Author, First Name. "Title." Journal, vol. Volume, no. Issue, Year, pp. Pages.`

**Chicago**:
- Format: `Author, First Name. "Title." Journal Volume, no. Issue (Year): Pages.`

#### Integration

- Citation updates automatically when:
  - Metadata fields are applied
  - Editable suggestions change
  - Style is changed
- Citation edits can be applied back to item metadata (bidirectional)

---

### 8. Read-Only Mode & RDF Export

#### Read-Only Mode

**Activation**:
- Automatic: When Zotero API returns 403 (insufficient permissions)
- Manual: Toggle in Settings tab

**Behavior**:
- All write operations (`updateItem`, `deleteItem`, `createItem`) are intercepted
- Changes staged in `pendingExportChanges` Map
- Map structure: `Map<itemKey, Partial<ZoteroItemData>>`
- UI shows "Read-Only Mode" indicator
- Pending changes bar appears at top of library tab

#### Pending Export Bar

**Display** (when `pendingExportChanges.size > 0`):
- Shows count: "X pending changes"
- "Review Export" button opens export review modal
- "Clear All" button clears all pending changes

#### Export Review Modal

**Features**:
- **Export Type Toggle**:
  - "Changed Items Only": Only items with pending changes
  - "All Items": Full library export
- **Changes List**:
  - Shows all items with pending changes
  - For each item:
    - Title
    - List of changed fields
    - "View Details" button (shows full diff)
- **Actions**:
  - "Export RDF File": Generates and downloads RDF/XML file
  - "Cancel": Closes modal

#### RDF Export Format

**Implementation** (in `utils.ts`):
- Generates RDF/XML compliant with Zotero's format
- Maps Zotero item types to RDF types
- Includes:
  - Item metadata (all fields)
  - Creators (with roles)
  - Tags
  - Notes
- Handles special characters (XML escaping)
- File naming: `zotero-export-YYYY-MM-DD.rdf`

---

### 9. Settings Tab

#### Zotero Connection Section

- **API Key**: Masked display, "Change" button (resets config)
- **Library ID**: Display only
- **Library Type**: Display only (Personal/Group)

#### Sync Preferences Section

- **Enable Direct Sync Toggle**:
  - When ON: `readOnlyMode = false`
  - Changes saved directly to Zotero
- **Read-Only Mode Toggle**:
  - When ON: `readOnlyMode = true`
  - Changes staged for export

#### AI Verification Settings

- **Gemini API Key**: Input field (optional)
- **Auto-Verification Toggle**: (if implemented)
- **Verification Confidence Threshold**: (if implemented)

#### Help & Information

**HelpBox Components** (collapsible):

1. **"How It Works"**:
   - Explains library connection
   - Describes AI features
   - Mentions read-only mode option

2. **"Data Privacy & Security"**:
   - API keys stored locally (never sent to server)
   - Data processing happens client-side
   - No data stored on server
   - External API usage (Zotero, Gemini, Crossref, OpenAlex)

3. **"Disclaimers"**:
   - AI suggestions are not guaranteed accurate
   - User should review all changes
   - Export recommended before major changes

#### Contact Section

- Contact email link
- Privacy notice

---

### 10. Citations Tab (Find Citing Papers)

#### Purpose

Discover papers that cite items in your library and add them with full metadata.

#### Workflow

**Step 1: Item Selection**:
- Shows list of first 50 bibliographic items
- Each item card shows:
  - Title
  - Author, Date
  - "✓ DOI" indicator if DOI exists
- Clicking item triggers `handleFindCitations(item)`

**Step 2: Finding Citations**:
- Sets `selectedItemForCitations` state
- Shows loading spinner: "Searching for citing papers..."
- Calls `findCitingPapers(item, geminiApiKey)` from `bibliographicService.ts`
- Uses OpenAlex API to find papers citing the selected item

**Step 3: Results Display**:
- **Source Item Card**: Shows selected item with "← Back" button
- **Citing Papers List**:
  - Each paper card shows:
    - Title
    - Source (e.g., "OpenAlex")
    - Authors (full list)
    - Date
    - Publication Title
    - DOI (if available)
    - Abstract (truncated to 200 chars)
  - Actions:
    - "Add to Library": Creates new Zotero item with full metadata
    - "View Source": External link to paper

**Empty State**:
- "No citing papers found"
- Explanation: Paper may not be cited yet, or data unavailable

---

## Chat System - Detailed Specification

### Overview

The Chat System is a **natural language interface** that allows users to query and interact with their Zotero library using conversational language. It is implemented as an **overlay panel** that slides in from the right side of the Library tab, providing contextual access while maintaining visibility of the library view.

### Architecture

#### Components

1. **Chat Overlay** (`chat-overlay`):
   - Fixed position, right side of screen
   - Width: 420px (max 90vw on mobile)
   - Opaque background (`var(--bg-primary)`)
   - Independent scrolling for messages
   - Slide-in animation (0.3s ease-out)

2. **Chat Header** (`chat-overlay-header`):
   - Title: "Chat with Your Library"
   - Close button (X icon)
   - Fixed at top

3. **Chat Messages Container** (`chat-overlay-messages`):
   - Scrollable area (flex: 1)
   - Padding: 1rem
   - Min-height: 0 (for proper flex scrolling)

4. **Chat Input Container** (`chat-overlay-input`):
   - Fixed at bottom
   - Input field + send button
   - Form submission on Enter

#### State Management

```typescript
// Chat state in App.tsx
const [chatMessages, setChatMessages] = useState<Array<{
  role: 'user' | 'assistant';
  content: string;
  action?: string;
  results?: any;
}>>([]);
const [chatInput, setChatInput] = useState('');
const [isProcessingChat, setIsProcessingChat] = useState(false);
const [showChatOverlay, setShowChatOverlay] = useState(false);
```

### User Experience Flow

#### Opening Chat

1. User clicks "Chat" button in Library toolbar
2. Overlay slides in from right
3. If no messages: Shows welcome screen with example queries
4. If messages exist: Shows conversation history

#### Welcome Screen

**Components**:
- Large icon (💬)
- Heading: "How can I help you?"
- Subheading: "Try asking:"
- **Clickable Example Queries** (array):
  - "Show me untagged items"
  - "How many items do I have?"
  - "Find items about machine learning"
  - "Tag all items with 'AI'"
  - "Show items missing DOIs"

**Interaction**:
- Clicking an example query:
  - Immediately triggers `handleChatQuery(example)`
  - Shows in messages as user message
  - Processes query and shows response

#### Message Display

**User Messages**:
- Right-aligned
- Background: `var(--accent)` (muted teal)
- Text: White
- Shows user's exact input

**Assistant Messages**:
- Left-aligned
- Background: `var(--bg-secondary)`
- Text: `var(--text)`
- **Content**:
  - Main message text (conversational response)
  - **Results Section** (if `msg.results` exists):
    - Item count: "Found X items (showing Y)"
    - **Clickable Item List**:
      - Each item shows:
        - Title (clickable link)
        - Authors
        - Year
        - Missing fields (if applicable)
      - Clicking item:
        - Closes chat overlay
        - Navigates to Library tab
        - Filters library to show that item
        - Expands item card
        - Scrolls to item in list

#### Query Processing

**Function**: `handleChatQuery(userMessage: string)`

**Flow**:
1. Validates: `geminiApiKey` exists, not already processing
2. Clears input field
3. Adds user message to `chatMessages`
4. Sets `isProcessingChat = true`
5. Calls `parseChatQuery(userMessage, bibItems, geminiApiKey)`
6. Receives `ChatResponse`:
   ```typescript
   {
     action: ChatAction;
     message: string; // Conversational response
     confidence: 'high' | 'medium' | 'low';
     items?: ChatItem[]; // Up to 10 matching items
     count?: number; // Total count
     summary?: string; // Optional summary
   }
   ```
7. If `response.items` exists:
   - Adds assistant message with items
   - Auto-navigates to Library tab (after 300ms delay)
8. If no items:
   - Executes action via `executeChatAction()`
   - Adds assistant message with result
9. Sets `isProcessingChat = false`

#### Query Parsing (chatService.ts)

**Function**: `parseChatQuery(query: string, items: ZoteroItem[], apiKey: string)`

**Context Building**:
- Extracts library statistics:
  - Total items
  - Items without DOI
  - Untagged items
  - Incomplete items
  - Available tags (top 30)
  - Item types
- Builds sample item data (first 10 items) with:
  - Key, title, authors, year
  - Tags, DOI, abstract, publication
  - Missing fields list

**AI Prompt** (to Gemini):
```
You are a helpful AI assistant for a Zotero library.

Library Context:
- Total items: X
- Items without DOI: X
- Untagged items: X
- Items with incomplete metadata: X
- Available tags: ...
- Item types: ...

User Query: "{query}"

Analyze the query and determine:
1. What information does the user want?
2. What items match their query?
3. What specific details should be shown?

Return JSON with:
- action: { type, params, reasoning }
- message: Conversational response (include count)
- count: Number of matching items
- items: Array of up to 10 items with { key, title, authors, year, missingFields }
- summary: Brief summary (optional)
```

**Fallback Parsing**:
If Gemini fails or returns invalid JSON, uses keyword-based fallback:
- "untagged" / "no tags" → Finds untagged items
- "missing doi" / "no doi" → Finds items without DOI
- "incomplete" / "missing" → Finds items with missing fields
- "duplicate" → Navigates to duplicates filter
- General search → Text matching in title/author/tags

**Item Matching Logic**:
- For "missing DOI": Filters `itemsData.filter(i => !i.doi)`
- For "untagged": Filters `itemsData.filter(i => i.tags.length === 0)`
- For "incomplete": Filters `itemsData.filter(i => i.missingFields.length > 0)`
- For general search: Matches query terms against title, authors, abstract, tags
- Returns up to 10 most relevant items

#### Action Execution (chatService.ts)

**Function**: `executeChatAction(action: ChatAction, items: ZoteroItem[], ...setters)`

**Action Types**:

1. **`navigate`**:
   - Sets `activeTab` to `action.params.view`
   - Sets `filterMode` to `action.params.filter`
   - Returns success message

2. **`filter`**:
   - Sets `filterMode` to `action.params.filter`
   - Sets `searchQuery` to `action.params.query` (if provided)
   - Returns success message

3. **`search`**:
   - Sets `searchQuery` to `action.params.query`
   - Sets `filterMode` to `'all'`
   - Returns success message

4. **`statistics`**:
   - Calculates library statistics:
     - Total items
     - Untagged count
     - Incomplete count
     - Items with tags count
     - Item types distribution
   - Returns statistics object

5. **`tag`**:
   - Finds matching items (by `itemKeys` or query)
   - Returns item keys for tagging
   - (Tagging handled by calling component)

6. **`show`**:
   - Finds matching items (by `itemKeys` or query)
   - Returns item keys for display
   - (Display handled by calling component)

### Supported Query Types

#### Information Queries

**Examples**:
- "How many items do I have?"
- "Show me statistics about my library"
- "What's in my library?"

**Response**:
- Conversational message with statistics
- No items shown (statistics only)

#### Item Discovery Queries

**Examples**:
- "Show me untagged items"
- "Which items are missing DOIs?"
- "Find items about machine learning"
- "Show items with the tag 'AI'"

**Response**:
- Conversational message: "You have X items missing DOIs. Here are the first 10:"
- Clickable item list (up to 10 items)
- Each item clickable to open in library

#### Navigation Queries

**Examples**:
- "Show duplicates"
- "Go to incomplete items"
- "Filter by tag 'research'"

**Response**:
- Executes navigation action
- Updates library view accordingly
- Message confirms action

#### Tagging Queries

**Examples**:
- "Tag all items with 'AI'"
- "Add tag 'research' to items about machine learning"

**Response**:
- Finds matching items
- Returns item keys
- (Tagging executed by calling component)

### Chat UX Patterns

#### Conversational Tone

- Assistant messages use natural, friendly language
- Always includes count when showing items
- Provides context: "You have X items..." instead of just listing

#### Grounded Responses

- Responses are based on actual library data
- Shows real item titles, authors, years
- Indicates missing fields when relevant

#### Progressive Disclosure

- Shows up to 10 items in chat
- Indicates total count: "Found X items (showing 10)"
- Clicking item reveals full details in library view

#### Contextual Actions

- Item titles are clickable
- Clicking navigates to library with appropriate filter
- Maintains context (e.g., filters to "incomplete" if item missing DOI)

#### Error Handling

- If Gemini API fails: Falls back to keyword parsing
- If no items found: Shows friendly message
- If API key missing: Shows hint in input area

### Technical Implementation Details

#### Chat Overlay CSS

```css
.chat-overlay {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 420px;
  max-width: 90vw;
  background: var(--bg-primary); /* Opaque */
  border-left: 1px solid var(--border);
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 100;
  animation: slideInRight 0.3s ease-out;
}

.chat-overlay-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  min-height: 0; /* Crucial for independent scrolling */
}
```

#### Library Scrolling Independence

- `.library-tab` has `overflow-y: auto` and `height: 100%`
- `.main-content` has `overflow: hidden` (prevents main scroll)
- Chat overlay is `position: fixed` (doesn't affect library scroll)
- Library content scrolls independently behind overlay

#### Message Rendering

```typescript
{chatMessages.map((msg, idx) => (
  <div key={idx} className={`chat-message ${msg.role}`}>
    <div className="message-content">
      <div className="message-text">{msg.content}</div>
      {msg.results && (
        <div className="message-results">
          {msg.results.items && (
            <div className="chat-items-list">
              <div className="items-count">
                Found {msg.results.count} items
                {msg.results.count > msg.results.items.length && 
                  ` (showing ${msg.results.items.length})`}
              </div>
              <ul className="items-list">
                {msg.results.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="chat-item">
                    <button
                      className="item-link"
                      onClick={() => {
                        setShowChatOverlay(false);
                        setActiveTab('library');
                        // Filter and expand item
                      }}
                    >
                      <span className="item-title">{item.title}</span>
                      {item.authors && (
                        <span className="item-authors">{item.authors}</span>
                      )}
                      {item.year && (
                        <span className="item-year">({item.year})</span>
                      )}
                      {item.missingFields && item.missingFields.length > 0 && (
                        <span className="item-missing">
                          Missing: {item.missingFields.join(', ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
))}
```

### Known Limitations

1. **Item Limit**: Only shows up to 10 items in chat (by design for UX)
2. **No Conversation History Persistence**: Messages cleared on page refresh
3. **No Multi-Turn Context**: Each query is independent (no "follow-up" questions)
4. **Tagging Queries Not Fully Implemented**: Returns item keys but tagging must be done manually
5. **No Undo**: Chat actions cannot be undone through chat interface
6. **Limited Action Types**: Only supports filter, search, navigate, statistics, show, tag (no update/delete through chat)

---

## User Interface & Design System

### Color Palette

**Primary Colors**:
- `--bg-primary`: Warm off-white (#FAF9F6)
- `--bg-secondary`: Slightly darker off-white (#F5F4F1)
- `--bg-elevated`: Light beige (#F0EFEB)
- `--bg-main`: Main background (#FFFFFF)

**Accent Colors**:
- `--accent`: Muted teal (#5A9A8B)
- `--accent-hover`: Darker teal (#4A8A7B)

**Text Colors**:
- `--text`: Dark gray (#2C2C2C)
- `--text-muted`: Medium gray (#6B6B6B)
- `--text-light`: Light gray (#9B9B9B)

**Status Colors** (muted, no bright warnings):
- `--notice`: Muted amber (#C4A574)
- `--success`: Muted green (#7A9A7B)
- `--border`: Light gray (#E0E0E0)

### Typography

**Font Family**: System fonts (sans-serif stack)

**Font Sizes**:
- Headers: 1.5rem - 2rem
- Body: 1rem (16px)
- Small text: 0.85rem - 0.9rem
- Labels: 0.9rem

**Font Weights**:
- Headers: 600 (semi-bold)
- Body: 400 (normal)
- Labels: 500 (medium)

**Text Transform**: 
- **No uppercase** (except citation style buttons)
- All text in sentence case

### Layout Patterns

#### Top Navigation

- Fixed header with logo, title, tabs
- Tabs: Home, Library, Citations, Settings
- Connection status indicator
- Full-width, sticky

#### Main Content Area

- Max-width: 1400px
- Centered with auto margins
- Padding: 2rem
- Flex layout (column)

#### Card-Based Design

- All items displayed as cards
- Rounded corners (6-8px)
- Subtle shadows
- Hover effects (slight elevation)

#### Collapsible Sections

- Uses `<details>` and `<summary>` HTML elements
- Chevron icons indicate state
- Smooth expand/collapse

### Button System

**Button Classes**:
- `.btn-primary`: Primary actions (muted teal background)
- `.btn-secondary`: Secondary actions (outlined)
- `.btn-text`: Text-only buttons (minimal)
- `.btn-sm`: Small size variant
- `.btn-icon`: Icon-only buttons

**Button States**:
- Default: Normal styling
- Hover: Darker background/lighter border
- Disabled: Reduced opacity, no pointer events
- Loading: Spinner icon

### Form Elements

**Input Fields**:
- Rounded corners (4-6px)
- Subtle border
- Focus: Accent color border
- Placeholder text in muted color

**Select Dropdowns**:
- Consistent with input styling
- Custom arrow icon
- Fixed width for filter controls

**Checkboxes**:
- Custom styled (not native)
- Accent color when checked
- Smooth transitions

### Responsive Design

**Breakpoints** (implicit, not explicitly defined):
- Mobile: < 768px (chat overlay max-width: 90vw)
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Adaptive Elements**:
- Chat overlay: 420px on desktop, 90vw on mobile
- Library toolbar: Wraps on small screens (flex-wrap)
- Item cards: Full width, stack vertically

### Animation & Transitions

**Transitions**:
- Button hover: 0.2s ease
- Card expand: Smooth (CSS transitions)
- Chat overlay slide-in: 0.3s ease-out

**Loading States**:
- Spinner animation (rotating)
- Pulse effect for processing indicators
- Fade-in for inline confirmations

---

## Data Flow & State Management

### State Architecture

#### Core State (App.tsx)

```typescript
// Configuration
const [config, setConfig] = useState<Config | null>(null);
const [geminiApiKey, setGeminiApiKey] = useState<string>('');

// Data
const [allItems, setAllItems] = useState<ZoteroItem[]>([]);
const [loading, setLoading] = useState(false);
const [progress, setProgress] = useState({ current: 0, total: 0 });

// UI State
const [activeTab, setActiveTab] = useState<AppTab>('home');
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

// Library Tab State
const [searchQuery, setSearchQuery] = useState('');
const [filterMode, setFilterMode] = useState<'all' | 'incomplete' | ...>('all');
const [selectedTag, setSelectedTag] = useState<string | null>(null);
const [sortBy, setSortBy] = useState<'dateAdded' | 'title' | ...>('dateAdded');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());

// Processing State
const [isProcessingAI, setIsProcessingAI] = useState(false);
const [processingItemKey, setProcessingItemKey] = useState<string | null>(null);
const [isTagging, setIsTagging] = useState(false);

// Feature-Specific State
const [pendingRepairs, setPendingRepairs] = useState<Record<string, EnrichmentResult>>({});
const [metadataSources, setMetadataSources] = useState<Record<string, string>>({});
const [verificationReports, setVerificationReports] = useState<Record<string, VerificationReport>>({});
const [tagSuggestions, setTagSuggestions] = useState<Record<string, OrganizationSuggestion>>({});
const [editableSuggestions, setEditableSuggestions] = useState<Record<string, Record<string, any>>>({});

// Read-Only Mode
const [readOnlyMode, setReadOnlyMode] = useState(false);
const [pendingExportChanges, setPendingExportChanges] = useState<Map<string, Partial<ZoteroItemData>>>(new Map());

// Chat State
const [chatMessages, setChatMessages] = useState<Array<{...}>>([]);
const [chatInput, setChatInput] = useState('');
const [isProcessingChat, setIsProcessingChat] = useState(false);
const [showChatOverlay, setShowChatOverlay] = useState(false);

// Merge Modal State
const [activeMergeGroup, setActiveMergeGroup] = useState<DuplicateGroup | null>(null);
const [mergeMaster, setMergeMaster] = useState<ZoteroItem | null>(null);
const [mergeDraft, setMergeDraft] = useState<Partial<ZoteroItemData> | null>(null);
```

### Derived State (useMemo)

#### Filtered Items

```typescript
const filteredItems = useMemo(() => {
  let items = allItems;
  
  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    items = items.filter(item => {
      const title = (item.data.title || '').toLowerCase();
      const authors = (item.data.creators || [])
        .map(c => `${c.firstName || ''} ${c.lastName || ''} ${c.name || ''}`.toLowerCase())
        .join(' ');
      const abstract = (item.data.abstractNote || '').toLowerCase();
      const tags = (item.data.tags || []).map(t => t.tag.toLowerCase()).join(' ');
      return title.includes(query) || authors.includes(query) || 
             abstract.includes(query) || tags.includes(query);
    });
  }
  
  // Filter mode
  if (filterMode === 'incomplete') {
    items = items.filter(item => {
      const missing = checkMissingCitationFields(item);
      return missing.required.length > 0 || missing.recommended.length > 0;
    });
  } else if (filterMode === 'duplicates') {
    // Handled separately (duplicatesList)
    return [];
  } else if (filterMode === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    items = items.filter(item => {
      const dateAdded = new Date(item.data.dateAdded);
      return dateAdded >= thirtyDaysAgo;
    });
  } else if (filterMode === 'reviewed') {
    items = items.filter(item => reviewedItems.has(item.key));
  } else if (filterMode === 'untagged') {
    items = items.filter(item => !item.data.tags || item.data.tags.length === 0);
  } else if (filterMode === 'tag' && selectedTag) {
    items = items.filter(item => 
      item.data.tags?.some(t => t.tag === selectedTag)
    );
  }
  
  // Sort
  items.sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortBy === 'dateAdded') {
      aVal = new Date(a.data.dateAdded).getTime();
      bVal = new Date(b.data.dateAdded).getTime();
    } else if (sortBy === 'title') {
      aVal = (a.data.title || '').toLowerCase();
      bVal = (b.data.title || '').toLowerCase();
    } else if (sortBy === 'author') {
      aVal = (a.data.creators?.[0]?.lastName || a.data.creators?.[0]?.name || '').toLowerCase();
      bVal = (b.data.creators?.[0]?.lastName || b.data.creators?.[0]?.name || '').toLowerCase();
    } else if (sortBy === 'completeness') {
      const aMissing = checkMissingCitationFields(a);
      const bMissing = checkMissingCitationFields(b);
      aVal = aMissing.required.length + aMissing.recommended.length;
      bVal = bMissing.required.length + bMissing.recommended.length;
    }
    
    if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });
  
  return items;
}, [allItems, searchQuery, filterMode, selectedTag, sortBy, sortOrder, reviewedItems]);
```

#### Issues List

```typescript
const allIssuesList = useMemo(() => {
  return allItems.map(item => ({
    item,
    issues: findIssues(item)
  }));
}, [allItems]);

const issuesList = useMemo(() => {
  return allIssuesList.filter(({ issues }) => issues.length > 0);
}, [allIssuesList]);
```

#### Duplicates List

```typescript
const duplicatesList = useMemo(() => {
  return findDuplicates(allItems);
}, [allItems]);
```

#### Bibliographic Items

```typescript
const bibItems = useMemo(() => {
  return allItems.filter(item => 
    ['journalArticle', 'book', 'bookSection', 'conferencePaper', 
     'thesis', 'report', 'document'].includes(item.data.itemType)
  );
}, [allItems]);
```

### Data Flow Patterns

#### Loading Items

1. User enters API key and library ID
2. `loadItems()` called
3. `fetchAllItems()` from `zoteroService.ts`
4. Updates `allItems` state
5. Derived state (filteredItems, issuesList, etc.) recalculates
6. UI updates

#### Applying Changes

**Write Mode**:
1. User clicks "Apply" button
2. `applySingleField()` or `applyAllSuggestions()` called
3. `updateItem()` from `zoteroService.ts`
4. Zotero API called
5. On success: Updates `allItems` state
6. Removes from `pendingRepairs`
7. Shows inline confirmation

**Read-Only Mode**:
1. User clicks "Apply" button
2. `applySingleField()` or `applyAllSuggestions()` called
3. Checks `readOnlyMode`
4. Updates `pendingExportChanges` Map
5. Shows pending changes bar
6. No API call

#### Chat Query Flow

1. User types query and submits
2. `handleChatQuery()` called
3. Adds user message to `chatMessages`
4. `parseChatQuery()` called (chatService.ts)
5. Gemini API called with library context
6. Response parsed (with fallback)
7. `executeChatAction()` called (if needed)
8. Assistant message added to `chatMessages`
9. UI updates (items shown, navigation triggered)

---

## API Integrations

### Zotero Web API v3

**Service**: `zoteroService.ts`

**Endpoints Used**:
- `GET /users/{userId}/items` - Fetch all items
- `GET /users/{userId}/items/{itemKey}` - Fetch single item
- `PUT /users/{userId}/items/{itemKey}` - Update item
- `DELETE /users/{userId}/items/{itemKey}` - Delete item
- `POST /users/{userId}/items` - Create item

**Authentication**: API key in header `Zotero-API-Key`

**Error Handling**:
- 403 (Forbidden): Insufficient permissions → Auto-enable read-only mode
- 404 (Not Found): Library/item not found → Show error
- 412 (Precondition Failed): Version mismatch → Retry with latest version
- Network errors: Show user-friendly message

**Rate Limiting**: Not explicitly handled (relies on browser throttling)

### Google Gemini API

**Service**: `geminiService.ts`

**Model**: `gemini-3-flash-preview`

**Endpoints**:
- `POST /v1beta/models/{model}:generateContent`

**Uses**:
- Metadata enrichment suggestions
- Smart tagging
- Verification agents
- Chat query parsing

**Configuration**:
- Temperature: 0.1 (for consistency)
- Max output tokens: 8192
- JSON mode: When `expectJson = true`
- System instructions: For JSON enforcement

**Error Handling**:
- API errors: Sanitized (API keys removed from logs)
- JSON parse failures: Returns empty object, falls back to text parsing

### Crossref API

**Service**: `bibliographicService.ts`

**Endpoints**:
- `GET /works` - Search by DOI, title, author

**Uses**:
- Metadata lookup by DOI
- Metadata enrichment
- Finding citing papers (via OpenAlex, not directly)

**Rate Limiting**: Not explicitly handled

### OpenAlex API

**Service**: `bibliographicService.ts`

**Endpoints**:
- `GET /works` - Search works
- `GET /works/{id}/cited_by` - Find citing papers

**Uses**:
- Metadata lookup
- Finding papers that cite items in library

**Rate Limiting**: Not explicitly handled

---

## Technical Implementation Details

### Type Definitions (types.ts)

**Core Types**:
- `ZoteroItem`: Full Zotero item structure
- `ZoteroItemData`: Item data payload
- `ZoteroCreator`: Creator/author structure
- `Config`: Application configuration
- `EnrichmentResult`: Metadata enrichment results
- `VerificationReport`: AI verification results
- `DuplicateGroup`: Duplicate item groups
- `OrganizationSuggestion`: AI tagging suggestions

### Utility Functions (utils.ts)

**Key Functions**:
- `findDuplicates()`: Duplicate detection algorithm
- `findIssues()`: Issue identification
- `checkMissingCitationFields()`: Missing field detection
- `filterValidFields()`: Field validation
- `generateRDFExport()`: RDF/XML generation
- `generateItemRDF()`: Single item RDF conversion
- `mapZoteroTypeToRDF()`: Type mapping
- `escapeXML()`: XML escaping

### Citation Formatter (citationFormatter.ts)

**Functions**:
- `formatCitation()`: Format item in selected style
- `parseCitationEdits()`: Parse edited citation back to fields

**Styles Supported**:
- APA
- MLA
- Chicago

### Verification Agents (verificationAgents.ts)

**Agents**:
1. `checkPublicationExistence()`: Verifies publication exists
2. `verifyMetadataAccuracy()`: Validates metadata correctness
3. `analyzeCompleteness()`: Identifies missing fields

**Workflow**:
- `runComprehensiveVerification()`: Runs all agents in parallel
- Returns combined `VerificationReport`

### Error Handling Patterns

**API Errors**:
- Try-catch blocks around all API calls
- User-friendly error messages
- Automatic fallbacks (e.g., read-only mode on 403)

**Validation**:
- Input validation before API calls
- Type checking with TypeScript
- Safe JSON parsing (returns null on failure)

**User Feedback**:
- Inline confirmations (replaces toast notifications)
- Loading states for all async operations
- Error messages in context (not global toasts)

---

## Known Limitations & Technical Debt

### Current Limitations

1. **Single Component Architecture**: All logic in `App.tsx` (5294 lines) - difficult to maintain
2. **No Component Extraction**: UI components not separated into reusable components
3. **Limited Error Recovery**: No retry logic for failed API calls
4. **No Offline Support**: Requires internet connection for all operations
5. **No Data Persistence**: State lost on page refresh (except config in localStorage)
6. **Chat Limitations**: 
   - No conversation history persistence
   - No multi-turn context
   - Limited action types
   - Item limit (10) hardcoded
7. **Performance**: No virtualization for large item lists (could be slow with 1000+ items)
8. **No Undo/Redo**: Actions cannot be undone
9. **Limited Batch Operations**: Only verify and tag (no batch update/delete)
10. **No Export Formats**: Only RDF export (no BibTeX, RIS, etc.)

### Technical Debt

1. **Type Safety**: Some `any` types used (especially in disabled code blocks)
2. **Code Duplication**: Similar logic repeated in multiple places
3. **Magic Numbers**: Hardcoded values (e.g., 10 items in chat, 30 days for "recent")
4. **CSS Organization**: Large `styles.css` file (2584 lines) - could be modularized
5. **API Key Handling**: Base64 encoding for dev keys is a workaround, not a solution
6. **No Testing**: No unit tests or integration tests
7. **No Documentation**: Limited inline comments
8. **Accessibility**: Limited ARIA labels and keyboard navigation support
9. **Internationalization**: No i18n support (English only)
10. **Browser Compatibility**: Not tested on all browsers

### Areas for Improvement

1. **Component Architecture**: Extract components (ItemCard, ChatOverlay, MergeModal, etc.)
2. **State Management**: Consider Redux or Zustand for complex state
3. **Performance Optimization**: 
   - Virtual scrolling for item lists
   - Memoization of expensive computations
   - Lazy loading of item details
4. **Chat Enhancements**:
   - Conversation history persistence
   - Multi-turn context
   - More action types (update, delete through chat)
   - Streaming responses
5. **Error Handling**: Comprehensive error recovery and retry logic
6. **Testing**: Unit tests, integration tests, E2E tests
7. **Documentation**: Inline comments, API documentation, user guide
8. **Accessibility**: Full keyboard navigation, screen reader support
9. **Export Formats**: BibTeX, RIS, JSON exports
10. **Offline Support**: Service worker, local caching

---

## Conclusion

This document provides a comprehensive overview of Zotero Architect's functionality, architecture, and implementation. The application is a feature-rich tool for managing Zotero libraries with AI-powered enhancements, natural language interaction, and flexible read-only mode support.

The **Chat System** is a particularly innovative feature that provides a conversational interface for library management, though it has room for improvement in terms of conversation persistence, multi-turn context, and expanded action types.

The codebase is functional but would benefit from refactoring into a more modular component architecture, improved error handling, and comprehensive testing.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team

