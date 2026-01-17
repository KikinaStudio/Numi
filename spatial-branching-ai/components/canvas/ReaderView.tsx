'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X } from 'lucide-react';
import { useCanvasStore, useTextSelection } from '@/lib/stores/canvas-store';
import { cn } from '@/lib/utils';

export const ReaderView = () => {
    const readingNodeId = useCanvasStore(state => state.readingNodeId);
    const setReadingNodeId = useCanvasStore(state => state.setReadingNodeId);
    const nodes = useCanvasStore(state => state.nodes);
    const setTextSelection = useCanvasStore(state => state.setTextSelection);
    const setContextMenu = useCanvasStore(state => state.setContextMenu);
    const getAncestorNodes = useCanvasStore(state => state.getAncestorNodes);


    // Get full thread context
    const thread = useMemo(() => {
        if (!readingNodeId) return [];
        const ancestors = getAncestorNodes(readingNodeId);
        const current = nodes.find(n => n.id === readingNodeId);
        return current ? [...ancestors, current] : ancestors;
    }, [readingNodeId, nodes, getAncestorNodes]);

    // Handle Closing
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setReadingNodeId(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setReadingNodeId]);

    // --- TEXT SELECTION LOGIC (Simplified for Thread View) ---
    const handleGlobalSelection = useCallback((e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text && text.length > 0) {

            // Try to find the node ID from the DOM
            let targetParams = (e.target as HTMLElement).closest('[data-node-id]');
            const targetId = targetParams?.getAttribute('data-node-id') || readingNodeId;

            if (targetId) {
                setTextSelection({
                    nodeId: targetId,
                    text: text,
                    range: [0, 0] // Dummy range
                });
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    nodeId: targetId
                });
            }
        }
    }, [readingNodeId, setTextSelection, setContextMenu]);


    if (!readingNodeId || thread.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex justify-center overflow-y-auto cursor-text"
                onClick={(e) => {
                    if (e.target === e.currentTarget) setReadingNodeId(null);
                }}
            >
                <div
                    className="relative w-full max-w-3xl py-24 px-6 md:px-12"
                    onMouseUp={handleGlobalSelection}
                >
                    {/* Close Button - Fixed Position */}
                    <button
                        onClick={() => setReadingNodeId(null)}
                        className="fixed top-6 right-6 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-all z-[110]"
                    >
                        <X className="h-6 w-6" />
                    </button>

                    {/* Thread Map */}
                    <div className="space-y-12">
                        {thread.map((node, index) => {
                            const isUser = node.data.role === 'user';
                            const isLast = index === thread.length - 1;

                            return (
                                <motion.div
                                    key={node.id}
                                    layoutId={isLast ? `node-content-${node.id}` : undefined} // Only animate the last one from canvas to avoid chaos
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={cn(
                                        "group relative",
                                        isUser ? "pl-0" : "pl-0"
                                    )}
                                    data-node-id={node.id}
                                >
                                    {/* Minimal Header */}
                                    <div className="flex items-center gap-3 mb-4 opacity-40 group-hover:opacity-100 transition-opacity select-none">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            isUser ? "bg-foreground" : "bg-primary"
                                        )} />
                                        <span className="text-xs font-medium uppercase tracking-widest">
                                            {isUser ? (node.data.authorName || 'User') : 'Numi'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className={cn(
                                        "prose prose-lg dark:prose-invert max-w-none prose-headings:font-normal prose-p:leading-loose",
                                        "font-serif md:font-sans md:text-xl text-foreground/90",
                                        isUser ? "font-medium text-foreground" : "font-light"
                                    )}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                p: ({ children }) => <p className="mb-6">{children}</p>,
                                                code({ className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    return match ? (
                                                        <div className="text-sm font-mono bg-muted/50 p-4 rounded-lg my-4 overflow-x-auto">
                                                            <code className={className} {...props}>{children}</code>
                                                        </div>
                                                    ) : (
                                                        <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                                                    )
                                                }
                                            }}
                                        >
                                            {node.data.content}
                                        </ReactMarkdown>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
