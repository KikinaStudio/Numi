# Spatial Branching AI 🧠

An intelligent infinite canvas for non-linear AI conversations. Visualize your thoughts, branch off interesting points, and collaborate with AI in a spatial environment.

![Project Preview](./public/preview.png)

## 🚀 Build 1 - Foundation & Persistence

This is the first stable release of the Spatial Branching AI. It features a fully functional infinite canvas with deep branching, real-time AI generation, and robust cloud persistence using Supabase.

### ✨ Key Features

- **Infinite Canvas**: Drag, zoom, and pan across a limitless workspace using [React Flow](https://reactflow.dev/).
- **AI Branching**: Create new conversation branches from any node.
- **Deep Context**: Select specific text within a message to "Branch from Selection", passing that context to the AI.
- **Interactive UI**: Glassmorphic design with role-based styling (User vs Assistant).
- **Auto-Persistence**: Seamlessly saves your conversation trees to Supabase in real-time.
- **Robust Sync**: Handles network issues and race conditions with smart locking and optimistic updates.
- **Streaming Responses**: Real-time token streaming via OpenRouter API.

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

1. **Start New**: Click the **New Tree** icon (bottom left) to clear the canvas.
2. **Add Node**: Click "New Root" or press the **New** button to start a conversation.
3. **Chat**: Type your prompt in the Blue (User) node.
4. **Generate**: Click the **Generate Branch** button (Send icon) to get an AI response.
    - *Note: "Enter" to submit is disabled to prevent accidental sends.*
5. **Branch Deeply**:
    - **Right-click** any node to branch.
    - **Select text** inside a node to see the "Branch here" floating button.

## 🐛 Build 1 Fixes (Changelog)

- **Persistence Stability**: Fixed "Duplicate Key" errors by implementing a mutex lock for auto-saving.
- **UUIDs**: Migrated ID generation to `crypto.randomUUID()` for Supabase compatibility.
- **UX Improvement**: Replaced "Enter to Submit" with a clear "Generate" action button.
- **Visuals**: Fixed invisible edges in dark mode by applying correct stroke styles.
- **Crash Recovery**: Restored critical persistence hooks to ensure 100% uptime.

## 🔜 Roadmap

- [ ] **Multi-Modal**: Support for Images and Video nodes.
- [ ] **Collaboration**: Real-time multiplayer editing.
- [ ] **Vector Search**: Semantic search across your conversation trees.
- [ ] **Export**: Export trees to Markdown or JSON.

---

*Built by [Your Name/Antigravity]*
