# Zotero Architect - App Capabilities Guide

This document describes what the app can do and how to use it for common tasks. The chat assistant references this guide to provide accurate, app-specific instructions.

## Table of Contents
1. [Adding DOIs and Metadata](#adding-dois-and-metadata)
2. [Finding Items](#finding-items)
3. [Fixing Missing Metadata](#fixing-missing-metadata)
4. [Tagging Items](#tagging-items)
5. [Finding and Merging Duplicates](#finding-and-merging-duplicates)
6. [Analyzing Your Library](#analyzing-your-library)
7. [Exporting Changes](#exporting-changes)

---

## Adding DOIs and Metadata

### How the App Helps:
The app can automatically find and add DOIs, abstracts, and other missing metadata using real bibliographic databases (Crossref and OpenAlex APIs).

### Step-by-Step Instructions:

1. **Find items missing DOIs/metadata:**
   - Go to the Library tab
   - Use the filter dropdown to select "Incomplete metadata"
   - Or search for specific items by title/author

2. **Verify and enrich an item:**
   - Click on an item card to expand it
   - Click the **"Verify"** button
   - The app will:
     - Check if the publication exists in academic databases
     - Search Crossref and OpenAlex for missing metadata (DOI, abstract, publication details, authors)
     - Display suggested metadata in the expanded card

3. **Review and apply suggestions:**
   - In the expanded card, you'll see a "Metadata Suggestions" section
   - Review the suggested fields (DOI, abstract, publication title, etc.)
   - You can edit any field before applying
   - Click **"Apply"** on individual fields, or **"Accept All"** to apply all suggestions at once
   - Changes are saved directly to Zotero (or staged for export in read-only mode)

### Batch Processing:
- Select multiple items using the checkboxes
- Click **"Verify Selected"** in the batch actions bar
- The app will verify and enrich all selected items

### Notes:
- The app uses real bibliographic APIs (Crossref, OpenAlex), not just AI guessing
- If metadata can't be found automatically, you can manually edit fields in the repair form
- All changes are tracked in the change log (viewable in Settings)

---

## Finding Items

### How the App Helps:
The app provides multiple ways to find items in your library.

### Methods:

1. **Search Bar:**
   - Located in the Library tab toolbar
   - Searches across titles, authors, abstracts, DOIs, and tags
   - Type your query and results filter in real-time

2. **Filter Dropdown:**
   - **All items** - Show everything
   - **Incomplete metadata** - Items missing required/recommended fields
   - **Untagged items** - Items without any tags
   - **Duplicates** - Potential duplicate groups
   - **Recent** - Recently added items
   - **By tag** - Filter by a specific tag

3. **Using Chat:**
   - Ask: "Show me items about [topic]"
   - Ask: "Which items are missing DOIs?"
   - Ask: "Find items with the tag [tag name]"
   - The chat will filter and show matching items

### Sorting:
- Use the sort dropdown (Date, Title, Author, Completeness)
- Toggle ascending/descending order

---

## Fixing Missing Metadata

### How the App Helps:
The app identifies items with missing required or recommended fields and helps you fill them in.

### Step-by-Step Instructions:

1. **View items needing attention:**
   - Go to Library tab
   - Filter by "Incomplete metadata"
   - Items are displayed with badges showing missing fields

2. **For a specific item:**
   - Expand the item card
   - The app shows which fields are missing (required vs. recommended)
   - Click **"Verify"** to search for missing data automatically
   - Or manually edit fields in the metadata section

3. **Apply fixes:**
   - Review suggested metadata in the "Metadata Suggestions" section
   - Edit fields as needed
   - Click **"Apply"** to save changes to individual fields
   - Or click **"Accept All"** to apply all suggestions

### Required vs. Recommended Fields:
- **Required fields** (marked in red/bold): Critical for proper citations
- **Recommended fields** (marked in blue/info): Improve citation quality but not critical

---

## Tagging Items

### How the App Helps:
The app can suggest tags for items using AI analysis, and you can apply tags individually or in bulk.

### Step-by-Step Instructions:

1. **Get tag suggestions for an item:**
   - Expand an item card
   - Click **"Suggest Tags"**
   - The AI analyzes the item (title, abstract, content) and suggests relevant tags
   - Review suggestions in the expanded card

2. **Apply tags:**
   - Edit suggested tags if needed
   - Click **"Apply Tags"** to add them to the item

3. **Batch tagging:**
   - Select multiple items using checkboxes
   - Click **"Tag Selected"** in the batch actions bar
   - The app suggests tags for all selected items
   - Tags are applied automatically (or staged in read-only mode)

4. **View items by tag:**
   - Click any tag in an item card
   - The library filters to show only items with that tag

### Manual Tagging:
- You can also add tags directly in Zotero
- Tags added in Zotero will appear in the app after refresh

---

## Finding and Merging Duplicates

### How the App Helps:
The app detects duplicate items by comparing DOIs, ISBNs, and title+author combinations.

### Step-by-Step Instructions:

1. **View duplicates:**
   - Go to Library tab
   - Filter by "Duplicates"
   - Or click "Check Duplicates" on the Home tab

2. **Review a duplicate group:**
   - Click on a duplicate group card
   - A modal opens showing all items in the group side-by-side
   - Compare fields across all items

3. **Merge duplicates:**
   - Select which item should be the "master" (the one to keep)
   - Click **"Continue to Merge"**
   - The app creates a merged version with the best data from all items
   - Review and edit the merged data as needed
   - Click **"Merge & Delete Duplicates"** to complete
   - The master item is updated, duplicate items are deleted

### Notes:
- Merges are permanent (duplicate items are deleted)
- All changes are tracked in the change log
- In read-only mode, merges are staged for export

---

## Analyzing Your Library

### How the App Helps:
The app provides statistics and insights about your library.

### Available Analyses:

1. **Library Statistics:**
   - Ask chat: "Show me library statistics"
   - Or use the Home tab overview
   - Shows: total items, incomplete items, duplicates, untagged items

2. **Author Analysis:**
   - Ask chat: "Analyze my authors"
   - Shows: most common authors, potential duplicate author names

3. **Tag Analysis:**
   - Ask chat: "Analyze my tags"
   - Shows: tag usage, single-use tags, tag distribution

4. **Completeness Assessment:**
   - View stats on the Home tab
   - Filter by "Incomplete metadata" to see items needing attention

---

## Exporting Changes

### How the App Helps:
In read-only mode, or if you want to review changes before applying, you can export your changes.

### Step-by-Step Instructions:

1. **View change log:**
   - Go to Settings tab
   - Click **"View Change Log"**
   - See all changes made in the current session

2. **Export changes:**
   - In the change log modal, click **"Copy to Clipboard"**
   - Or use the export functionality in Settings
   - Changes can be exported as RDF (for importing back to Zotero) or text

3. **Before disconnecting:**
   - **Important:** Export your change log from Settings before disconnecting
   - Your change log is lost when you disconnect or start a new session
   - The change log contains a record of all metadata updates, merges, and tag additions

---

## What the App Cannot Do

The app focuses on library cleanup and organization. It cannot:

- **Create new items** - Use Zotero directly to add new items
- **Delete items individually** - Only through duplicate merging
- **Edit items through chat** - Use the UI to make edits (chat can find and navigate to items)
- **Manage attachments/PDFs** - Use Zotero for file management
- **Sync with Zotero in real-time** - Refresh the library to see latest changes from Zotero
- **Manage collections** - Use Zotero's collection system directly
- **Export to citation formats** - Use Zotero's export features for BibTeX, etc.

If you need a feature the app doesn't support, you can request it (see feature requests section in chat).

---

## Tips for Best Results

1. **Use Verify for metadata enrichment** - The automatic search is more accurate than manual entry
2. **Review suggestions before applying** - Always check that suggested metadata looks correct
3. **Export change log regularly** - Especially before disconnecting or starting a new session
4. **Use batch operations** - Select multiple items to verify or tag them all at once
5. **Check duplicates periodically** - Duplicate detection helps keep your library clean

---

## Getting Help

- **Chat assistant** - Ask questions in the chat (Library tab, click "Chat" button)
- **Feature requests** - Ask the chat about unsupported features to get a feature request template

