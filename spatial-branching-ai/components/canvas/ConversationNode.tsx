'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData } from '@/lib/stores/canvas-store';
import { useChat } from '@/lib/hooks/useChat';
import { Bot, User, Sparkles, Copy, GitBranch, Send, Reply, ArrowRight } from 'lucide-react';


function ConversationNodeComponent(props: NodeProps) {
    const { id, data, selected } = props;
    const nodeData = data as ConversationNodeData;

    const contentRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isEditing, setIsEditing] = useState(false);

    const { updateNode, setTextSelection, selectNode, setContextMenu, createChildNode } = useCanvasStore();
    const { generate } = useChat();

    const isUser = nodeData.role === 'user';
    const isAssistant = nodeData.role === 'assistant';

    // Handle text selection for deep branching via context menu
    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0 && contentRef.current) {
            const text = selection.toString();
            const range = selection.getRangeAt(0);

            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(contentRef.current);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;

            setTextSelection({
                nodeId: id,
                text,
                range: [start, start + text.length],
            });

            // Trigger context menu immediately at mouse position
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                nodeId: id,
            });
        }
    }, [id, setTextSelection, setContextMenu]);


    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(id);
    }, [id, selectNode]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isUser) {
            setIsEditing(true);
        }
    }, [isUser]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsEditing(false);
        updateNode(id, { content: e.target.value });
    }, [id, updateNode]);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
        // Removed Enter-to-submit logic, simplified to just save on blur or specific action
    }, []);

    // Manual generation handler
    const handleGenerate = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Sync content from textarea if currently editing
        let currentContent = nodeData.content;
        if (isEditing && textareaRef.current) {
            currentContent = textareaRef.current.value;
            updateNode(id, { content: currentContent });
        }

        if (!isUser || !currentContent.trim()) return;

        const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        if (parentNode) {
            const newPos = {
                x: parentNode.position.x + 50,
                y: parentNode.position.y + 200
            };
            const childId = createChildNode(id, newPos);
            try {
                await generate(childId);
            } catch (err) {
                console.error("Generation failed", err);
            }
        }
    }, [id, isUser, nodeData.content, isEditing, updateNode, createChildNode, generate]);

    // Reply handler for Assistant nodes
    const handleReply = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        if (parentNode) {
            const newPos = {
                x: parentNode.position.x + 50,
                y: parentNode.position.y + 200
            };
            const childId = createChildNode(id, newPos);
            selectNode(childId);
        }
    }, [id, createChildNode, selectNode]);

    return (
        <div
            onClick={handleClick}
            onDoubleClick={(e) => e.stopPropagation()}
            className={cn(
                'relative group min-w-[280px] max-w-[420px] rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-200',
                'hover:shadow-xl hover:scale-[1.02]',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                isUser && 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30',
                isAssistant && 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30',
                nodeData.isGenerating && 'animate-pulse'
            )}
        >
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            />

            <div className={cn(
                'flex items-center gap-2 px-4 py-2 border-b rounded-t-xl',
                isUser && 'bg-blue-500/10 border-blue-500/20',
                isAssistant && 'bg-emerald-500/10 border-emerald-500/20'
            )}>
                <div className={cn(
                    'p-1.5 rounded-lg',
                    isUser && 'bg-blue-500/20',
                    isAssistant && 'bg-emerald-500/20'
                )}>
                    {isUser ? (
                        <User className="h-4 w-4 text-blue-400" />
                    ) : (
                        <Bot className="h-4 w-4 text-emerald-400" />
                    )}
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                    {isUser ? 'You' : 'Assistant'}
                </span>
                {nodeData.isGenerating && (
                    <Sparkles className="h-4 w-4 text-yellow-500 animate-spin ml-auto" />
                )}
                {nodeData.branchContext && (
                    <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span>Branched</span>
                    </div>
                )}
            </div>

            {nodeData.branchContext && (
                <div className="px-4 py-2 bg-muted/30 border-b border-muted/50">
                    <p className="text-xs text-muted-foreground italic">
                        &quot;{nodeData.branchContext.length > 60
                            ? nodeData.branchContext.substring(0, 60) + '...'
                            : nodeData.branchContext}&quot;
                    </p>
                </div>
            )}

            <div className="p-4 relative nodrag cursor-auto">
                {isEditing || (selected && !isAssistant) ? (
                    <textarea
                        ref={textareaRef}
                        autoFocus
                        defaultValue={nodeData.content}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full min-h-[80px] bg-transparent border-none outline-none resize-none text-sm pb-8"
                        placeholder="Type your message..."
                    />
                ) : (
                    <div
                        ref={contentRef}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                        className={cn(
                            'text-sm leading-relaxed whitespace-pre-wrap select-text cursor-text pb-6',
                            !nodeData.content && 'text-muted-foreground italic'
                        )}
                    >
                        {nodeData.content || (isUser ? 'Double-click to edit...' : 'Generating...')}
                    </div>
                )}

                {/* Generate Button for User Nodes */}
                {isUser && (isEditing || nodeData.content.trim().length > 0) && (
                    <div className="absolute bottom-2 right-2 flex justify-end z-10 transition-opacity">
                        <button
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur
                            onClick={handleGenerate}
                            className="bg-primary text-primary-foreground p-2 rounded-full shadow-md hover:bg-primary/90 transition-all flex items-center justify-center h-8 w-8"
                            title="Generate Response"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Reply Button for Assistant Nodes */}
                {isAssistant && !nodeData.isGenerating && (
                    <div className="absolute bottom-2 right-2 flex justify-end z-10 transition-opacity">
                        <button
                            onClick={handleReply}
                            className="bg-accent text-accent-foreground p-2 rounded-full shadow-md hover:bg-accent/90 transition-all flex items-center justify-center h-8 w-8 border border-border"
                            title="Reply"
                        >
                            <Reply className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(nodeData.content);
                    }}
                    className="p-1.5 rounded-lg bg-card border shadow-sm hover:bg-accent transition-colors"
                    title="Copy content"
                >
                    <Copy className="h-3 w-3" />
                </button>
            </div>


            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            />
        </div>
    );
}

const ConversationNode = memo(ConversationNodeComponent);
ConversationNode.displayName = 'ConversationNode';

export default ConversationNode;
