# Project Overview

**AI Quiz Master** — A React + Vite + Express app that transforms uploaded documents into AI-powered quizzes and mind maps using Gemini AI and Firebase.

## Architecture

- **Frontend**: React 19 with TypeScript, Vite, Tailwind CSS v4, React Router v7
- **Backend**: Express.js server (`server.ts`) serving both the API and Vite dev middleware
- **Database**: Firebase Firestore (external, configured via `firebase-applet-config.json`)
- **Auth**: Firebase Authentication with Google Sign-In
- **AI**: Google Gemini API (`@google/genai`)

## Project Structure

```
├── server.ts          # Express server (API + Vite middleware)
├── vite.config.ts     # Vite config (host: 0.0.0.0, port: 5000, allowedHosts: true)
├── src/
│   ├── App.tsx        # Main app component with routing
│   ├── AuthContext.tsx # Firebase auth context
│   ├── firebase.ts    # Firebase initialization and helpers
│   ├── index.tsx      # React entry point
│   ├── components/    # Reusable UI components
│   ├── pages/         # Page-level components
│   └── services/      # API/service layer
├── firebase-applet-config.json  # Firebase project config
├── firestore.rules    # Firestore security rules
└── .env.example       # Environment variable template
```

## Environment Variables

- `GEMINI_API_KEY` — Required for Gemini AI API calls

## Running the App

The server runs on port 5000 using `npm run dev` which starts `tsx server.ts`. The Express server handles API routes and serves the React app via Vite middleware in development.

## Key API Routes

- `GET /api/health` — Health check
- `POST /api/parse-file` — File parsing (PDF, DOCX, XLSX, CSV, text)

## Deployment

Configured for autoscale deployment:
- Build: `npm run build`
- Run: `npm run start` (production mode, serves built `dist/`)
