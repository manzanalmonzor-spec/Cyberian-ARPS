# ARPS Vercel Frontend + Firebase Backend

This repository is set up for:

- Vercel hosting the static frontend
- Firebase Auth and Firestore
- Vercel API routes handling SMS and AI chat

Important:

- The PhilSMS and Groq secrets are no longer stored in browser code.
- SMS and chat now run through `/api/send-sms` and `/api/groq-chat` on Vercel.
- The required secrets belong in Vercel environment variables.
- These API routes are set up for your demo deployment; add stronger server-side auth/rate limiting before exposing them as a public production system.

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

## 3. Set Vercel environment variables

In Vercel project settings, add:

- `PHILSMS_TOKEN`
- `GROQ_API_KEY`

Use your real provider values there, not in the repo.

## 4. Redeploy on Vercel

After adding the environment variables, redeploy the Vercel project.

## 5. What Vercel is doing here

Vercel serves:

- the static frontend
- the SMS API route
- the AI chat API route

The app still depends on Firebase for:

- sign in
- Firestore data

If SMS or chat is failing after the Vercel deploy, the usual causes are:

- the Vercel domain is not added to Firebase Auth authorized domains
- `PHILSMS_TOKEN` or `GROQ_API_KEY` was not set in Vercel
- the Vercel deployment was not redeployed after setting env vars
