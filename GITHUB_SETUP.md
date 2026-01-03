# GitHub Repository Setup Instructions

## Step 1: Create Repository on GitHub

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in the details:
   - **Repository name**: `zotero-architect` (or your preferred name)
   - **Description**: "AI-powered Zotero library cleanup tool with duplicate detection, metadata enrichment, and smart organization"
   - **Visibility**: Select **Public** (for transparency and open source)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

## Step 2: Add Remote and Push

After creating the repository, GitHub will show you commands. Use these commands in your terminal:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/zotero-architect.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 3: Update Repository URLs in Code

After pushing, you'll need to update the placeholder GitHub URLs in the code:

1. **Update `README.md`**: Replace `https://github.com/yourusername/zotero-architect` with your actual repository URL
2. **Update `PRIVACY.md`**: Replace `https://github.com/yourusername/zotero-architect` with your actual repository URL  
3. **Update `App.tsx`**: Replace `https://github.com/yourusername/zotero-architect` with your actual repository URL (appears in 2 places: Settings HelpBox and footer)

Then commit and push:
```bash
git add README.md PRIVACY.md App.tsx
git commit -m "Update GitHub repository URLs"
git push
```

## Step 4: Add Repository Topics (Optional)

On your GitHub repository page:
1. Click the gear icon next to "About"
2. Add topics: `zotero`, `bibliography`, `research`, `academic`, `metadata`, `open-source`, `privacy-focused`

## Step 5: Verify

- Visit your repository URL
- Verify all files are present
- Check that `.gitignore` is working (no `node_modules`, `dist`, or API keys)
- Test that the README displays correctly

---

**Note**: Make sure you never commit API keys or sensitive data. The `.gitignore` file should prevent this, but always double-check before pushing.

