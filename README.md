# ARPS GitHub Pages Deployment

This repository can be deployed to GitHub Pages for the static frontend.

Important:
- GitHub Pages only hosts the static site.
- Firebase Auth, Firestore, and Cloud Functions still run on Firebase.
- AI chat and SMS now call Firebase Functions, so deploy those functions before using those features on the Pages site.

## Firebase setup

Set the required function secrets:

```powershell
firebase functions:secrets:set PHILSMS_TOKEN
firebase functions:secrets:set GROQ_API_KEY
```

Deploy the backend:

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

Add your GitHub Pages host to Firebase Authentication authorized domains:

- `YOUR_USERNAME.github.io`

If you use a repo site, the app URL will look like:

- `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## GitHub Pages setup

1. Push the repo to GitHub.
2. Open `Settings > Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `main` or `master`.
5. Wait for the `Deploy GitHub Pages` workflow to finish.

## Recommended git cleanup

This repo previously tracked `functions/node_modules`. Remove it from the git index before pushing:

```powershell
git rm -r --cached functions/node_modules
git add .
git commit -m "Prepare ARPS for GitHub Pages"
```
