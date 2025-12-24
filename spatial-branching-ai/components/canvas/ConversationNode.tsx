'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData } from '@/lib/stores/canvas-store';
import { Bot, User, Sparkles, Copy, GitBranch } from 'lucide-react';

function ConversationNodeComponent(props: NodeProps) {
    const { id, data, selected } = props;
    const nodeData = data as ConversationNodeData;

    const contentRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const { updateNode, setTextSelection, selectNode } = useCanvasStore();

    const isUser = nodeData.role === 'user';
    const isAssistant = nodeData.role === 'assistant';

    // Handle text selection for deep branching
    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0 && contentRef.current) {
            const range = selection.getRangeAt(0);
            const text = selection.toString();

            // Get the start and end positions relative to node content
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(contentRef.current);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;

            setTextSelection({
                nodeId: id,
                text,
                range: [start, start + text.length],
            });
        }
    }, [id, setTextSelection]);

    // Clear selection when clicking elsewhere
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(id);
    }, [id, selectNode]);

    // Handle content editing - stop propagation to prevent canvas from creating new node
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setIsEditing(false);
            const target = e.target as HTMLTextAreaElement;
            updateNode(id, { content: target.value });
        }
    }, [id, updateNode]);

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
            {/* Target handle (incoming connections) */}
            <Handle
                type="target"
                position={Position.Top}
                className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            />

            {/* Header */}
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

            {/* Branch context indicator */}
            {nodeData.branchContext && (
                <div className="px-4 py-2 bg-muted/30 border-b border-muted/50">
                    <p className="text-xs text-muted-foreground italic">
                        &quot;{nodeData.branchContext.length > 60
                            ? nodeData.branchContext.substring(0, 60) + '...'
                            : nodeData.branchContext}&quot;
                    </p>
                </div>
            )}

            {/* Content */}
            <div className="p-4">
                {isEditing ? (
                    <textarea
                        autoFocus
                        defaultValue={nodeData.content}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full min-h-[80px] bg-transparent border-none outline-none resize-none text-sm"
                        placeholder="Type your message..."
                    />
                ) : (
                    <div
                        ref={contentRef}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                        className={cn(
                            'text-sm leading-relaxed whitespace-pre-wrap select-text cursor-text',
                            !nodeData.content && 'text-muted-foreground italic'
                        )}
                    >
                        {nodeData.content || (isUser ? 'Double-click to edit...' : 'Generating...')}
                    </div>
                )}
            </div>

            {/* Action buttons (visible on hover) */}
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

            {/* Source handle (outgoing connections) */}
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
