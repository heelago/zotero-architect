# Privacy & Security

## Open Source

🔓 **This app is fully open source.** You can inspect the code yourself: [GitHub Repository](https://github.com/heelago/zotero-architect)

No hidden servers, no data collection, no tracking.

---

## How Your Data is Handled

### ✓ Your API Keys Stay in Your Browser

**What this means:**
- Your Zotero API key and Gemini API key are stored **only in your browser's localStorage**
- Keys are sent **directly** from your browser to Zotero/Gemini APIs
- They **never pass through our servers** (we don't have any servers)
- Keys are stored locally so you don't have to re-enter them every time

**Storage location:** Browser localStorage keys:
- `zotero-architect-config` - Your Zotero API key and library ID
- `zotero-architect-gemini-key` - Your Gemini API key (if provided)

### ✓ No Backend Server

**What this means:**
- This app runs **entirely in your browser**
- We don't operate any server that processes your data
- All API calls go directly from your browser to their destinations
- No data is stored on any server we control

### ✓ No Analytics or Tracking

**What this means:**
- We don't use Google Analytics or any tracking tools
- We have no idea who uses this app or how
- No cookies are set for tracking purposes
- No telemetry or usage statistics are collected

### ✓ Open for Inspection

**What this means:**
- You can inspect network traffic in your browser's Developer Tools
- All API calls are visible in the Network tab
- You can verify all requests go directly to their destinations
- The source code is available on GitHub for full inspection

---

## What Third Parties See

When you use this app, your data is sent to third-party APIs. Here's what each service sees:

### Zotero API (`api.zotero.org`)
- **What they see:** Your library data (items, metadata, tags, collections)
- **Why:** You're using their API to access your own library
- **Privacy policy:** [Zotero Privacy Policy](https://www.zotero.org/support/privacy)

### Google Gemini API (`generativelanguage.googleapis.com`)
- **What they see:** Item metadata you verify (titles, authors, abstracts, DOIs)
- **When:** Only when you use AI features (categorization, metadata verification, tag suggestions)
- **Why:** Gemini AI needs this data to provide suggestions
- **Privacy policy:** [Google AI Privacy Policy](https://ai.google.dev/privacy)
- **Your choice:** Don't enter a Gemini key → No data sent to Google (but no AI features)

### Crossref API (`api.crossref.org`)
- **What they see:** Search queries (DOIs, titles, author names you look up)
- **Why:** Used to find missing metadata (DOIs, abstracts, publication details)
- **Privacy policy:** [Crossref Privacy Policy](https://www.crossref.org/privacy-policy/)

### OpenAlex API (`api.openalex.org`)
- **What they see:** Search queries (DOIs, titles, author names you look up)
- **Why:** Used to find missing metadata (DOIs, abstracts, publication details)
- **Privacy policy:** [OpenAlex Privacy Policy](https://openalex.org/privacy)

---

## How to Verify for Yourself

### 1. Inspect Network Traffic

1. **Open Browser Developer Tools** (F12 or Cmd+Option+I)
2. **Go to the Network tab**
3. **Use the app normally** (load library, verify items, use AI features)
4. **Observe:** All requests go to:
   - `api.zotero.org` (your Zotero library)
   - `generativelanguage.googleapis.com` (Gemini AI - only if you use AI features)
   - `api.crossref.org` (metadata lookup)
   - `api.openalex.org` (metadata lookup)
   
   **No requests go to any server we control.**

### 2. Inspect localStorage

1. **Open Browser Developer Tools** (F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Expand Local Storage** → your domain
4. **View stored data:**
   - `zotero-architect-config` - Your Zotero credentials
   - `zotero-architect-gemini-key` - Your Gemini key (if provided)
   - Other keys for app state (change log, preferences, etc.)

### 3. Review Source Code

- **GitHub Repository:** [View Source Code](https://github.com/heelago/zotero-architect)
- **Inspect the code:** See exactly what data is sent where
- **Verify:** No hidden API calls, no analytics, no tracking

### 4. Build from Source

You can build the app from source and compare to the deployed version:
1. Clone the repository
2. Run `npm install` and `npm run build`
3. Compare the built files to verify they match

---

## What's Stored Locally

The app stores the following in your browser's localStorage:

| Key | Purpose | Contains Sensitive Data? |
|-----|---------|--------------------------|
| `zotero-architect-config` | Zotero API key and library ID | Yes (API key) |
| `zotero-architect-gemini-key` | Gemini API key (optional) | Yes (API key) |
| `zotero-architect-changelog` | Change log of modifications | No |
| `zotero-architect-pending-export` | Pending changes for export | No |
| `zotero-architect-reviewed-items` | Items you've reviewed | No |
| `zotero-architect-expanded-cards` | UI state (expanded sections) | No |
| `zotero-architect-filter-state` | Filter preferences | No |
| `zotero-architect-chat-messages` | Chat conversation history | No |
| `zotero-architect-readonly-mode` | Read-only mode preference | No |
| `zotero-architect-active-tab` | Last active tab | No |
| `zotero-architect-pending-repairs` | Pending metadata repairs | No |
| `zotero-architect-verification-reports` | Verification reports | No |
| `zotero-architect-export-type` | Export format preference | No |
| `zotero-architect-export-format` | Export format preference | No |

**All data is stored locally in your browser only.** You can clear it at any time using the "Clear All Stored Data" button in Settings.

---

## Privacy Considerations

### What Stays Private

- **Your API keys** (stored only in your browser)
- **Your usage patterns** (we have no analytics)
- **Your browsing behavior** (no tracking cookies)

### What Third Parties See

- **Zotero:** Already has your library (you're using their API)
- **Google Gemini:** Sees item metadata you verify (titles, authors, abstracts) - only if you use AI features
- **Crossref/OpenAlex:** Sees search queries (DOIs, titles you look up)

### Your Choices

- **Don't enter a Gemini key** → No data sent to Google (but no AI features)
- **Use read-only mode** → No writes to Zotero (just in case)
- **Clear all data** → Remove all stored keys and preferences anytime

---

## Data Deletion

You can delete all stored data at any time:

1. **In the app:** Go to Settings → "Clear All Stored Data" button
2. **Manually:** Open Developer Tools → Application tab → Clear Storage → Clear site data
3. **Browser settings:** Clear browsing data for this site

**Note:** Clearing data will remove:
- All API keys (you'll need to re-enter them)
- All preferences and UI state
- Change log and pending changes
- Chat history

**Your Zotero library data is not affected** - it remains in your Zotero account.

---

## Security Best Practices

### For Maximum Privacy

1. **Review before applying:** Use read-only mode to review all changes before applying
2. **Inspect network traffic:** Verify API calls go only to expected destinations
3. **Use API key restrictions:** If possible, restrict your API keys to specific IPs/domains
4. **Regular audits:** Periodically review what's stored in localStorage
5. **Clear data regularly:** Clear stored data if you're concerned about browser access

### API Key Security

- **Never share your API keys** with anyone
- **Don't commit keys** to version control (they're in .gitignore)
- **Rotate keys** if you suspect they've been compromised
- **Use read-only keys** if you only need to read data

---

## Questions or Concerns?

If you have questions about privacy or security:

1. **Inspect the code:** [GitHub Repository](https://github.com/heelago/zotero-architect)
2. **Check network traffic:** Use Developer Tools to see all API calls
3. **Review third-party policies:** Links provided above
4. **Contact:** contact@h2eapps.com

---

## Updates to This Policy

This privacy policy may be updated. The latest version is always available in the GitHub repository.

**Last updated:** January 3, 2026

