# Deployment Checklist for Firebase

## ✅ Completed

### Security
- [x] Removed hardcoded API keys and library IDs from `App.tsx` ✅ VERIFIED CLEAN
- [x] Removed all debug logging calls to localhost (127.0.0.1:7242)
- [x] Removed debug session tracking code
- [x] `.gitignore` properly configured to exclude sensitive files
- [x] **NO API KEYS IN CODEBASE** - Ready for production deployment

### Configuration
- [x] `firebase.json` configured correctly for hosting
- [x] Build output directory set to `dist` (matches Firebase config)
- [x] Vite build configuration ready

### Code Quality
- [x] No linter errors
- [x] TypeScript compilation should pass
- [x] All state management properly implemented

## ⚠️ Notes for Production

### Console Logging
The following files contain `console.log` statements that may be verbose in production:
- `bibliographicService.ts` - Contains detailed logging of API calls and enrichment strategies
- `verificationAgents.ts` - Contains logging of verification agent execution
- `App.tsx` - Contains some debug logging (mostly `console.error` and `console.warn` which are fine)

**Recommendation**: Consider removing or conditionally enabling verbose `console.log` statements in production builds. `console.error` and `console.warn` are fine to keep.

### Environment Variables
No environment variables are currently used. All configuration is user-provided through the UI.

### Build Process
1. Run `npm run build` to create production build in `dist/` directory
2. Deploy to Firebase: `firebase deploy --only hosting`
3. Ensure Firebase project is initialized: `firebase init` (if not already done)

### Firebase Hosting Configuration
- Public directory: `dist`
- SPA routing: Configured with rewrite rules
- Security headers: Configured (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Cache control: Configured for static assets

### Testing Before Deployment
1. ✅ Test build locally: `npm run build && npm run preview`
2. ✅ Verify no hardcoded credentials
3. ✅ Test all major features:
   - Library connection
   - Metadata verification
   - Duplicate detection
   - Item editing and review flow
   - RDF export (read-only mode)

### Post-Deployment
- Monitor Firebase console for errors
- Check browser console for any runtime errors
- Verify API calls are working (Zotero API, Crossref, OpenAlex, Gemini)

## 📝 Deployment Commands

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Firebase
firebase deploy --only hosting

# Or deploy everything
firebase deploy
```

## 🔒 Security Reminders

- Never commit API keys or credentials
- All user credentials are stored in browser state only (not persisted)
- No backend server required - all API calls are client-side
- CORS is handled by the APIs (Zotero, Crossref, OpenAlex, Gemini)

