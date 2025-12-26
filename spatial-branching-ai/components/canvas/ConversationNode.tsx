'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData, USER_COLORS } from '@/lib/stores/canvas-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useChat } from '@/lib/hooks/useChat';
import { Bot, User, Sparkles, Copy, GitBranch, Send, Reply, ArrowRight, Scissors, Image as ImageIcon, FileText, Plus, Pencil, Search, CheckSquare, Zap, TrendingUp, Heart, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PERSONAS } from '@/lib/config/personas';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"



function ConversationNodeComponent(props: NodeProps) {
    const { id, data, selected } = props;
    const nodeData = data as ConversationNodeData;
    const { theme, userName } = useSettingsStore();

    const contentRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingPersona, setIsEditingPersona] = useState(false);

    const updateNode = useCanvasStore((state) => state.updateNode);
    const setTextSelection = useCanvasStore((state) => state.setTextSelection);
    const selectNode = useCanvasStore((state) => state.selectNode);
    const setContextMenu = useCanvasStore((state) => state.setContextMenu);
    const createChildNode = useCanvasStore((state) => state.createChildNode);
    const me = useCanvasStore((state) => state.me);
    const { generate } = useChat();

    const isUser = nodeData.role === 'user';
    const isAssistant = nodeData.role === 'assistant';

    // Helper to get consistent color for legacy nodes or guest users
    const getFallbackColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash % USER_COLORS.length);
        return USER_COLORS[index];
    };

    // Determine effective color for User bubbles
    // 1. Explicit authorColor (saved in node)
    // 2. If it's ME, use my current color from store
    // 3. Fallback to hash of authorName (for consistent coloring of others/legacy)
    const effectiveColor = isUser ? (
        nodeData.authorColor ||
        (nodeData.authorName === me?.name ? me?.color : getFallbackColor(nodeData.authorName || 'Guest'))
    ) : undefined;

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

    // --- MINIMALIST IMAGE VIEW ---
    if (nodeData.fileUrl) {
        return (
            <div
                onClick={handleClick}
                onDoubleClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(
                    'relative group transition-all duration-300 ease-in-out rounded-2xl',
                    'shadow-lg hover:shadow-2xl',
                    // Minimal selection indicator (no heavy ring)
                    selected ? 'scale-[1.02] shadow-2xl ring-1 ring-primary/30' : 'hover:scale-[1.01]'
                )}
            >
                <img
                    src={nodeData.fileUrl}
                    alt={nodeData.fileName}
                    className="rounded-2xl border border-border/50 max-w-[300px] max-h-[400px] object-cover bg-black/5 dark:bg-white/5"
                />

                {/* Media Type Badge (PDF & Images) */}
                {(() => {
                    const isPdf = nodeData.mimeType === 'application/pdf';
                    const isImage = nodeData.mimeType?.startsWith('image/');

                    if (!isPdf && !isImage) return null;

                    // Determine label
                    let label = 'FILE';
                    if (isPdf) label = 'PDF';
                    else if (nodeData.fileName) {
                        const ext = nodeData.fileName.split('.').pop();
                        if (ext) label = ext.toUpperCase();
                    }

                    const BadgeIcon = isPdf ? FileText : ImageIcon;

                    return (
                        <div className="absolute top-3 right-3 flex items-center gap-1 group/badge z-20">
                            {/* The label (visible on hover) */}
                            <div className="opacity-0 group-hover/badge:opacity-100 transition-all duration-200 bg-primary text-primary-foreground px-2 h-8 rounded-lg shadow-md backdrop-blur-md flex items-center justify-center border border-white/10 font-bold text-[11px] transform translate-x-2 group-hover/badge:translate-x-0 pointer-events-none whitespace-nowrap">
                                {label}
                            </div>

                            {/* The Icon */}
                            <div className="bg-primary text-primary-foreground w-8 h-8 rounded-lg shadow-md backdrop-blur-md flex items-center justify-center border border-white/10 transition-transform hover:scale-105 cursor-default shrink-0">
                                <BadgeIcon className="h-4 w-4" />
                            </div>
                        </div>
                    );
                })()}

                {/* Handles - Global Visibility on Connect & Border Straddling */}
                {(() => {
                    const activeConnection = useCanvasStore((state) => state.activeConnection);
                    // Hit area: Large invisible square for easier targeting
                    const hitAreaClass = "!w-10 !h-10 !bg-transparent !border-0 flex items-center justify-center group/handle z-50";

                    const renderHandle = (type: 'source' | 'target', position: Position, handleId: string, offsetClass: string) => {
                        const isActive = activeConnection?.nodeId === id && activeConnection?.handleId === handleId;
                        return (
                            <Handle
                                type={type}
                                position={position}
                                id={handleId}
                                className={cn(hitAreaClass, offsetClass)}
                            >
                                <div className={cn(
                                    "w-3 h-3 bg-primary border-2 border-background rounded-full transition-all duration-200 pointer-events-none",
                                    isActive ? "opacity-100 scale-110" : "opacity-0 group-hover/handle:opacity-100 group-hover/handle:scale-150"
                                )} />
                            </Handle>
                        );
                    };

                    return (
                        <>
                            {renderHandle('target', Position.Top, 't', "-top-5")}
                            {renderHandle('source', Position.Bottom, 'b', "-bottom-5")}
                            {renderHandle('target', Position.Left, 'l', "-left-5")}
                            {renderHandle('source', Position.Right, 'r', "-right-5")}
                        </>
                    );
                })()}
            </div>
        );
    }

    // --- STANDARD CONVERSATION BUBBLE ---
    return (
        <div
            onClick={handleClick}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                'group bg-background/40 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out relative',
                'hover:shadow-2xl',
                'w-[450px]',
                !selected && !isHovered && nodeData.hasChildren && isAssistant && 'w-[250px]',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                (isHovered || selected) && 'shadow-2xl ring-1 ring-primary/20',
                nodeData.isGenerating && 'animate-pulse'
            )}
            style={isUser && effectiveColor ? {
                borderColor: `${effectiveColor}33`, // 20% opacity
                background: `linear-gradient(to bottom right, ${effectiveColor}15, ${effectiveColor}05)`, // 8%, 2%
                boxShadow: isHovered || selected ? `0 10px 30px -10px ${effectiveColor}33` : undefined // Colored shadow on hover
            } : {}}
        >

            <div className={cn(
                'flex items-center gap-3 px-6 py-3.5 rounded-t-xl transition-all duration-300',
                isAssistant && 'bg-gradient-to-b from-muted-foreground/10 via-muted/5 to-transparent', // Grayish hint at top
            )}
                style={isUser && effectiveColor ? {
                    background: `linear-gradient(to bottom, ${effectiveColor}1a, ${effectiveColor}05)`, // 10% to 2% gradient
                } : {}}
            >
                <div
                    className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ring-1 ring-white/10 shrink-0",
                        isAssistant && "bg-primary" // Default primary for assistant
                    )}
                    style={isUser && effectiveColor ? {
                        backgroundColor: effectiveColor
                    } : {}}
                >
                    {isAssistant ? (() => {
                        const persona = PERSONAS.find(p => p.id === (nodeData.selectedPersonaId || 'standard'));
                        const IconComponent = (() => {
                            switch (persona?.icon) {
                                case 'Search': return Search;
                                case 'CheckSquare': return CheckSquare;
                                case 'Zap': return Zap;
                                case 'TrendingUp': return TrendingUp;
                                case 'Heart': return Heart;
                                case 'Sparkles': return Sparkles;
                                case 'Settings': return Settings;
                                default: return Bot;
                            }
                        })();
                        return <IconComponent className="h-4 w-4" />;
                    })() : (
                        <span className="leading-none">
                            {(nodeData.authorName || 'Guest').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </span>
                    )}
                </div>
                <span className="text-sm font-medium text-muted-foreground truncate">
                    {isUser ? (
                        nodeData.authorName || 'Guest'
                    ) : (
                        nodeData.selectedPersonaId === 'custom'
                            ? nodeData.customPersona?.name || 'Custom Agent'
                            : (nodeData.selectedPersonaId
                                ? (PERSONAS.find(p => p.id === nodeData.selectedPersonaId)?.shortLabel === 'Standard AI' ? 'Answer' : PERSONAS.find(p => p.id === nodeData.selectedPersonaId)?.shortLabel || 'Answer')
                                : 'Answer')
                    )}
                </span>
                {
                    nodeData.isGenerating && (
                        <Sparkles className="h-4 w-4 text-yellow-500 animate-spin ml-auto" />
                    )
                }
            </div>

            {
                nodeData.branchContext && (
                    <div className="px-6 py-4 bg-blue-500/5 border-b border-blue-500/10 flex items-center gap-4 group transition-colors hover:bg-blue-500/10">
                        <GitBranch className="h-4 w-4 text-blue-500 shrink-0" />
                        <p className="text-[15px] text-foreground leading-relaxed font-medium">
                            {nodeData.branchContext}
                        </p>
                    </div>
                )
            }

            <div className="p-0 relative nodrag cursor-auto">
                {isEditing || (selected && !isAssistant) ? (
                    <textarea
                        ref={textareaRef}
                        autoFocus
                        defaultValue={nodeData.content}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full min-h-[100px] bg-transparent border-none outline-none resize-none text-[15px] leading-[1.65] px-6 pt-2 pb-14"
                        placeholder={!nodeData.parentId ? "Welcome to Numi ! Type your idea or ask for help ..." : "Type your message here..."}
                    />
                ) : (

                    <div
                        ref={contentRef}
                        onMouseUp={handleMouseUp}
                        onClick={(e) => {
                            e.stopPropagation();
                            selectNode(id);
                            if (isUser && !nodeData.fileUrl) setIsEditing(true);
                        }}
                        onDoubleClick={handleDoubleClick}
                        className={cn(
                            'prose-notion select-text cursor-text px-6 pt-2 pb-14 min-h-[100px] nopan nodrag nowheel',
                            !nodeData.content && !nodeData.fileUrl && 'text-muted-foreground italic',
                            !selected && !isHovered && nodeData.hasChildren && isAssistant && "max-h-[120px] overflow-hidden"
                        )}
                        style={!selected && !isHovered && nodeData.hasChildren && isAssistant ? {
                            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                            maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
                        } : {}}
                    >
                        {
                            nodeData.content ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        p: ({ node, ...props }) => <p {...props} className="mb-4 last:mb-0" />,
                                    }}
                                >
                                    {(() => {
                                        let content = nodeData.content;
                                        const branchedTexts = ((nodeData as any).branchedTexts as string[]) || [];

                                        // Sort by length descending to avoid partial matches
                                        const sortedBranches = [...new Set(branchedTexts)].sort((a, b) => b.length - a.length);

                                        sortedBranches.forEach(branch => {
                                            if (!branch || typeof branch !== 'string' || !branch.trim()) return;
                                            // Escaping regex special characters
                                            const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                            // Use 'gi' flags for global and case-insensitive matching
                                            const regex = new RegExp(`(${escaped})`, 'gi');
                                            content = content.replace(regex, '<span class="branched-highlight">$1</span>');
                                        });
                                        return content;
                                    })()}
                                </ReactMarkdown>
                            ) : (
                                isUser ? (!nodeData.parentId ? "Welcome to Numi ! Type your idea or ask for help ..." : "Click to type...") : 'Generating...'
                            )
                        }
                        {!selected && !isHovered && nodeData.hasChildren && isAssistant && (
                            <div className="absolute bottom-1 left-0 right-0 flex justify-center pb-1 pointer-events-none">
                                <div className="h-1.5 w-8 rounded-full bg-muted-foreground/30 animate-pulse" />
                            </div>
                        )}
                    </div>
                )}

                {/* Generate Button for User Nodes */}
                {isUser && (isEditing || nodeData.content.trim().length > 0 || selected) && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-2 justify-end z-10 transition-opacity">
                        <Select
                            value={nodeData.selectedPersonaId || 'standard'}
                            onValueChange={(value) => {
                                updateNode(id, { selectedPersonaId: value });
                                // Initialize custom persona if first time
                                if (value === 'custom' && !nodeData.customPersona) {
                                    updateNode(id, {
                                        customPersona: {
                                            name: 'Expert',
                                            systemPrompt: 'You are a deep expert in this specific topic.',
                                            description: 'Deep domain expertise'
                                        }
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-7 w-[100px] text-[10px] font-bold bg-background border-input shadow-sm backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                                <SelectValue placeholder="Agent" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                                {PERSONAS.map(persona => (
                                    <SelectItem key={persona.id} value={persona.id} className="text-[10px]">
                                        {persona.id === 'custom' ? (
                                            <div className="flex items-center justify-between w-full gap-2">
                                                <span>{persona.shortLabel}</span>
                                                <Plus className="h-3 w-3 opacity-70" />
                                            </div>
                                        ) : (
                                            persona.shortLabel
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {nodeData.selectedPersonaId === 'custom' && (
                            <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 bg-background shadow-sm"
                                onClick={() => setIsEditingPersona(true)}
                                title="Edit Custom Agent"
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}

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


            {/* Handles - Global Visibility on Connect & Border Straddling */}
            {(() => {
                const activeConnection = useCanvasStore((state) => state.activeConnection);
                // Hit area: Large invisible square for easier targeting
                const hitAreaClass = "!w-10 !h-10 !bg-transparent !border-0 flex items-center justify-center group/handle z-50";

                const renderHandle = (type: 'source' | 'target', position: Position, handleId: string, offsetClass: string) => {
                    const isActive = activeConnection?.nodeId === id && activeConnection?.handleId === handleId;
                    return (
                        <Handle
                            type={type}
                            position={position}
                            id={handleId}
                            className={cn(hitAreaClass, offsetClass)}
                        >
                            <div className={cn(
                                "w-3 h-3 bg-primary border-2 border-background rounded-full transition-all duration-200 pointer-events-none",
                                isActive ? "opacity-100 scale-110" : "opacity-0 group-hover/handle:opacity-100 group-hover/handle:scale-150"
                            )} />
                        </Handle>
                    );
                };

                return (
                    <>
                        {renderHandle('target', Position.Top, 't', "-top-5")}
                        {renderHandle('source', Position.Bottom, 'b', "-bottom-5")}
                        {renderHandle('target', Position.Left, 'l', "-left-5")}
                        {renderHandle('source', Position.Right, 'r', "-right-5")}
                    </>
                );
            })()}

            {/* Custom Agent Editor Dialog */}
            <Dialog open={isEditingPersona} onOpenChange={setIsEditingPersona}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Personnaliser l'Agent</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nom de l'Agent</label>
                            <Input
                                value={nodeData.customPersona?.name || ''}
                                onChange={(e) => updateNode(id, {
                                    customPersona: { ...(nodeData.customPersona || { name: 'Expert', systemPrompt: '', description: '' }), name: e.target.value }
                                })}
                                placeholder="ex: Expert React"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">But / Description</label>
                            <Input
                                value={nodeData.customPersona?.description || ''}
                                onChange={(e) => updateNode(id, {
                                    customPersona: { ...(nodeData.customPersona || { name: 'Expert', systemPrompt: '', description: '' }), description: e.target.value }
                                })}
                                placeholder="ex: Analyse le code et propose des optimisations"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Instructions (Prompt Système)</label>
                            <textarea
                                value={nodeData.customPersona?.systemPrompt || ''}
                                onChange={(e) => updateNode(id, {
                                    customPersona: { ...(nodeData.customPersona || { name: 'Expert', systemPrompt: '', description: '' }), systemPrompt: e.target.value }
                                })}
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                placeholder="Indique à l'IA comment elle doit se comporter..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsEditingPersona(false)}>Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

const ConversationNode = memo(ConversationNodeComponent);
ConversationNode.displayName = 'ConversationNode';

export default ConversationNode;
