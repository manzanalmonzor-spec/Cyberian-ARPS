# ARPS Vercel Frontend + Firebase Backend

This repository is set up for:

- Vercel hosting the static frontend
- Firebase Auth and Firestore
- Firebase Functions handling SMS and AI chat

Important:

- The PhilSMS and Groq secrets are no longer stored in browser code.
- You do not need Vercel environment variables for SMS/chat in this setup.
- Those secrets now belong in Firebase Functions secrets.

## 1. Deploy the frontend on Vercel

Import the GitHub repo into Vercel and use:

- Framework Preset: `Other`
- Root Directory: `.`
- Build Command: leave empty
- Output Directory: `.`

After deploy, you will get a Vercel domain such as:

- `your-project.vercel.app`

## 2. Allow the Vercel domain in Firebase Auth

In Firebase Console:

1. Open `Authentication`
2. Open `Settings`
3. Add your Vercel domain to `Authorized domains`

Examples:

- `your-project.vercel.app`
- your custom domain if you attach one later

## 3. Set Firebase Function secrets

```powershell
firebase use hackathon-7955d
firebase functions:secrets:set PHILSMS_TOKEN
firebase functions:secrets:set GROQ_API_KEY
```

## 4. Deploy Firebase Functions

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

## 5. What Vercel is doing here

Vercel only serves the frontend.

The app still depends on Firebase for:

- sign in
- Firestore data
- SMS sending
- AI chat

If SMS or chat is failing after the Vercel deploy, the usual causes are:

- the Vercel domain is not added to Firebase Auth authorized domains
- Firebase Functions were not deployed
- `PHILSMS_TOKEN` or `GROQ_API_KEY` was not set
- the user is not authenticated, because the callable functions require login
