'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X, ArrowUp } from 'lucide-react';
import { useCanvasStore, useTextSelection } from '@/lib/stores/canvas-store';
import { useChat } from '@/lib/hooks/useChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ReaderView = () => {
    const readingNodeId = useCanvasStore(state => state.readingNodeId);
    const setReadingNodeId = useCanvasStore(state => state.setReadingNodeId);
    const nodes = useCanvasStore(state => state.nodes);
    const setTextSelection = useCanvasStore(state => state.setTextSelection);
    const setContextMenu = useCanvasStore(state => state.setContextMenu);
    const getAncestorNodes = useCanvasStore(state => state.getAncestorNodes);

    // Get full thread context (Moved up for scope access)
    const thread = useMemo(() => {
        if (!readingNodeId) return [];
        const ancestors = getAncestorNodes(readingNodeId);
        const current = nodes.find(n => n.id === readingNodeId);
        return current ? [...ancestors, current] : ancestors;
    }, [readingNodeId, nodes, getAncestorNodes]);

    const [replyContent, setReplyContent] = useState('');
    const { generate } = useChat();
    const createChildNode = useCanvasStore(state => state.createChildNode);
    const updateNode = useCanvasStore(state => state.updateNode);
    const selectNode = useCanvasStore(state => state.selectNode);

    // Auto-scroll to bottom on new message
    const threadEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread]);

    // Handle Reply from Reader Mode
    const handleReply = useCallback(async () => {
        if (!replyContent.trim() || thread.length === 0) return;

        const lastNode = thread[thread.length - 1];
        if (!lastNode) return;

        // 1. Create User Node
        const userNodeId = createChildNode(lastNode.id, {
            x: lastNode.position.x + 50,
            y: lastNode.position.y + 200
        });

        // 2. Set Content
        updateNode(userNodeId, { content: replyContent });
        setReplyContent('');

        // 3. Update Viewer to focus on new User Node
        setReadingNodeId(userNodeId);

        // 4. Trigger Generation
        try {
            // Note: `generate` works on the User Node to create an Assistant response
            await generate(userNodeId);
        } catch (error) {
            console.error(error);
        }

    }, [replyContent, thread, createChildNode, updateNode, setReadingNodeId, generate]);

    // Detect new Assistant response (when reading node is a User Node and has a new child)
    useEffect(() => {
        if (!readingNodeId) return;
        const currentNode = nodes.find(n => n.id === readingNodeId);

        // If we are looking at a User node that just finished generating (or is generating),
        // we might want to switch to the answer? 
        // Actually, `generate` creates the child immediately.
        // We need to find if there is a child attached to the current reading node.

        const childNode = nodes.find(n => n.data.parentId === readingNodeId);
        if (childNode && childNode.data.role === 'assistant') {
            // Switch view to the answer!
            setReadingNodeId(childNode.id);
        }
    }, [nodes, readingNodeId, setReadingNodeId]);




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
                    className="relative w-full max-w-3xl py-24 px-6 md:px-12 flex flex-col min-h-screen"
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
                    <div className="space-y-12 flex-1 pb-32">
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
                        <div ref={threadEndRef} />
                    </div>

                    {/* Reply Input Area */}
                    <div className="relative mt-8">
                        <div className="relative">
                            <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleReply();
                                    }
                                }}
                                placeholder="Continue the conversation..."
                                className="w-full bg-muted/30 hover:bg-muted/50 focus:bg-background border border-transparent focus:border-border rounded-xl px-4 py-4 pr-12 text-lg resize-none outline-none transition-all placeholder:text-muted-foreground/40 min-h-[60px] max-h-[200px]"
                                rows={1}
                                style={{ height: 'auto', minHeight: '60px' }}
                            />
                            <Button
                                size="icon"
                                onClick={() => handleReply()}
                                disabled={!replyContent.trim()}
                                className={cn(
                                    "absolute bottom-3 right-3 h-8 w-8 rounded-full transition-all",
                                    replyContent.trim() ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground opacity-0 pointer-events-none"
                                )}
                            >
                                <ArrowUp className="h-5 w-5" />
                            </Button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground/30 mt-4 font-mono">
                            Numi Reader Mode
                        </p>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
};
