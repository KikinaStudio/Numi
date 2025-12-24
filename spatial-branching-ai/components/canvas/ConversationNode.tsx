'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData } from '@/lib/stores/canvas-store';
import { useChat } from '@/lib/hooks/useChat';
import { Bot, User, Sparkles, Copy, GitBranch, Send } from 'lucide-react';

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
    const [isEditing, setIsEditing] = useState(false);
    const [branchButton, setBranchButton] = useState<BranchButtonState>({ show: false, x: 0, y: 0, text: '' });

    const { updateNode, setTextSelection, selectNode, createChildNode } = useCanvasStore();
    const { generate } = useChat();

    const isUser = nodeData.role === 'user';
    const isAssistant = nodeData.role === 'assistant';

    // Handle text selection for deep branching and floating button
    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0 && contentRef.current) {
            const text = selection.toString();
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const contentRect = contentRef.current.getBoundingClientRect();

            // Calculate position relative to the node content div
            const x = rect.left - contentRect.left + (rect.width / 2);
            const y = rect.top - contentRect.top;

            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(contentRef.current);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;

            setTextSelection({
                nodeId: id,
                text,
                range: [start, start + text.length],
            });

            setBranchButton({
                show: true,
                x: x + 16,
                y: y + 16,
                text
            });
        } else {
            setBranchButton(prev => ({ ...prev, show: false }));
        }
    }, [id, setTextSelection]);

    const handleBranchHere = useCallback(async () => {
        const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        if (!parentNode) return;

        const newPos = {
            x: parentNode.position.x + 50,
            y: parentNode.position.y + 200
        };

        const childId = createChildNode(id, newPos, branchButton.text);

        setBranchButton(prev => ({ ...prev, show: false }));
        if (window.getSelection()) window.getSelection()?.removeAllRanges();
        setTextSelection(null);

        if (isUser) {
            await generate(childId);
        }
    }, [id, branchButton.text, createChildNode, isUser, generate, setTextSelection]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(id);
        setBranchButton(prev => ({ ...prev, show: false }));
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
        if (!isUser || !nodeData.content.trim()) return;

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
    }, [id, isUser, nodeData.content, createChildNode, generate]);

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

            <div className="p-4 relative">
                {isEditing ? (
                    <textarea
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
                            className="bg-primary text-primary-foreground p-2 rounded-full shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 text-xs font-medium pr-3 pl-2 h-7"
                            title="Generate Response"
                        >
                            <Send className="h-3 w-3" />
                            Generate
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

            {branchButton.show && (
                <div
                    className="absolute z-50 transform -translate-x-1/2"
                    style={{
                        top: branchButton.y - 10,
                        left: branchButton.x,
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleBranchHere();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-lg hover:bg-primary/90 transition-all animate-in fade-in zoom-in-50 duration-200"
                    >
                        <GitBranch className="h-3 w-3" />
                        Branch here
                    </button>
                </div>
            )}

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
