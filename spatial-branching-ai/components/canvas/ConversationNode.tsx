'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData } from '@/lib/stores/canvas-store';
import { useChat } from '@/lib/hooks/useChat';
import { Bot, User, Sparkles, Copy, GitBranch } from 'lucide-react';

interface BranchButtonState {
    show: boolean;
    x: number;
    y: number;
    text: string;
}

function ConversationNodeComponent(props: NodeProps) {
    const { id, data, selected } = props;
    const nodeData = data as ConversationNodeData;

    const contentRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [branchButton, setBranchButton] = useState<BranchButtonState>({ show: false, x: 0, y: 0, text: '' });

    const { updateNode, setTextSelection, selectNode, createChildNode } = useCanvasStore();
    const { generate, abort } = useChat();

    const isUser = nodeData.role === 'user';
    const isAssistant = nodeData.role === 'assistant';

    // Handle text selection for deep branching and floating button
    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        // Stop bubbling so pane click doesn't clear it immediately
        e.stopPropagation();

        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0 && contentRef.current) {
            const text = selection.toString();
            console.log(`[Selection] Text selected: "${text.substring(0, 10)}..."`);

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const contentRect = contentRef.current.getBoundingClientRect();

            // Calculate position relative to the node container
            // We want it centered above the selection
            const x = rect.left - contentRect.left + (rect.width / 2);
            const y = rect.top - contentRect.top;

            // Update global store for context menu scenarios
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(contentRef.current);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;

            setTextSelection({
                nodeId: id,
                text,
                range: [start, start + text.length],
            });

            // Show floating button
            setBranchButton({
                show: true,
                x,
                y,
                text
            });
        }
    }, [id, setTextSelection]);

    const clearBranchButton = useCallback(() => {
        setBranchButton(prev => ({ ...prev, show: false }));
    }, []);

    const handleBranchHere = useCallback(async () => {
        // Create child node
        const offset = { x: 50, y: 200 }; // Standard offset
        // We don't have absolute node position here easily unless passed via props or store lookup
        // props has xPos/yPos? props.xPos / yPos are deprecated in ReactFlow 12 in favor of useNodes usually, but passed in NodeProps?
        // NodeProps has xPos/yPos? No.
        // We can just ask the store to create relative to parent.
        // `createChildNode` takes absolute position.
        // We'll trust the store execution context or just fetch the node from store.

        // BETTER: conversation-store's createChildNode should accept an ID and handle position calculation if passed partial?
        // Current implementation: createChildNode(parentId, position, context).
        // We need the parent's current position to calculate child's position.
        // Let's assume the node hasn't moved since render? Or use store.

        // Hack: We can use `selectNode` to ensure we are active, but we need the position.
        // Let's pass a special flag to createChildNode or fetch position here.
        // We don't have access to all nodes here.
        // But wait! `props` has `position`? No `NodeProps` has `position`? No.

        // We will trigger the creation with a placeholder position and let the store or a layout engine fix it?
        // Or fetch from store inside the component?
        // `useCanvasStore.getState().nodes.find(...)`

        // This is a component, so we can use `useCanvasStore(s => s.nodes.find(n => n.id === id))`.
        // But that causes re-render on any node change.

        // Let's use `useCanvasStore.getState()` event handler style.
        const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        if (!parentNode) return;

        const newPos = {
            x: parentNode.position.x + 50,
            y: parentNode.position.y + 200
        };

        const childId = createChildNode(id, newPos, branchButton.text);

        setBranchButton(prev => ({ ...prev, show: false }));
        // Clear selection
        if (window.getSelection()) window.getSelection()?.removeAllRanges();
        setTextSelection(null);

        // Auto-generate if parent is user
        if (isUser) {
            await generate(childId);
        }
    }, [id, branchButton.text, createChildNode, isUser, generate, setTextSelection]);

    // Clear selection when clicking elsewhere
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(id);
        clearBranchButton();
    }, [id, selectNode, clearBranchButton]);

    // Handle content editing - stop propagation to prevent canvas from creating new node
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isUser) {
            setIsEditing(true);
        }
    }, [isUser]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        // Just sync content on blur, don't close editing immediately to avoid race with buttons
        updateNode(id, { content: e.target.value });

        // Small delay before closing to allow buttons to catch clicks
        setTimeout(() => {
            // Check if we didn't just refocus elsewhere in the same node
            setIsEditing(false);
            clearBranchButton();
        }, 150);
    }, [id, updateNode, clearBranchButton]);

    const handleSubmit = useCallback(async (content: string) => {
        console.log(`[Submit] Node ${id} submitting content:`, content.substring(0, 20) + '...');
        setIsEditing(false);
        updateNode(id, { content });

        if (isUser && content.trim()) {
            const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
            if (!parentNode) {
                console.error(`[Submit] Failed to find parent node ${id} in store!`);
                return;
            }

            const newPos = {
                x: parentNode.position.x + 50,
                y: parentNode.position.y + 250
            };

            console.log(`[Submit] Creating child for ${id} at`, newPos);
            const childId = createChildNode(id, newPos);

            try {
                console.log(`[Submit] Triggering generation for ${childId}`);
                await generate(childId);
            } catch (err) {
                console.error("[Submit] Generation failed:", err);
            }
        }
    }, [id, updateNode, isUser, createChildNode, generate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
        }
        // Allow Cmd+Enter or Ctrl+Enter to submit, but make it optional
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit(e.currentTarget.value);
        }
    }, [handleSubmit]);

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
                    <div className="flex flex-col gap-3">
                        <textarea
                            ref={textareaRef}
                            autoFocus
                            defaultValue={nodeData.content}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className="w-full min-h-[100px] bg-transparent border-none outline-none resize-none text-sm placeholder:italic"
                            placeholder="What's on your mind?..."
                        />
                        <div className="flex justify-end pt-2 border-t border-blue-500/10">
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur
                                    console.log(`[MouseDown] Submit button node ${id}`);
                                    if (textareaRef.current) handleSubmit(textareaRef.current.value);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                            >
                                <Sparkles className="h-4 w-4" />
                                Send & Branch
                            </button>
                        </div>
                    </div>
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

            {/* Floating Branch Button */}
            {branchButton.show && (
                <div
                    className="absolute z-[100] transform -translate-x-1/2 pointer-events-auto"
                    style={{
                        top: branchButton.y - 45, // 45px above selection
                        left: branchButton.x,
                    }}
                >
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(`[Click] Branch Here button clicked`);
                            handleBranchHere();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-lg hover:bg-primary/90 transition-all animate-in fade-in zoom-in-50 duration-200 ring-2 ring-background whitespace-nowrap"
                    >
                        <GitBranch className="h-3 w-3" />
                        Branch here
                    </button>
                </div>
            )}

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
