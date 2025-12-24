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
- **Real-Time Collaboration**: Share your tree with a simple link and brainstorm together with live sync and presence indicators.
- **Notion-Style Rendering**: AI responses are beautifully formatted with headers, lists, and spacing designed for readability.
- **Selection-Based Branching**: Highlight any text to immediately branch a new conversation path from that specific context.
- **Instant Editing**: Single-click to edit user nodes; actions appear right at your cursor on text selection.
- **BYOK (Bring Your Own Key)**: Securely use your own API keys for OpenAI, Anthropic, or OpenRouter.
- **Persistent Memory**: Your trees are automatically saved to Supabase and can be resumed at any time via a shareable ID.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Canvas**: @xyflow/react (React Flow)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter (Supports models like Claude, GPT-4, Llama)
- **Icons**: Lucide React

## 💾 Installation & Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/spatial-branching-ai.git
    cd spatial-branching-ai
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Environment Configuration**
    Create a `.env.local` file in the root directory:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    OPENROUTER_API_KEY=your_openrouter_key
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```

4. **Database Setup**
    Run the migration file located at `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor. This creates the necessary `trees`, `nodes`, and `edges` tables.

5. **Run Development Server**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) to start branching!

## 🎮 How to Use

1. **New Tree**: Click **New Root** to start a fresh discussion.
2. **Chat**: Type in the Blue node and click the **Arrow** to send.
3. **Branch**:
   - **Context Menu**: Right-click any node to branch.
   - **Selection**: Select any text to immediately trigger the branch menu at your cursor.
4. **Collaborate**: Click the **Share** button (bottom bar) to copy the link. Open it in another window to see real-time updates!
5. **Settings**: Click the **Gear** icon to enter your API keys and select models.

## 🐛 Build 1 Fixes (Changelog)

- **Persistence Stability**: Fixed "Duplicate Key" errors by implementing a mutex lock for auto-saving.
- **UUIDs**: Migrated ID generation to `crypto.randomUUID()` for Supabase compatibility.
- **UX Improvement**: Replaced "Enter to Submit" with a clear "Generate" action button.
- **Visuals**: Fixed invisible edges in dark mode by applying correct stroke styles.
- **Crash Recovery**: Restored critical persistence hooks to ensure 100% uptime.

## 🔜 Roadmap

- [ ] **Multi-Modal**: Support for Images and Video nodes.
- [ ] **Vector Search**: Semantic search across your conversation trees.
- [ ] **Export**: Export trees to Markdown or PDF.
- [ ] **Templates**: Pre-defined brainstorming frameworks.

---

Built with passion by Antigravity
