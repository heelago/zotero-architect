# Deployment Guide

## Automated Deployment (Recommended)

This project uses **GitHub Actions** for automated deployment to Firebase Hosting. Every push to the `main` branch automatically builds and deploys the app.

### How It Works

1. **Push to GitHub**: When you push code to the `main` branch
2. **GitHub Actions**: Automatically runs the build and deployment workflow
3. **Firebase Hosting**: Receives the built files and updates the live site
4. **Live URL**: https://zotero-architect.web.app

### Benefits

- ✅ **Transparency**: Deployed code always matches GitHub repository
- ✅ **Automation**: No manual deployment steps needed
- ✅ **Reproducibility**: Anyone can verify what's deployed
- ✅ **Trust**: Users can see the exact code that's running

### Setup (One-Time)

If you haven't set up automated deployment yet:

1. **Get Firebase Service Account**:
   ```bash
   # In Firebase Console:
   # 1. Go to Project Settings → Service Accounts
   # 2. Click "Generate new private key"
   # 3. Save the JSON file (DO NOT commit it!)
   ```

2. **Add GitHub Secret**:
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste the entire contents of the service account JSON file
   - Click "Add secret"

3. **Verify Workflow**:
   - The workflow file is already in `.github/workflows/deploy.yml`
   - Push a commit to trigger the first deployment
   - Check the "Actions" tab in GitHub to see deployment status

### Manual Deployment (Alternative)

If you prefer manual deployment or need to deploy immediately:

```bash
# Build the app
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

### Preview Deployments

Firebase Hosting also supports preview channels for pull requests. The GitHub Action automatically creates preview URLs for each PR, allowing you to test changes before merging.

### Monitoring

- **GitHub Actions**: Check the "Actions" tab for deployment status
- **Firebase Console**: https://console.firebase.google.com/project/zotero-architect/hosting
- **Live Site**: https://zotero-architect.web.app

### Troubleshooting

**Deployment fails?**
- Check GitHub Actions logs for error messages
- Verify `FIREBASE_SERVICE_ACCOUNT` secret is set correctly
- Ensure Firebase project ID matches in workflow file

**Build fails?**
- Check that all dependencies are in `package.json`
- Verify Node.js version (should be 18+)
- Check for TypeScript or linting errors

**Need to rollback?**
- Use Firebase Console → Hosting → History to revert to previous version
- Or redeploy a specific commit from GitHub Actions

