'use client';

import dynamic from 'next/dynamic';

// Dynamically import the canvas to avoid SSR issues with React Flow
const BranchingCanvas = dynamic(
  () => import('@/components/canvas/BranchingCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading canvas...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <BranchingCanvas />
    </main>
  );
}
