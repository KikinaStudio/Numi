# Spatial Branching AI 🧠

An intelligent infinite canvas for non-linear AI conversations. Visualize your thoughts, branch off interesting points, and collaborate in a shared spatial environment.

## 🎯 Project Objective

The goal of **Spatial Branching AI** is to break the linear constraints of traditional chat interfaces. By treating conversations as a dynamic, branching tree on an infinite canvas, users can explore multiple ideas simultaneously without losing context.

Key objectives include:

- **Spatial Thinking**: Mapping out complex ideas visually to see connections.
- **Deep Contextual Branching**: Enabling the creation of sub-discussions from specific sentences or words.
- **Collaborative Brainstorming**: A shared space where teams and AI can co-create in real-time.
- **Document-Grade Clarity**: Rendering AI insights with the beauty and hierarchy of a Notion document.

## ✨ Key Features

- **Presence & Collaboration (v5)**: Real-time collaborator avatars with tooltips, user count indicators, and reactive metadata syncing.
- **Access Control**: Owner-only renaming for conversation trees; collaborators see a locked title with a 🔒 indicator.
- **Selection-Based Branching**: Highlight any text to immediately branch a new conversation path from that specific context.
- **Notion-Style Rendering**: AI responses are beautifully formatted with headers, lists, and spacing designed for readability.
- **Infinite Canvas**: Drag, zoom, and pan across a limitless workspace using [React Flow](https://reactflow.dev/).
- **Diagnostics Panel**: Visual feedback on your connection status (bottom-left) so you always know if you're "LIVE".
- **BYOK (Bring Your Own Key)**: Securely use your own API keys for OpenRouter.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Canvas**: @xyflow/react
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter
- **State**: Zustand
- **UI**: Tailwind CSS, Radix UI, Lucide Icons

## 🔐 Database Requirements (Supabase)

To enable stable Realtime sync, you **must** run these commands in your Supabase SQL Editor:

```sql
-- 1. Enable Full Replica Identity for all core tables
ALTER TABLE nodes REPLICA IDENTITY FULL;
ALTER TABLE edges REPLICA IDENTITY FULL;
ALTER TABLE trees REPLICA IDENTITY FULL;

-- 2. Ensure tables are in the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE nodes, edges, trees;
```

## 🎮 How to Use

1. **New Tree**: Double-click anywhere on the canvas to start.
2. **Branch**: Select text in a node to see the branching menu instantly.
3. **Collaborate**: Click the **Share** button, copy the link, and watch the **Diagnostics Panel** turn green ("LIVE SYNC").
4. **Presence**: Hover over avatars in the toolbar to see who is currently exploring the canvas with you.

## 🚀 Recent Improvements (Build 4 & 5)

- **Reactive Presence Tracking**: Refactored `usePersistence.ts` to sync user metadata (names, colors) instantly without channel restarts.
- **Collaborator UI**: Integrated Radix Tooltips for avatars and a glassmorphism "user count" badge.
- **Ownership Logic**: Implemented `owner_id` checks to restrict title editing to the tree creator.
- **Realtime Singleton Pattern**: Strictly managed subscriptions to prevent "binding mismatches" and sync loops.
- **Favicon Update**: Custom gradient logo integrated for a premium look.

## 🤝 Handover & Next Steps

This project is currently in a stable "Collaborative Alpha" state. The next developer should focus on:

1. **Live Cursors**: Re-implement precision mouse tracking (the infrastructure is ready in `usePersistence.ts`).
2. **Multi-Modal Support**: Expand the `app/api/chat` route to handle image uploads and vision-based branching.
3. **Performance**: Optimize the canvas for trees exceeding 100+ nodes using React Flow's partial rendering.
4. **Mobile Polish**: Enhance touch-based interactions for iPad/Tablet usage.

---

### Thank You! 🙏

It has been a pleasure building this with you. This tool is now a powerful foundation for spatial intelligence and collaborative thought. Good luck with the next phase!

Built with passion by Antigravity 🦾
