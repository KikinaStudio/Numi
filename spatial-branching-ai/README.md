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

- **Infinite Canvas**: Drag, zoom, and pan across a limitless workspace using [React Flow](https://reactflow.dev/).
- **Stable Real-Time Sync (v4)**: Mission-critical live sync using the **Singleton Management Pattern** for Supabase Realtime—eliminating "binding mismatches" and ensuring reliable collaboration.
- **Diagnostics Panel**: Visual feedback on your connection status (bottom-left) so you always know if you're "LIVE".
- **Notion-Style Rendering**: AI responses are beautifully formatted with headers, lists, and spacing designed for readability.
- **Selection-Based Branching**: Highlight any text to immediately branch a new conversation path from that specific context.
- **BYOK (Bring Your Own Key)**: Securely use your own API keys for OpenRouter.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Canvas**: @xyflow/react
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter
- **State**: Zustand

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

## 🚀 Build 4 Fixes (Changelog)

- **Realtime Singleton Pattern**: Refactored `usePersistence.ts` with a strict `activeSubIdRef` lock to prevent multiple subscription attempts.
- **Channel Isolation**: Separated Database Sync and Presence Tracking into distinct channels to avoid binding conflicts.
- **URL Loading Isolation**: Decoupled tree loading from the subscription effect to eliminate sync loops.
- **Diagnostics UI**: Added a bottom-left overlay showing the exact state of the Realtime connection.

---

Built with passion by Antigravity 🦾
