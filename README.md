<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a6216baa-579d-41df-8843-d700850fadbf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy notes

### Vercel

This project is deployed on Vercel as a Vite frontend. Push changes to GitHub and Vercel will deploy automatically:

```cmd
git add .
git commit -m "Update site"
git push
```

Vercel uses `vercel.json` to build `npm run build`, publish `dist`, and route React pages back to `index.html`.

### Firestore rules

Changes to `firestore.rules` do not deploy with Vercel. After changing rules, publish them from Firebase Console:

1. Open Firebase Console.
2. Go to Firestore Database.
3. Open the Security / Rules tab.
4. Paste the contents of `firestore.rules`.
5. Click Publish.

### Admin restore tools

The admin dashboard can restore local backup files:

- Use `.users.json` with "Restore accounts".
- Use `.visitors.json` with "Restore visits".

These tools write to Firestore, so Firestore rules must be published first.

### Backend/API limitation on Vercel

The old `server.ts` Express server does not run automatically on Vercel static hosting. Features that call `/api/...` need either:

- Vercel Functions in an `api/` directory, or
- a separate backend host such as Render, Railway, or Fly.io.

Current known API-dependent features include file parsing, Gemini quiz generation, mind-map generation, share links, health checks, and server-side visit tracking.

## Search engine setup

The app includes search metadata, `robots.txt`, `sitemap.xml`, and structured data for Google.

After deployment:

1. Open Google Search Console.
2. Add the domain `https://aiqu.app/` or your final production domain.
3. Choose the HTML file verification method.
4. Download Google's verification HTML file.
5. Replace `public/google-site-verification.html` with Google's file.
6. Commit and push the file so Vercel deploys it.
7. In Search Console, submit this sitemap:
   `https://aiqu.app/sitemap.xml`

If the final domain is not `https://aiqu.app`, set `VITE_SITE_URL` in Vercel to the final URL and rebuild.
