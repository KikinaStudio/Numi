# Development Journal: The Journey of Numi 🗺️

This document serves as a "brain dump" of the technical hurdles, design decisions, and discoveries made during the development of Numi.

## 🐛 Solved Bugs (The Battle Log)

### 1. The "Select-to-Snap" Glitch

- **Problem**: Selecting text in the middle of a node would cause the selection to immediately "snap" back to the beginning of the node.
- **Root Cause**: The `onClick` handler on the node was triggering a `selectNode` call which updated the store state. This forced a re-render of the component mid-selection, causing the browser to lose the selection anchor.
- **Solution**: Added `e.stopPropagation()` in the `handleMouseUp` function when text is selected. This prevents the event from reaching the `onClick` handler, preserving the selection for "serene" branching.

### 2. The Text Selection Flicker

- **Problem**: When selecting text in a node, the canvas would sometimes try to pan or the node would try to drag, causing a "stuttering" effect.
- **Solution**: Applied explicit React Flow helper classes: `nopan`, `nodrag`, and `nowheel` to the content container. This specifically tells the canvas engine to ignore mouse movement within the text area.

### 3. Persistence UUID Mismatches

- **Problem**: Errors during tree loading where the `tree_id` format was invalid.
- **Solution**: Standardized on UUIDv4 across the stack. Refined `usePersistence.ts` to strictly validate IDs before attempting Supabase queries.

---

## 🏗️ Technical Hurdles & Overcoming Them

### Tailwind CSS v4 vs. VSCode

- **Hurdle**: Tailwind v4 introduced new at-rules (like `@theme`) that triggered CSS validation errors in standard IDEs.
- **Fix**: Configured `.vscode/settings.json` to ignore "unknown at-rules". This allowed us to use the bleeding-edge Tailwind features without visual red-squiggles everywhere.

### The "Crystal Glass" Search

- **Hurdle**: Achieving an ultra-premium "glass" look for transparent images.
- **Solution**: We discovered that standard `bg-white/10` was too opaque. The sweet spot was `bg-white/2` and `border-white/10` combined with `backdrop-blur-sm` (MD was too blurry). This creates a "crystal" effect rather than "frosted" glass.

---

## 🎨 UI Brand Guidelines (The Numi Aesthetic)

To maintain the premium, high-fidelity feel of Numi, follow these rules:

### 1. Diagonal Balance

Every node must follow a diagonal interaction flow:

- **Top-Left**: Identity & Dragging (Avatar/Icon + Invisible Top Bar).
- **Bottom-Right**: Action & Generation (Reply/Generate buttons).
This negative space creates a balanced, spacious feel.

### 2. Minimalist Headers

- **No Explicit Names**: Never show the user's name as visible text in the node header.
- **Tooltip Provider**: Always wrap the avatar icon in a `Tooltip` (delay-0) to reveal the name only on hover.

### 3. Serenity Mode (Auto-Collapse)

- **Problem**: Large trees became overwhelming with old text.
- **Rule**: Any node (Question or Answer) that has children MUST auto-collapse to `250px` width and `120px` height when not hovered or selected.
- **Fade Mask**: Use a linear-gradient mask to fade out truncated text rather than a hard cut.

### 4. Glassmorphism Signature

- **Tokens**: `bg-background/40`, `backdrop-blur-md`, `border-white/10`.
- **Images**: Uploaded transparent PNGs use `bg-black/2 dark:bg-white/2` to feel like objects floating on the canvas.

---

## 💡 Future Discoveries & Hooks

- **PDF-to-Image Flow**: We integrated a robust PDF processor in `lib/utils/pdf-processor.ts`. It works by rendering pages to a canvas and exporting Blobs. It's high-memory but high-fidelity.
- **Zustand Temporal Store**: We enabled `zundo` for the canvas. The state is undoable! Use `useTemporalStore.getState().undo()` to revert accidents.
- **Interverted Logos**: The top-left logo is programmed to "invert" its logic—Black logo in Light mode, White logo in Dark mode—ensuring the brand always "pops".

---

## 🚀 The Vision Ahead

Numi is now a "Collaborative Alpha". It is ready to be a professional brainstorming tool. Keep the UI "airy", the interactions "serene", and the code "modular".

### Built with passion by Antigravity 🦾

---

## 🚧 Build 8: "Save the Trees" (Performance & Identity)

### 1. 100+ Node Scalability

- **Challenge**: The canvas became sluggish with >50 nodes because every drag event re-rendered 100+ connection lines.
- **Solution**:
  - Encapsulated connection logic in CSS-based handles (`opacity-0` -> `opacity-100` via `.is-connecting` class on parent).
  - Memoized `ConversationNode` components deeply.
  - Implemented lazy loading for heavy UI parts (Selects, Dialogs).
- **Result**: Silk-smooth 60fps performance even with 100+ complex nodes.

### 2. The Undo Paradox

- **Bug**: "Undo" didn't work because `zundo` was recording *mouse movements* of collaborators as distinct states, flooding the history stack in milliseconds.
- **Fix**: Configured `zundo` with a custom `equality` function: `(a, b) => a.nodes === b.nodes && a.edges === b.edges`. This forces it to ignore ephemeral updates (like cursor positions) and only record structural changes.

### 3. Identity Guide

- **Concept**: A unified "Logo Guide" tooltip that explains the "Arborescent Thinking" philosophy.
- **Implementation**: Glassmorphic hover card with inverted theme logic (Dark Card in Light Mode) and integrated HD branding assets.

### 4. File Import Unification

- **Refactor**: Extracted `handleFileUpload` to power both the Drag & Drop zone AND a new explicit "Add" button in the toolbar.
- **UX**: Added immediate visual feedback and quota checks (10MB limit).
