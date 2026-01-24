# Work Done Summary (for Antigravity)

This note captures recent fixes, behavior changes, and deployment notes so you can pick up quickly.

## Core UX/Performance Changes
- **Mobile/perf tuning**: mobile hides heavy canvas layers (MiniMap/Controls/cursors) and compacts toolbar; React Flow options are adjusted for mobile.
- **Lazy‑loading**: secondary panels (Settings, TreeList, Diagnostics, ReaderView, LogoGuide) are dynamically imported to reduce initial JS.
- **Media query hook**: added `useMediaQuery` for mobile gating.

## Node Interaction + Layout
- **Prompt node selection**: selection is stabilized with context menu, avoiding click/selection interference.
- **Editing behavior**: prompt nodes no longer auto‑edit on single click; double‑click to edit.
- **Branch placement**: children are now placed **SE/SW** of the parent (alternating by child index) to avoid width overlap.
- **Spacing**: vertical gap between nodes reduced by ~50% (now 90px).
- **Height‑aware placement**: nodes track measured `nodeHeight` and placement uses it; fallback uses a content‑length estimate.
- **“New” action**: creates a new prompt node centered in X and in the upper third of the viewport; immediately editable.

## Auto‑Naming (Title)
- **Target model**: OpenRouter `google/gemini-2.0-flash-exp:free`.
- **Input**: first assistant reply only (3 words max).
- **Fallback**: if API unavailable, uses a 3‑word local summary of assistant reply.
- **Note**: current behavior depends on server `OPENROUTER_API_KEY` when client key is missing.

## Debug / Instrumentation (IMPORTANT)
During debug, runtime logs were added (HTTP `fetch` to local endpoint) in:
- `components/canvas/ConversationNode.tsx`
- `components/canvas/BranchingCanvas.tsx`
- `components/canvas/NodeContextMenu.tsx`
- `lib/stores/canvas-store.ts`
- `lib/hooks/useChat.ts`

**Before shipping**, remove these debug `fetch` calls and delete any `.cursor/debug.log`.

## Files Touched (recent)
- `components/canvas/BranchingCanvas.tsx`
- `components/canvas/ConversationNode.tsx`
- `components/canvas/ReaderView.tsx`
- `components/canvas/NodeContextMenu.tsx`
- `lib/hooks/useChat.ts`
- `lib/hooks/useMediaQuery.ts`
- `lib/stores/canvas-store.ts`
- `app/globals.css`

## Deployment Notes
- The app lives under `spatial-branching-ai/`.
- Running from repo root (`/Users/leon/Numi`) will fail because there’s no `package.json`.
- For Vercel Git deploys, set the **Root Directory** to `spatial-branching-ai`.

## Open Items
- Remove debug instrumentation.
- Confirm auto‑naming always hits Gemini (requires server `OPENROUTER_API_KEY`).
- Verify branch placement visually with long replies.
