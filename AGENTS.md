# Agent Instructions for this repo

## Overview
This is a React + Vite application with a small Express-style server entrypoint in `server.ts`.
The app uses Firebase client SDK for auth and Firestore, plus Firebase REST and local JSON stores for admin/visitor features.
There is also Gemini integration via `@google/genai` for OCR extraction in `src/firebase.ts` / `server.ts`.

## Key areas
- `server.ts`: backend server startup, file parsing, visitor/user JSON stores, Firestore REST helpers, Firebase token verification, and API endpoints.
- `src/`: main frontend app.
- `src/App.tsx`: router and protected route setup.
- `src/firebase.ts`: Firebase client initialization, auth helpers, Firestore error handling, visitor tracking.
- `src/pages/`: page-level features including admin dashboard, quiz builder/player, mind map editor, profile, pricing, etc.
- `src/components/`: shared UI components and layout.
- `firebase-applet-config.json`: Firebase client configuration.
- `.env.local`: expected location for `GEMINI_API_KEY`.

## Run / build
- `npm install`
- `npm run dev` — starts the app using `tsx server.ts`.
- `npm run build` — builds with Vite.
- `npm run preview` — preview production build.
- `npm run lint` — runs `tsc --noEmit`.

## Project conventions
- TypeScript + ES modules.
- React 19 + `react-router-dom` v7.
- Tailwind via `@tailwindcss/vite`.
- Server uses `tsx` directly with `import` syntax.
- Firebase config is read from `firebase-applet-config.json` for the client.
- Server-side visitor tracking persists to `.visitors.json`; user admin data persists to `.users.json`.

## Notes for AI agents
- Prefer Egyptian Arabic when answering or editing repo files, especially in comments and explanations, unless code names are in English.
- Keep changes minimal and consistent with the existing React/Tailwind style.
- If touching Firebase logic, preserve client-server separation and do not assume a Firebase Admin SDK environment unless the code already uses it.
- There is no dedicated tests folder; use `npm run lint` as the main type-check command.

## Helpful details
- The frontend uses lazy-loaded pages under `src/pages/` and a shared `Layout` component.
- Admin and analytics features depend on both `src/pages/AdminDashboard.tsx` and server endpoints in `server.ts`.
- The app tracks visits through `trackVisit()` in `src/firebase.ts` and `/api/track-visit` on the server.
- `GEMINI_API_KEY` is required for OCR extraction paths in `server.ts` and is set via environment variables.
