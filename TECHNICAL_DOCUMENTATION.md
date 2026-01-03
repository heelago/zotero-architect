# Zotero Architect - Technical Documentation

## Overview
Zotero Architect is a client-side React application that integrates with multiple external APIs to manage, verify, and enrich bibliographic metadata in Zotero libraries. The application uses a service-oriented architecture with clear separation between UI, business logic, and external service integrations.

---

## 1. Technology Stack

### Frontend Framework
- **React 19.0.0** - UI library
- **React DOM 19.0.0** - DOM rendering
- **TypeScript 5.6.0** - Type safety

### Build Tools
- **Vite 6.0.0** - Build tool and dev server
- **@vitejs/plugin-react 4.3.0** - React plugin for Vite
- **TypeScript** - Compilation and type checking

### Development Dependencies
- **@types/node 22.0.0** - Node.js type definitions
- **@types/react 19.0.0** - React type definitions
- **@types/react-dom 19.0.0** - React DOM type definitions

### Runtime Environment
- **Browser-based** - No Node.js runtime required
- **ES Modules** - Modern JavaScript module system
- **Fetch API** - HTTP requests (native browser API)

### Styling
- **CSS Custom Properties** - Theming system
- **Google Fonts** - DM Sans (primary), JetBrains Mono (monospace)
- **No CSS Framework** - Custom CSS only

---

## 2. External Services & APIs

### 2.1 Zotero API
**Base URL:** `https://api.zotero.org`  
**Version:** API v3  
**Authentication:** API Key via `Zotero-API-Key` header

#### Endpoints Used:
- **GET** `/{libraryType}s/{libraryId}/items` - Fetch all items (paginated)
- **GET** `/{libraryType}s/{libraryId}/items/{itemKey}` - Fetch single item
- **PATCH** `/{libraryType}s/{libraryId}/items/{itemKey}` - Update item
- **DELETE** `/{libraryType}s/{libraryId}/items/{itemKey}` - Delete item
- **POST** `/{libraryType}s/{libraryId}/items` - Create note

#### Features:
- **Pagination:** 100 items per request, uses `start` parameter
- **Version Control:** Uses `If-Unmodified-Since-Version` header for optimistic locking
- **Library Types:** Supports both `user` and `group` libraries
- **Error Handling:** 403 (invalid key), 404 (not found), 412 (version mismatch)

#### Rate Limiting:
- Zotero API has rate limits (not explicitly handled in code)
- Pagination helps reduce request count

### 2.2 Google Gemini API
**Base URL:** `https://generativelanguage.googleapis.com/v1beta/models`  
**Model:** `gemini-3-flash-preview`  
**Authentication:** API Key via query parameter

#### Endpoint:
- **POST** `/{model}:generateContent?key={apiKey}`

#### Configuration:
- **Temperature:** `0.1` (low for consistent data extraction)
- **Max Output Tokens:** `8192` (reduced truncation)
- **Response MIME Type:** `application/json` (when expecting JSON)
- **System Instructions:** Enforced JSON format for structured responses

#### Use Cases:
1. **Metadata Enrichment** (fallback only - deprecated in favor of APIs)
2. **Organization Suggestions** - Collection and tag recommendations
3. **Tag Standardization** - Finding similar tags and suggesting canonical forms
4. **Author Validation** - Verifying author names against publications
5. **Publication Existence Check** - Verifying publications exist in databases
6. **Data Quality Assessment** - Checking for malformed data

#### Error Handling:
- **JSON Parse Failures:** Returns empty object `{}` instead of throwing
- **API Errors:** Sanitized error messages (API keys removed)
- **Empty Responses:** Handled gracefully

### 2.3 Crossref API
**Base URL:** `https://api.crossref.org`  
**Authentication:** None required (public API)  
**User-Agent:** Required (identifies application)

#### Endpoints Used:
- **GET** `/works/{DOI}` - Direct DOI lookup
- **GET** `/works?query={query}&rows={n}&sort=relevance` - Search by title/author

#### Features:
- **DOI Resolution:** Direct lookup by DOI
- **Title Search:** Supports quoted exact matches and free-text search
- **Query Syntax:** `title:"exact title" author:"lastname" year:YYYY`
- **Pagination:** `rows` parameter (typically 1-3 results)
- **Sorting:** By relevance

#### Data Extracted:
- Title, Authors, Publication Date
- Journal/Publication Title
- Volume, Issue, Pages
- DOI, ISBN, Publisher
- Abstract (HTML stripped)
- URL

#### Error Handling:
- **404 Errors:** Logged, continues to next search strategy
- **Parse Failures:** Returns `null`, logged as warning
- **Network Errors:** Caught, returns `null`

### 2.4 OpenAlex API
**Base URL:** `https://api.openalex.org`  
**Authentication:** None required (public API)

#### Endpoint:
- **GET** `/works?search={query}&per_page={n}&sort=relevance_score:desc`

#### Features:
- **Free-text Search:** Title + optional author
- **Relevance Sorting:** By relevance score
- **Pagination:** `per_page` parameter (typically 1-3 results)

#### Data Extracted:
- Title, Authors (from authorships)
- Publication Date
- Journal/Publication (from primary_location.source)
- Volume, Issue, Pages (from biblio)
- DOI, URL
- Abstract (reconstructed from inverted index)

#### Error Handling:
- **API Errors:** Returns `null`, logged as warning
- **Parse Failures:** Returns `null`
- **Network Errors:** Caught, returns `null`

---

## 3. Service Layer Architecture

### 3.1 Service Organization

```
┌─────────────────────────────────────────┐
│           App.tsx (UI Layer)            │
│  (State Management, Event Handlers)      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼────────┐
│   Services  │  │   Utilities   │
│   Layer     │  │   Layer      │
└──────┬──────┘  └─────┬────────┘
       │                │
┌──────┴────────────────┴──────────────┐
│  External APIs (Zotero, Gemini, etc.)  │
└─────────────────────────────────────────┘
```

### 3.2 Service Files

#### `zoteroService.ts`
**Purpose:** Zotero API integration  
**Exports:**
- `fetchAllItems(config, onProgress)` - Paginated item fetching
- `fetchItem(config, itemKey)` - Single item fetch
- `updateItem(config, item)` - Update item with version control
- `deleteItem(config, itemKey, version)` - Delete item
- `createNote(config, parentItemKey, noteContent)` - Create child note

**Key Features:**
- Automatic pagination (100 items per request)
- Progress callbacks for UI updates
- Version mismatch handling (412 errors)
- Error sanitization (removes API keys from error messages)

#### `geminiService.ts`
**Purpose:** Google Gemini API integration  
**Exports:**
- `callGemini(apiKey, prompt, expectJson)` - Generic Gemini call
- `suggestOrganization(items, apiKey)` - Collection/tag suggestions
- `standardizeTags(items, apiKey)` - Tag clustering and standardization
- `enrichItemMetadata(item, apiKey)` - Metadata enrichment (deprecated, fallback only)

**Key Features:**
- JSON response enforcement via system instructions
- Safe JSON parsing (returns null on failure, no throwing)
- Low temperature (0.1) for consistent results
- Error sanitization

#### `bibliographicService.ts`
**Purpose:** Bibliographic metadata enrichment from verified sources  
**Exports:**
- `enrichItemMetadataFromAPIs(item)` - Multi-strategy API search
- `enrichItemMetadataHybrid(item, geminiApiKey)` - API-first with Gemini fallback

**Key Features:**
- **API-First Strategy:** Prioritizes Crossref and OpenAlex
- **Multiple Search Strategies:** DOI → Title+Author+Year → Title+Year → Title Only
- **Title Matching:** Compares multiple results, selects best match
- **Author Validation:** Never uses Gemini for authors (only verified sources)
- **Comprehensive Logging:** Tracks source of each piece of data
- **Graceful Degradation:** Handles 404s, parse failures, network errors

**Search Flow:**
```
1. Crossref DOI lookup (if DOI exists)
   ↓ (if 404 or fails)
2. Crossref Title + Author + Year
   ↓ (if fails)
3. Crossref Title + Year
   ↓ (if fails)
4. Crossref Title Only
   ↓ (if fails)
5. OpenAlex Title + Author
   ↓ (if fails)
6. OpenAlex Title + Year
   ↓ (if fails)
7. OpenAlex Title Only
   ↓ (if all fail)
8. Gemini Fallback (NO AUTHORS - only other metadata)
```

#### `verificationAgents.ts`
**Purpose:** Multi-agent verification system  
**Exports:**
- `checkPublicationExistence(item, apiKey)` - Agent 1
- `validateAuthors(item, apiKey)` - Agent 2
- `checkDataQuality(item, apiKey)` - Agent 3
- `enrichMetadataComprehensive(item, apiKey)` - Agent 4
- `recoverJSONData(rawResponse, expectedStructure)` - Agent 5 (JSON recovery)
- `runComprehensiveVerification(item, apiKey)` - Orchestrator

**Agent System:**
- **Parallel Execution:** All agents run simultaneously via `Promise.all`
- **Task-Based:** Each agent returns a `VerificationTask` with status and result
- **Error Isolation:** Agent failures don't crash other agents
- **JSON Recovery:** Attempts to extract partial data from truncated responses

#### `citationFormatter.ts`
**Purpose:** Citation style formatting  
**Exports:**
- `formatCitation(item, style)` - Format in APA/MLA/Chicago
- `parseCitationEdits(editedFields, originalItem)` - Parse edited fields back to Zotero format

**Styles Supported:**
- **APA** - American Psychological Association
- **MLA** - Modern Language Association
- **Chicago** - Chicago Manual of Style

**Features:**
- Handles different item types (journalArticle, book, bookChapter, etc.)
- Author formatting (Last, F. for APA/Chicago, Last, First for MLA)
- Multiple author handling (et al. for 7+ authors)
- Field extraction for editing

#### `utils.ts`
**Purpose:** Utility functions for data processing  
**Exports:**
- `findDuplicates(items)` - Detect duplicate items
- `findIssues(items)` - Find data quality issues
- `filterValidFields(itemType, data)` - Filter to valid Zotero fields
- `checkMissingCitationFields(item, enrichedData?)` - Check required/recommended fields

**Duplicate Detection:**
- **DOI Matching:** Strongest signal
- **ISBN Matching:** Secondary signal
- **Title + Creators Matching:** Fallback (normalized)

**Issue Detection:**
- Missing required fields
- Missing recommended fields
- Placeholder authors
- Malformed data

---

## 4. Core Functionalities

### 4.1 Library Management

#### Initial Setup
1. **User Input:** Zotero API Key, Library ID, Library Type (user/group)
2. **Optional:** Gemini API Key (for AI features)
3. **Connection:** Validates credentials and fetches library

#### Data Loading
- **Pagination:** Fetches all items in batches of 100
- **Progress Tracking:** Real-time progress updates via callbacks
- **Error Handling:** Clear error messages for invalid credentials

### 4.2 Duplicate Detection

#### Algorithm:
1. **Normalize Data:**
   - Titles: lowercase, remove punctuation, normalize whitespace
   - Creators: Extract last names, sort, join
   - DOI/ISBN: Normalize format

2. **Grouping:**
   - DOI match (highest priority)
   - ISBN match (secondary)
   - Title + Creators match (fallback)

3. **Deduplication:**
   - Prevents same items appearing in multiple groups
   - Uses sorted item keys as group identifier

#### Merge Functionality:
- **Manual Merge:** User selects master, compares fields
- **AI Merge:** Automatic merge with AI verification
- **Field Selection:** Choose which fields to keep from each duplicate
- **Deletion:** Removes duplicate items after merge

### 4.3 Metadata Verification & Enrichment

#### Verification Process:
1. **Publication Existence Check:**
   - Searches academic databases via Gemini
   - Returns confidence level and verification method

2. **Author Validation:**
   - Detects placeholder names (Last1, First1, etc.)
   - Verifies against publication
   - Provides correct authors if found

3. **Data Quality Check:**
   - Checks for malformed data
   - Identifies inconsistencies
   - Flags missing required fields

4. **Metadata Enrichment:**
   - **Primary:** Crossref/OpenAlex APIs (verified sources)
   - **Fallback:** Gemini (non-author metadata only)
   - **Validation:** Strict checks prevent fake data

#### Enrichment Strategy:
- **DOI First:** If DOI exists, lookup directly
- **Title Search:** Multiple strategies with varying specificity
- **Best Match Selection:** Compares results, selects most similar
- **Author Protection:** Never uses AI-generated authors

### 4.4 Organization Tools

#### AI Categorizer:
- **Input:** List of items
- **Output:** Collection and tag suggestions
- **Process:** Gemini analyzes items, suggests organization
- **Application:** User can apply suggestions individually or in batch

#### Tag Standardizer:
- **Input:** All items with tags
- **Output:** Tag clusters with canonical forms
- **Process:** Gemini identifies similar tags, suggests standard form
- **Application:** Batch merge of similar tags

### 4.5 Citation Formatting

#### Features:
- **Style Toggle:** Switch between APA, MLA, Chicago
- **Live Updates:** Citations update when fields are applied
- **Field Editing:** Edit individual citation fields
- **Copy to Clipboard:** One-click copy
- **Field Application:** Apply edited fields to item

#### Formatting Rules:
- **APA:** Author, A. A. (Year). Title. Journal, Volume(Issue), Pages.
- **MLA:** Author, First Name. "Title." Journal, vol. Volume, no. Issue, Year, pp. Pages.
- **Chicago:** Author, First Name. "Title." Journal Volume, no. Issue (Year): Pages.

### 4.6 Batch Operations

#### Batch Mode:
- **Selection:** Checkbox-based item selection
- **Actions:**
  - Apply all repairs
  - Discard all repairs
  - Batch verification
- **Progress:** Tracks success/failure counts

#### Individual Field Application:
- **Per-Field Apply:** Apply individual fields without saving all
- **Immediate Update:** Saves to Zotero, updates UI, removes from suggestions
- **Citation Refresh:** Citations update automatically

---

## 5. Data Flow & State Management

### 5.1 State Architecture

#### Core State (App.tsx):
```typescript
// Configuration
const [config, setConfig] = useState<Config | null>(null);
const [geminiApiKey, setGeminiApiKey] = useState<string>('');

// Data
const [allItems, setAllItems] = useState<ZoteroItem[]>([]);
const [loading, setLoading] = useState(false);
const [progress, setProgress] = useState({ current: 0, total: 0 });

// UI State
const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());

// Processing State
const [isProcessingAI, setIsProcessingAI] = useState(false);
const [processingItemKey, setProcessingItemKey] = useState<string | null>(null);

// Data State
const [pendingRepairs, setPendingRepairs] = useState<Record<string, EnrichmentResult>>({});
const [metadataSources, setMetadataSources] = useState<Record<string, string>>({});
const [verificationReports, setVerificationReports] = useState<Record<string, VerificationReport>>({});
```

### 5.2 Data Flow Patterns

#### Item Loading Flow:
```
User Input (API Key, Library ID)
  ↓
fetchAllItems(config, onProgress)
  ↓
Zotero API (paginated requests)
  ↓
setAllItems(items)
  ↓
UI Updates (stats, lists)
```

#### Verification Flow:
```
User Clicks "Verify"
  ↓
startVerifyingMetadata(item)
  ↓
runComprehensiveVerification(item, apiKey)
  ↓
[Parallel Agents]
  ├─ checkPublicationExistence
  ├─ validateAuthors
  ├─ checkDataQuality
  └─ enrichMetadataComprehensive
  ↓
Compile VerificationReport
  ↓
setVerificationReports
setPendingRepairs (if enrichment found)
  ↓
UI Updates (expand card, show suggestions)
```

#### Enrichment Flow:
```
enrichMetadataComprehensive
  ↓
enrichItemMetadataHybrid
  ↓
enrichItemMetadataFromAPIs
  ├─ Strategy 1: Crossref DOI
  ├─ Strategy 2: Crossref Title+Author+Year
  ├─ Strategy 3: Crossref Title+Year
  ├─ Strategy 4: Crossref Title Only
  ├─ Strategy 5: OpenAlex Title+Author
  ├─ Strategy 6: OpenAlex Title+Year
  └─ Strategy 7: OpenAlex Title Only
  ↓
[If all fail]
Gemini Fallback (NO AUTHORS)
  ↓
Return EnrichmentResult + Source
  ↓
setPendingRepairs
setMetadataSources
```

#### Apply Field Flow:
```
User Clicks "Apply" on Field
  ↓
applySingleField(itemKey, field, value)
  ↓
safeUpdate(item, { [field]: value })
  ↓
Zotero API PATCH
  ↓
setAllItems (update item)
setPendingRepairs (remove field)
  ↓
UI Updates (current value, citations)
```

### 5.3 State Update Patterns

#### Optimistic Updates:
- Items updated in `allItems` immediately
- Citations refresh from updated `allItems`
- Error handling reverts on failure

#### Batch Updates:
- Multiple items processed in sequence
- Progress tracking per item
- Success/failure aggregation

#### Conditional Updates:
- Verification reports only created on completion
- Pending repairs only set if data found
- Metadata sources tracked per item

---

## 6. API Integration Patterns

### 6.1 Error Handling Strategy

#### Zotero API:
```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 403) throw new Error('Invalid API key');
    if (response.status === 404) throw new Error('Not found');
    if (response.status === 412) throw new Error('VERSION_MISMATCH');
    throw new Error(`API error: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  // Sanitize error messages (remove API keys)
  // Log error
  // Re-throw with user-friendly message
}
```

#### External APIs (Crossref, OpenAlex):
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    // Log but don't throw - continue to next strategy
    console.warn(`API error ${response.status}`);
    return null;
  }
  const data = await response.json();
  // Parse and extract data
  return extractedData;
} catch (error) {
  // Log warning, return null
  // Don't crash - graceful degradation
  return null;
}
```

#### Gemini API:
```typescript
try {
  const result = await callGemini(apiKey, prompt, expectJson);
  if (expectJson && result === null) {
    // JSON parse failed - return empty object
    return {};
  }
  return result;
} catch (error) {
  // Sanitize error (remove API key)
  // Log warning
  // Return empty result or re-throw based on context
}
```

### 6.2 Retry Logic

#### Version Mismatch Handling (Zotero):
```typescript
try {
  return await updateItem(config, item);
} catch (err) {
  if (err.message === "VERSION_MISMATCH") {
    // Fetch latest version
    const latestItem = await fetchItem(config, item.key);
    // Retry with latest version
    const retryItem = { ...latestItem, data: { ...latestItem.data, ...enrichment } };
    return await updateItem(config, retryItem);
  }
  throw err;
}
```

### 6.3 Request Optimization

#### Pagination:
- **Zotero:** 100 items per request (optimal batch size)
- **Crossref:** 1-3 results (only need best match)
- **OpenAlex:** 1-3 results (only need best match)

#### Parallel Requests:
- **Verification Agents:** All run in parallel via `Promise.all`
- **No Sequential Dependencies:** Each agent independent

#### Caching:
- **No Caching:** All requests are fresh (data may change)
- **State-Based:** React state serves as in-memory cache

---

## 7. Data Transformations

### 7.1 Zotero Item Structure

```typescript
interface ZoteroItem {
  key: string;              // Unique identifier
  version: number;          // Optimistic locking version
  library: {
    type: string;           // "user" or "group"
    id: number;             // Library ID
  };
  data: ZoteroItemData;    // Item metadata
  meta: {
    creatorSummary: string; // Pre-computed author string
    parsedDate: string;     // Parsed date
    numChildren: number;    // Child items count
  };
}
```

### 7.2 Enrichment Result Structure

```typescript
interface EnrichmentResult {
  title?: string;
  date?: string;
  DOI?: string;
  ISBN?: string;
  publisher?: string;
  publicationTitle?: string;
  bookTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstractNote?: string;
  url?: string;
  creators?: ZoteroCreator[];  // Only from verified sources
  // ... other fields
}
```

### 7.3 Data Normalization

#### Title Normalization:
- Lowercase
- Remove punctuation
- Normalize whitespace
- Used for duplicate detection

#### Creator Normalization:
- Extract last names
- Sort alphabetically
- Join with commas
- Lowercase for comparison

#### DOI/ISBN Normalization:
- Lowercase
- Remove whitespace and hyphens
- Used for exact matching

### 7.4 Field Filtering

#### Valid Field Filtering:
- **Purpose:** Prevent Zotero API 400 errors
- **Method:** `filterValidFields(itemType, data)`
- **Source:** `VALID_ZOTERO_FIELDS` mapping per item type
- **Result:** Only valid fields sent to API

#### Field Mapping:
- **Item Type Specific:** Different fields valid per type
- **Common Fields:** title, creators, date, abstractNote
- **Type-Specific:** publicationTitle (journal), bookTitle (chapter), etc.

---

## 8. Verification Agents System

### 8.1 Agent Architecture

#### Agent Interface:
```typescript
interface VerificationTask {
  id: string;                    // Unique agent identifier
  name: string;                  // Human-readable name
  description: string;           // What the agent does
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;                  // Agent output
  error?: string;                // Error message if failed
}
```

#### Agent Execution:
- **Parallel:** All agents run simultaneously
- **Independent:** Agent failures don't affect others
- **Isolated:** Each agent has try-catch error handling

### 8.2 Individual Agents

#### Agent 1: Publication Existence Check
- **Purpose:** Verify publication exists in academic databases
- **Method:** Gemini search across multiple databases
- **Output:** exists (boolean), confidence, foundVia, warnings
- **Use Case:** Identify non-existent or incorrect publications

#### Agent 2: Author Validation
- **Purpose:** Validate author names, detect placeholders
- **Method:** 
  - Local check for obvious placeholders
  - Gemini verification against publication
- **Output:** valid, authorsMatch, correctAuthors, confidence
- **Use Case:** Find and correct placeholder authors

#### Agent 3: Data Quality Check
- **Purpose:** Check for malformed data and inconsistencies
- **Method:** Local analysis + Gemini assessment
- **Output:** issues array, warnings, quality rating
- **Use Case:** Identify data quality problems

#### Agent 4: Metadata Enrichment
- **Purpose:** Find missing metadata from verified sources
- **Method:** API-first (Crossref/OpenAlex), Gemini fallback
- **Output:** EnrichmentResult with source tracking
- **Use Case:** Fill in missing fields

#### Agent 5: JSON Recovery
- **Purpose:** Extract partial data from truncated JSON
- **Method:** Pattern matching and partial parsing
- **Output:** Recovered data with warning flag
- **Use Case:** Salvage data from failed Gemini responses

### 8.3 Orchestrator

#### `runComprehensiveVerification`:
1. **Initialize:** Create task array, findings object
2. **Execute:** Run all agents in parallel
3. **Compile:** Aggregate results into VerificationReport
4. **Analyze:** Determine overall status
5. **Recommend:** Generate recommendations
6. **Return:** Complete VerificationReport

#### Report Structure:
```typescript
interface VerificationReport {
  itemKey: string;
  tasks: VerificationTask[];
  overallStatus: 'success' | 'partial' | 'failed' | 'warning';
  findings: {
    publicationExists: boolean;
    authorsValid: boolean;
    dataQuality: 'good' | 'needs_review' | 'poor';
    missingFields: string[];
    warnings: string[];
    errors: string[];
  };
  recommendations: string[];
  manualEdits?: Array<{...}>;
}
```

---

## 9. Error Handling & Resilience

### 9.1 Global Error Handlers

#### Window Error Handler:
```typescript
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  event.preventDefault(); // Prevent crash
});
```

#### Unhandled Rejection Handler:
```typescript
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent crash
});
```

### 9.2 Service-Level Error Handling

#### Zotero Service:
- **403/404 Errors:** User-friendly messages
- **412 Errors:** Version mismatch, automatic retry
- **API Key Sanitization:** Removed from error messages
- **Network Errors:** Caught and re-thrown with context

#### Bibliographic Service:
- **404 Errors:** Logged, continue to next strategy
- **Parse Failures:** Return null, don't crash
- **Network Errors:** Caught, return null
- **No Results:** Return null (not an error)

#### Gemini Service:
- **JSON Parse Failures:** Return empty object, log warning
- **API Errors:** Sanitized (API key removed)
- **Empty Responses:** Handled gracefully
- **Never Throws:** Always returns some value

### 9.3 UI Error Handling

#### User Notifications:
- **Success:** Green notification
- **Error:** Red notification with message
- **Info:** Blue notification
- **Auto-dismiss:** After timeout

#### Error States:
- **Loading States:** Spinners, disabled buttons
- **Empty States:** Helpful messages
- **Error States:** Clear error messages with actions

---

## 10. Security Considerations

### 10.1 API Key Management

#### Current Implementation:
- **Storage:** React state (in-memory only)
- **Transmission:** 
  - Zotero: Header (`Zotero-API-Key`)
  - Gemini: Query parameter (`?key=...`)
- **Sanitization:** API keys removed from error messages
- **Dev Mode:** Hardcoded (⚠️ REMOVE BEFORE PUBLISHING)

#### Security Best Practices:
- **Never Log:** API keys never logged
- **Error Sanitization:** Keys removed from error messages
- **No Persistence:** Keys not stored in localStorage
- **HTTPS Only:** All API calls over HTTPS

### 10.2 Data Privacy

#### User Data:
- **No External Storage:** Data only in browser memory
- **No Analytics:** No tracking or analytics
- **Direct API Calls:** No proxy server (client-side only)

#### Bibliographic Data:
- **Public APIs:** Crossref and OpenAlex are public
- **No Personal Data:** Only bibliographic metadata
- **Zotero Data:** User's own library data

---

## 11. File Structure

```
zotero-gemini-cleanupapp/
├── App.tsx                    # Main application component (~3400 lines)
├── index.tsx                  # Entry point, error handlers
├── types.ts                   # TypeScript type definitions
├── constants.tsx              # Icons, field mappings, constants
├── styles.css                 # All CSS styles
│
├── Services/
│   ├── zoteroService.ts       # Zotero API integration
│   ├── geminiService.ts        # Gemini API integration
│   ├── bibliographicService.ts # Crossref/OpenAlex integration
│   └── verificationAgents.ts   # Multi-agent verification system
│
├── Utilities/
│   ├── utils.ts               # Data processing utilities
│   └── citationFormatter.ts  # Citation formatting logic
│
├── Configuration/
│   ├── package.json           # Dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── vite.config.ts         # Vite build config
│   └── index.html             # HTML entry point
│
└── Build Output/
    └── dist/                  # Production build
```

---

## 12. Build & Deployment

### 12.1 Development

#### Dev Server:
```bash
npm run dev
```
- **Port:** 3000
- **Host:** 0.0.0.0 (accessible from network)
- **Hot Reload:** Enabled via Vite HMR

#### Development Features:
- **Fast Refresh:** React component hot reload
- **Source Maps:** For debugging
- **Type Checking:** TypeScript compilation
- **Error Overlay:** Vite error display

### 12.2 Production Build

#### Build Command:
```bash
npm run build
```

#### Build Output:
- **Location:** `dist/`
- **Format:** ES modules, optimized
- **Assets:** CSS, JS, HTML
- **Source Maps:** Optional (not included by default)

#### Preview:
```bash
npm run preview
```
- **Purpose:** Test production build locally
- **Port:** Vite default (usually 5173)

### 12.3 Deployment

#### Static Hosting:
- **Type:** Static site (no server required)
- **Options:** 
  - Firebase Hosting (firebase.json present)
  - Netlify
  - Vercel
  - GitHub Pages
  - Any static host

#### Requirements:
- **HTTPS:** Required for API calls
- **CORS:** APIs must allow browser origins
- **No Backend:** Fully client-side application

---

## 13. Performance Considerations

### 13.1 Optimization Strategies

#### React Optimizations:
- **useMemo:** Expensive computations memoized
- **useCallback:** Event handlers memoized
- **Conditional Rendering:** Only render visible components
- **State Updates:** Batched where possible

#### Data Loading:
- **Pagination:** 100 items per request (optimal)
- **Progress Updates:** Throttled to prevent UI lag
- **Lazy Loading:** Not implemented (could add for large libraries)

#### API Calls:
- **Parallel Execution:** Agents run simultaneously
- **Early Returns:** Stop searching when result found
- **Error Short-Circuiting:** Fail fast, don't wait for all strategies

### 13.2 Memory Management

#### State Cleanup:
- **Verification Reports:** Deleted after successful save
- **Pending Repairs:** Removed after application
- **Expanded Cards:** Set-based (efficient)

#### Large Libraries:
- **No Virtualization:** All items in memory
- **Potential Issue:** Very large libraries (>10k items) may be slow
- **Future Improvement:** Virtual scrolling

---

## 14. Testing & Debugging

### 14.1 Logging

#### Console Logging:
- **Bibliographic Service:** Comprehensive logging of API calls and results
- **Verification Agents:** Logs agent execution and results
- **Error Logging:** All errors logged with context

#### Debug Endpoints:
- **Memory Monitoring:** POSTs to `http://127.0.0.1:7242/ingest/...`
- **Purpose:** Track memory usage and state sizes
- **Note:** Development/debugging only

### 14.2 Error Tracking

#### Error Patterns:
- **Network Errors:** Caught and logged
- **Parse Errors:** Logged with context
- **API Errors:** Sanitized and logged
- **User Errors:** Displayed in notifications

---

## 15. Known Limitations & Future Improvements

### 15.1 Current Limitations

1. **No Caching:** All API calls are fresh (could cache results)
2. **No Rate Limiting:** No explicit rate limit handling
3. **No Virtual Scrolling:** All items rendered (performance issue for large libraries)
4. **No Offline Support:** Requires internet connection
5. **No Batch API Calls:** Individual requests for each item
6. **Hardcoded Credentials:** Dev mode only (must be removed)

### 15.2 Potential Improvements

1. **Caching Layer:** Cache API responses to reduce calls
2. **Rate Limiting:** Implement rate limit handling
3. **Virtual Scrolling:** For large item lists
4. **Service Worker:** Offline support, caching
5. **Batch Operations:** Batch API calls where possible
6. **Error Recovery:** Automatic retry with exponential backoff
7. **Progress Persistence:** Save progress across sessions
8. **Export Functionality:** Export verification reports

---

## 16. API Rate Limits & Quotas

### 16.1 Zotero API
- **Rate Limit:** Not explicitly documented
- **Best Practice:** Pagination reduces request count
- **Version Control:** Prevents unnecessary updates

### 16.2 Crossref API
- **Rate Limit:** Polite use policy (no hard limit)
- **User-Agent:** Required (identifies application)
- **Best Practice:** Cache results when possible

### 16.3 OpenAlex API
- **Rate Limit:** No hard limit, polite use
- **Best Practice:** Reasonable request frequency

### 16.4 Gemini API
- **Rate Limit:** Depends on API tier
- **Quota:** Token-based limits
- **Best Practice:** Low temperature reduces token usage

---

## 17. Data Validation & Sanitization

### 17.1 Input Validation

#### User Input:
- **API Keys:** Basic format validation
- **Library ID:** Numeric validation
- **Field Edits:** Type checking via TypeScript

#### API Responses:
- **Type Checking:** TypeScript interfaces
- **Null Checks:** Defensive programming
- **Field Filtering:** Only valid Zotero fields

### 17.2 Data Sanitization

#### Error Messages:
- **API Key Removal:** Regex replacement
- **Sensitive Data:** Never logged
- **User-Friendly:** Clear, actionable messages

#### HTML Content:
- **Abstract Cleaning:** HTML tags stripped
- **No XSS Risk:** No user-generated HTML rendered

---

## 18. Integration Points

### 18.1 Zotero Integration
- **Read:** Fetch items, metadata
- **Write:** Update items, delete items, create notes
- **Sync:** Real-time updates (version control)

### 18.2 External API Integration
- **Read-Only:** Crossref, OpenAlex (public data)
- **No Write:** External APIs are read-only
- **Fallback Chain:** Multiple sources for reliability

### 18.3 AI Integration (Gemini)
- **Read-Write:** Can suggest changes
- **Validation:** User must approve changes
- **Fallback Only:** Not primary source for critical data

---

This technical documentation provides a comprehensive overview of the application's architecture, services, data flow, and implementation details. It should serve as a reference for understanding the full stack and making improvements.



