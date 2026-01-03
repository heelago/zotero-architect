# Zotero Architect

AI-powered Zotero library cleanup tool with duplicate detection, metadata enrichment, and smart organization.

## Features

- **Dashboard** — Overview of library health with stats on duplicates, missing metadata, and untagged items
- **AI Categorizer** — Analyze untagged items and get smart tag suggestions using Gemini
- **Tag Standardizer** — Find and merge duplicate or similar tags across your library
- **Metadata Doctor** — Fix missing DOIs, abstracts, and other metadata with AI assistance
- **Duplicate Manager** — Detect and merge duplicate entries with a visual comparison tool

## Setup

### Prerequisites
- Node.js 18+
- Zotero API key (get from [zotero.org/settings/keys](https://www.zotero.org/settings/keys))
- Gemini API key (optional, for AI features) — get from [Google AI Studio](https://aistudio.google.com/)

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your credentials.

### Zotero Credentials

1. Go to [zotero.org/settings/keys](https://www.zotero.org/settings/keys)
2. Create a new API key with:
   - ✅ Allow library access
   - ✅ Allow write access (required for updates)
3. Note your **User ID** (shown at the top of the page)
4. Copy your **API key**

### Gemini API Key (Optional)

For AI-powered features (categorization, tag standardization, metadata lookup):

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. The app uses **Gemini 1.5 Flash** for fast, accurate results

## Usage

### Dashboard
See at-a-glance stats about your library health and quick action buttons to jump to problem areas.

### AI Categorizer
1. Navigate to "AI Categorizer"
2. Click "Analyze X Items" to process untagged items
3. Review suggested tags and collection names
4. Click "Apply Tags" to add them or "Dismiss" to skip

### Tag Standardizer
1. Navigate to "Tag Cleanup"
2. Click "Find Duplicates" to analyze your tags
3. Review clusters of similar tags
4. Click "Merge All" to consolidate duplicates

### Metadata Doctor
1. Navigate to "Metadata Doctor"
2. Items with missing fields are listed with severity badges
3. Click "Verify" to have Gemini search for missing data
4. Review and edit suggestions
5. Click "Save" to apply changes

### Duplicate Manager
1. Navigate to "Duplicates"
2. Click on a duplicate group to open the merge modal
3. Compare records side-by-side
4. Select a master record
5. Edit the merged data if needed
6. Click "Merge & Delete Duplicates"

## Technology

- React 19
- TypeScript
- Vite
- Zotero Web API v3
- Google Gemini 1.5 Flash

## License

MIT
