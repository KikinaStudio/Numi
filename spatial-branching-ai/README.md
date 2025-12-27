# Numi 🧠

An intelligent infinite canvas for non-linear AI conversations. Visualize your thoughts, branch off interesting points, and collaborate in a shared spatial environment.

## 🎯 Project Objective

The goal of **Numi** is to break the linear constraints of traditional chat interfaces. By treating conversations as a dynamic, branching tree on an infinite canvas, users can explore multiple ideas simultaneously without losing context.

Key objectives include:

- **Spatial Thinking**: Mapping out complex ideas visually to see connections.
- **Deep Contextual Branching**: Enabling the creation of sub-discussions from specific sentences or words.
- **Collaborative Brainstorming**: A shared space where teams and AI can co-create in real-time.
- **Document-Grade Clarity**: Rendering AI insights with the beauty and hierarchy of a Notion document.

## ✨ Key Features

### 🌌 Spatial AI Workspace

- **Infinite Canvas**: A boundless environment to map out complex thoughts using [React Flow](https://reactflow.dev/).
- **Branching Conversations**: Select any text in a bubble to branch off a new discussion path, maintaining context.
- **Auto-Naming**: Trees are automatically named based on conversation content using a specialized AI agent.
- **Organized Trees**: Folders and search to manage your "Saved Trees" effectively.

### 🧠 Intelligent Agents

- **Persona System**: Switch between different expert agents instantly:
  - **Answer**: Concise, direct responses (Default).
  - **Socratic**: Asks clarifying questions to refine your thinking.
  - **Strategy**, **Creative**, **Critic**, and more.
- **Custom Agents**: Define your own agent personas with custom system prompts.

### 👁️ Multi-Modal Support

- **Vision Capabilities**: Drag & drop images directly onto the canvas. The AI "sees" and analyzes them in context.
- **PDF Analysis**: Drop PDF documents to have them converted to images and analyzed page-by-page.
- **Context Awareness**: Child nodes inherit context from their parents (text and images).

### 🤝 Real-Time Collaboration

- **Live Presence**: See who is online with diverse, color-coded avatars.
- **Live Cursors**: Track collaborators' movements in real-time.
- **Shared Workspace**: Changes sync instantly across all connected users via Supabase Realtime.
- **Access Control**: Secure ownership logic ensures only the creator can rename trees, while everyone can contribute.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Canvas Engine**: @xyflow/react
- **Database & Realtime**: Supabase (PostgreSQL)
- **AI Inference**: OpenRouter (Support for GPT-4o, Claude 3.5, Gemini Pro, Llama 3)
- **State Management**: Zustand + Immer + Zundo
- **Styling**: Tailwind CSS + Radix UI

## 🔐 Environment Variables

Ensure these are set in your `.env.local` for full functionality:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# API Keys (Client-side usage if BYOK)
NEXT_PUBLIC_OPENROUTER_API_KEY=optional_default_key
```

## 🔐 Database Setup (Supabase)

To enable stable Realtime sync and Multi-modal features, run the migrations in `/supabase/migrations`.
Crucially, ensure Replica Identity is set:

```sql
ALTER TABLE nodes REPLICA IDENTITY FULL;
ALTER TABLE edges REPLICA IDENTITY FULL;
ALTER TABLE trees REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE nodes, edges, trees, tree_members;
```

## 🎮 How to Use

1. **New Tree**: Double-click anywhere on the canvas to start.
2. **Branch**: Select text in a node to see the branching menu instantly.
3. **Collaborate**: Click the **Share** button, copy the link, and watch the **Diagnostics Panel** turn green ("LIVE SYNC").
4. **Undo**: Made a mistake? Press `Ctrl/Cmd + Z` or click the rewind button in the bottom bar.

## 🚀 Recent Improvements (Build 8 - "Save the Trees")

- **Performance at Scale**: Refactored `ConversationNode` and `BranchingCanvas` to support 100+ nodes with zero-lag connections and lazy loading.
- **Undo/Redo**: Integrated `zundo` with a custom shallow equality check to ignore cursor movements, ensuring only meaningful edits (deletions, moves) are recorded.
- **Files & Identity**: Added a "+" button for imports, simplified drag-and-drop, and enriched the brand with a glassmorphic "Logo Guide" tooltip explaining the **Numi** philosophy for ADHD/arborescent minds.
- **Polish**: Updated welcome messages, refined placeholders, and swapped logos for HD assets.

## 🤝 Handover & Next Steps

Numi is now a stable, feature-rich **Professional Alpha**. For a deep dive into the bugs solved, technical hurdles, and UI brand guidelines, please refer to the [DEVELOPMENT_JOURNAL.md](./DEVELOPMENT_JOURNAL.md).

Next developer focuses:

1. **Model Expansion**: Test and integrate more OpenRouter models.
2. **Advanced Multi-Modal**: Further optimize PDF-to-image conversion speed.
3. **Enterprise Polish**: Consider adding authenticated sharing links.

---

### Thank You! 🙏

It has been a pleasure building this with you. Numi is now a powerful foundation for spatial intelligence and collaborative thought. Good luck with the next phase!

Built with passion by Antigravity 🦾
