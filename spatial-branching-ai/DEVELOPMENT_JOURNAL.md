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

## [2025-12-27] Build 9: The Multimodal Awakening 👁️👂

**Objective**: Enhance Numi with "senses" - Video Vision and Audio Listening.

### Features

1. **Video Vision Pipeline**:
   - Implemented client-side keyframe extraction (Start/Mid/End).
   - Integrated `nvidia/nemotron-nano-12b-v2-vl` via OpenRouter.
   - Videos are now "seen" by the AI as a sequence of images.
2. **Audio Intelligence**:
   - Integrated `mistralai/voxtral` for audio files.
   - Compact Audio Player UI.
3. **Cinematic UX**:
   - **Auto-Focus Camera**: Viewport now glides to the answer automatically.
   - **Detached Video Player**: Fullscreen modal with "cinema" styling and improved z-indexing.
   - **Enter-to-Submit**: Streamlined typing flow.

### Technical Win

- Solved the "AI can't watch videos" limitation by building a `video-processor.ts` utility that acts as the AI's "eyes", converting temporal media into static vision context.

## [2025-12-27] Build 10: The Reading Room & Smart Focus 📖⚡️

**Objective**: Transform Numi from a purely spatial tool into a focused reading environment, while reducing friction for starting thoughts.

### Build 10 Features

1. **Reader Mode (v1)**:
   - Added a "Full Screen" toggle to Answer nodes.
   - Triggers a distraction-free, minimalist document overlay (`ReaderView.tsx`).
   - Integrated with `framer-motion` for seamless `layoutId` transitions.
   - **Critical**: Text selection and branching works *inside* Reader Mode, preserving the core core mechanic even in flat view.

2. **Smart Focus**:
   - **Zero-Click Typing**: Users can now type anywhere on the canvas, and the keystrokes are automatically captured by the last active Prompt node.
   - **Auto-Select**: The last user node is strictly pre-selected on load/mount.

### Technical Challenges

- **The "Missing Component"**: We initially implemented `ReaderView` logic but forget to physically mount the component in `BranchingCanvas.tsx`. It was a simple fix but a good reminder to check the render tree.
- **CLI Confusion**: Clarified the difference between `npx vercel --prod` and users attempting `npx run`.

### User Preferences Learned

- **Aesthetics**: "Minimalist" is the key word. No background shapes on icon buttons.
- **Workflow**: The user expects standard web behavior (typing = input), regardless of where the cursor is.

### Refinements (Session 2)

- **Reader Mode 2.0 (Thread View)**: Now displays the entire conversation history (ancestors) in a continuous, minimalist flow, rather than just the single node.
- **Auto-Title**: Automatically names the tree (3 words max) upon the first interaction.
- **Node Management**: Added a discrete 'X' button for deleting nodes on hover.
- **UI Polish**: Removed borders from the Persona Selector for a cleaner, floating aesthetic.
