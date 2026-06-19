# TODO

## Step 1 — Route-level code splitting (approved) ✅ done
- Update `quiz/src/App.tsx`:
  - Replace eager page imports with `React.lazy(() => import(...))`.
  - Wrap route `element` renders in a shared `<Suspense fallback={...}>` to avoid blocking initial load.
  - Keep existing routing paths and props unchanged.


## Step 2 — Build + performance verification ✅ done (build)
- Run production build.
- Re-run Lighthouse in incognito (extensions disabled) and compare Bootup/TTI/LCP.


## Step 3 — Firebase chunk check (if still needed)
- Re-audit Lighthouse/Vite output for the firebase chunk-splitting warning and eliminate any remaining static imports.

