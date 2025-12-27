'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X, GitBranch } from 'lucide-react';
import { useCanvasStore, useTextSelection } from '@/lib/stores/canvas-store';
import { cn } from '@/lib/utils';

export const ReaderView = () => {
    const readingNodeId = useCanvasStore(state => state.readingNodeId);
    const setReadingNodeId = useCanvasStore(state => state.setReadingNodeId);
    const nodes = useCanvasStore(state => state.nodes);
    const setTextSelection = useCanvasStore(state => state.setTextSelection);
    const setContextMenu = useCanvasStore(state => state.setContextMenu);
    const textSelection = useTextSelection();

    const node = readingNodeId ? nodes.find(n => n.id === readingNodeId) : null;

    // Handle closing on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setReadingNodeId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setReadingNodeId]);

    // Handle Text Selection locally in Reader View, propagating to global store for Context Menu
    const handleTextSelection = useCallback((e: React.MouseEvent) => {
        if (!readingNodeId) return;

        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
            // Calculate selection position relative to viewport for the context menu
            // We use the mouse position for the context menu to keep it consistent with canvas interaction
            const range = selection!.getRangeAt(0);

            setTextSelection({
                nodeId: readingNodeId,
                text: text,
                range: [0, 0] // Range indices heavily depend on DOM structure, simplifying for now
            });

            // Trigger Context Menu immediately at mouse position
            // This is crucial: Reader View sits on top (z-50), so the standard canvas context menu (z-50) might conflict.
            // But since Context Menu is rendered in BranchingCanvas, it might be *behind* ReaderView.
            // We need to ensure ContextMenu is visible on top OR render a specific Reader Context Menu.
            // Strategy: Let's reuse the global context menu but ensure ReaderView is z-[60]? 
            // Or better: Let canvas handle it, but ReaderView needs to be compatible.
            // If ReaderView is a portal or absolute overlay in BranchingCanvas, it will be fine.

            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                nodeId: readingNodeId
            });
        }
    }, [readingNodeId, setTextSelection, setContextMenu]);

    // Click outside to close (logic handled by wrapper div)

    if (!readingNodeId || !node) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex justify-center overflow-y-auto cursor-default"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    // Close if clicking the backdrop (not the content)
                    if (e.target === e.currentTarget) {
                        setReadingNodeId(null);
                    }
                }}
            >
                <div className="relative w-full max-w-2xl mt-12 mb-32 px-6 sm:px-12">
                    <motion.div
                        layoutId={`node-content-${readingNodeId}`} // Smooth layout transition source to target
                        className="prose prose-lg dark:prose-invert prose-headings:font-normal prose-p:font-light prose-p:leading-loose text-foreground/90 font-serif md:font-sans md:text-xl"
                        onMouseUp={handleTextSelection}
                    >
                        <div className="flex items-center justify-between mb-8 opacity-50">
                            <div className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                                {node.data.role === 'user' ? 'Question' : 'Answer'}
                            </div>
                            <button
                                onClick={() => setReadingNodeId(null)}
                                className="p-2 hover:bg-muted rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Title / Prompt Context (Optional future feature, keeping space for it) */}

                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return match ? (
                                        <div className="relative group rounded-md border border-border bg-muted/50 my-4">
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="text-xs text-muted-foreground uppercase">{match[1]}</div>
                                            </div>
                                            <pre className="overflow-x-auto p-4 text-sm font-mono leading-relaxed custom-scrollbar">
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        </div>
                                    ) : (
                                        <code className={cn("bg-muted px-1.5 py-0.5 rounded-md font-mono text-sm", className)} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                p: ({ children }) => <p className="mb-6 leading-8 tracking-wide">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-6 mb-6 space-y-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-6 mb-6 space-y-2">{children}</ol>,
                                h1: ({ children }) => <h1 className="text-3xl font-normal mt-10 mb-6">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-2xl font-normal mt-8 mb-4">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-xl font-medium mt-6 mb-3">{children}</h3>,
                                blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground my-6">{children}</blockquote>,
                            }}
                        >
                            {node.data.content}
                        </ReactMarkdown>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
