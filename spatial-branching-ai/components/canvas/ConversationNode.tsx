'use client';

import { memo, useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { useCanvasStore, ConversationNodeData, USER_COLORS } from '@/lib/stores/canvas-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useChat } from '@/lib/hooks/useChat';
import { Bot, User, Sparkles, Copy, GitBranch, Send, Reply, ArrowRight, Scissors, Image as ImageIcon, FileText, Plus, Pencil, Search, CheckSquare, Zap, TrendingUp, Heart, Settings, Play, FileAudio, FileVideo, X, AudioLines, Maximize2, Palette, Loader2 } from 'lucide-react';
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

// --- MEMOIZED SUB-COMPONENTS ---

const MarkdownContent = memo(({ content, branchedTexts }: { content: string, branchedTexts: string[] }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
                p: ({ ...props }) => <p {...props} className="mb-4 last:mb-0" />,
            }}
        >
            {(() => {
                let processedContent = content;
                const sortedBranches = [...new Set(branchedTexts)].sort((a, b) => b.length - a.length);

                sortedBranches.forEach(branch => {
                    if (!branch || typeof branch !== 'string' || !branch.trim()) return;
                    const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(${escaped})`, 'gi');
                    processedContent = processedContent.replace(regex, '<span class="branched-highlight">$1</span>');
                });
                return processedContent;
            })()}
        </ReactMarkdown>
    );
});
MarkdownContent.displayName = 'MarkdownContent';

const NodeHandles = memo(({ id }: { id: string }) => {
    const activeConnection = useCanvasStore(useShallow(state => state.activeConnection));
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
});
NodeHandles.displayName = 'NodeHandles';



function ConversationNodeComponent(props: NodeProps) {
    const { id, data, selected } = props;
    const nodeData = data as ConversationNodeData;
    const { theme, userName } = useSettingsStore(useShallow(s => ({ theme: s.theme, userName: s.userName })));
    const { setCenter } = useReactFlow();

    const contentRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingPersona, setIsEditingPersona] = useState(false);

    const {
        updateNode,
        setTextSelection,
        selectNode,
        setContextMenu,
        createChildNode,
        setReadingNodeId,
        deleteNode,
        meName,
        meColor
    } = useCanvasStore(useShallow((state) => ({
        updateNode: state.updateNode,
        setTextSelection: state.setTextSelection,
        selectNode: state.selectNode,
        setContextMenu: state.setContextMenu,
        createChildNode: state.createChildNode,
        setReadingNodeId: state.setReadingNodeId,
        deleteNode: state.deleteNode,
        meName: state.me?.name,
        meColor: state.me?.color
    })));
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
        (nodeData.authorName === meName ? meColor : getFallbackColor(nodeData.authorName || 'Guest'))
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

            // Prevent the click handler from deselecting or interfering
            e.stopPropagation();
        }
    }, [id, setTextSelection, setContextMenu]);


    // Auto-enter edit mode when selected (User nodes only)
    useEffect(() => {
        if (selected && isUser && !nodeData.fileUrl) {
            setIsEditing(true);
        }
    }, [selected, isUser, nodeData.fileUrl]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(id);
        // setIsEditing handled by effect above
    }, [id, selectNode]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isUser) {
            setIsEditing(true);
        }
    }, [isUser]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        // Only exit editing if we actually clicked outside (handled by canvas click usually clearing selection)
        // But for local state, if we lose focus but are still selected, we might want to stay in edit mode?
        // User wants "pre-cliqué par defaut".
        // Let's keep strict standard behavior: Blur -> stop editing visually?
        // No, if I click 'Save' or 'Generate', that's different.
        // Let's stick to: Blur updates content, but if selected, the effect might re-trigger?
        // No, effect runs on dependency change.
        setIsEditing(false);
        updateNode(id, { content: e.target.value });
    }, [id, updateNode]);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setIsEditing(false);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();

            const content = e.currentTarget.value;
            updateNode(id, { content });
            setIsEditing(false);

            if (!content.trim()) return;

            const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
            if (parentNode) {
                const newPos = {
                    x: parentNode.position.x + 50,
                    y: parentNode.position.y + 200
                };
                const childId = createChildNode(id, newPos);
                selectNode(childId); // Switch focus to new node

                // Pan to new node (Center logic: x + half_width, y + visual_offset)
                setCenter(newPos.x + 225, newPos.y + 100, { zoom: 1, duration: 1200 });

                try {
                    await generate(childId);
                } catch (err) {
                    console.error("Generation failed", err);
                }
            }
        }
    }, [id, updateNode, createChildNode, generate, selectNode]);

    // Manual generation handler
    const handleGenerate = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Sync content from textarea if currently editing
        let currentContent = nodeData.content;
        if (isEditing && textareaRef.current) {
            currentContent = textareaRef.current.value;
            updateNode(id, { content: currentContent });
            setIsEditing(false); // Also close editor on button click
        }

        if (!isUser || !currentContent.trim()) return;

        const parentNode = useCanvasStore.getState().nodes.find(n => n.id === id);
        if (parentNode) {
            const newPos = {
                x: parentNode.position.x + 50,
                y: parentNode.position.y + 200
            };
            const childId = createChildNode(id, newPos);
            selectNode(childId);

            // Pan to new node
            setCenter(newPos.x + 225, newPos.y + 100, { zoom: 1, duration: 1200 });

            try {
                await generate(childId);
            } catch (err) {
                console.error("Generation failed", err);
            }
        }
    }, [id, nodeData.content, isEditing, updateNode, isUser, createChildNode, generate, selectNode]);

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

    // --- MINIMAL MEDIA VIEW (Image / Audio / Video) ---
    if (nodeData.fileUrl) {
        const isPdf = nodeData.mimeType === 'application/pdf';
        const isImage = nodeData.mimeType?.startsWith('image/');
        const isAudio = nodeData.mimeType?.startsWith('audio/');
        const isVideo = nodeData.mimeType?.startsWith('video/');

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
                style={{
                    width: nodeData.width ?? undefined,
                    height: nodeData.height ?? undefined,
                    minWidth: '200px',
                    minHeight: '100px'
                }}
            >
                <NodeResizer
                    color="#3b82f6"
                    isVisible={selected}
                    minWidth={200}
                    minHeight={100}
                    onResizeEnd={(_, params) => {
                        updateNode(id, { width: params.width, height: params.height });
                    }}
                />
                {/* Media Content */}
                {isImage || isPdf ? (
                    <img
                        src={nodeData.fileUrl}
                        alt={nodeData.fileName}

                        className="rounded-2xl border border-white/10 w-full h-full object-cover bg-black/2 dark:bg-white/2 backdrop-blur-sm"
                    />
                ) : isAudio ? (
                    <div className="w-[370px] h-20 bg-background/60 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center p-4 pr-16 shadow-sm">
                        <audio
                            controls
                            src={nodeData.fileUrl}
                            className="w-full h-10 accent-primary"
                        />
                    </div>
                ) : isVideo ? (
                    <div
                        className="relative rounded-2xl overflow-hidden border border-white/10 max-w-[320px] bg-black"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsVideoModalOpen(true);
                        }}
                    >
                        <video
                            src={nodeData.fileUrl}
                            className="w-full h-auto max-h-[400px] object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            muted
                            preload="metadata"
                        />
                        {/* Play Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/20 shadow-xl group-hover:scale-110 transition-transform">
                                <Play className="h-6 w-6 text-white fill-white" />
                            </div>
                        </div>

                        {/* Fullscreen Video Modal */}
                        <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
                            <DialogContent className="max-w-[90vw] w-fit bg-transparent border-none p-0 shadow-2xl flex items-center justify-center outline-none">
                                <DialogTitle className="sr-only">Video Player</DialogTitle>

                                {/* Close Button - Detached & Large */}
                                <button
                                    onClick={() => setIsVideoModalOpen(false)}
                                    className="absolute -top-12 -right-12 z-[10000] text-white/80 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 backdrop-blur-md transition-all scale-100 hover:scale-110"
                                    title="Close Video"
                                >
                                    <X className="h-8 w-8" />
                                </button>

                                <video
                                    src={nodeData.fileUrl}
                                    controls
                                    autoPlay
                                    className="max-w-[90vw] max-h-[80vh] rounded-lg shadow-2xl outline-none"
                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking video controls
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : (
                    // Fallback
                    <div className="p-4 bg-muted rounded-2xl border flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4" />
                        <span>Unsupported File</span>
                    </div>
                )}

                {/* Media Type Badge */}
                {(() => {
                    let label = 'FILE';
                    let BadgeIcon = FileText;

                    if (isPdf) { label = 'PDF'; BadgeIcon = FileText; }
                    else if (isImage) { label = nodeData.fileName?.split('.').pop()?.toUpperCase() || 'IMG'; BadgeIcon = ImageIcon; }
                    else if (isAudio) { label = 'AUDIO'; BadgeIcon = AudioLines; }
                    else if (isVideo) { label = 'VIDEO'; BadgeIcon = FileVideo; }
                    else return null;

                    return (
                        <div className={cn(
                            "absolute flex items-center gap-1 z-20",
                            isAudio ? "top-1/2 -translate-y-1/2 right-4" : "top-3 right-3"
                        )}>
                            <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <div className="bg-primary text-primary-foreground w-8 h-8 rounded-lg shadow-md backdrop-blur-md flex items-center justify-center border border-white/10 transition-transform hover:scale-105 shrink-0 cursor-default">
                                            <BadgeIcon className="h-4 w-4" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side={isAudio ? "right" : "left"} className="bg-zinc-950 text-white border-0 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-xl tracking-wide max-w-[200px] truncate">
                                        {nodeData.fileName}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    );
                })()}

                {/* Handles - Global Visibility on Connect & Border Straddling */}
                <NodeHandles id={id} />
            </div>
        );
    }

    // --- IMAGE GENERATING PILL ---
    if (nodeData.isGenerating && nodeData.generationType === 'image') {
        return (
            <div className="absolute top-0 left-0">
                <div
                    className={cn(
                        'relative group transition-all duration-300 ease-in-out rounded-2xl',
                        'shadow-lg hover:shadow-xl p-4 bg-muted border border-border flex items-center gap-3',
                        selected && 'ring-1 ring-primary/30'
                    )}
                >
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">Generating image...</span>
                    {/* Handles - Global Visibility on Connect & Border Straddling */}
                    <NodeHandles id={id} />
                </div>
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
                'group bg-background/40 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm backdrop-blur-md transition-all duration-500 ease-out relative',
                'hover:shadow-xl hover:-translate-y-0.5',
                'w-[450px]',
                !selected && !isHovered && nodeData.hasChildren && 'w-[250px]',
                selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                (isHovered || selected) && 'ring-1 ring-primary/20',
                nodeData.isGenerating && 'animate-pulse'
            )}
            // Framer Motion layoutId for Reader View transition
            // @ts-ignore - passing through to motion.div if we were using it, but here just DOM ID matching logic
            id={`node-content-source-${id}`}
            style={isUser && effectiveColor ? {
                borderColor: `${effectiveColor}20`, // Even more subtle color border
                background: `linear-gradient(to bottom right, ${effectiveColor}10, ${effectiveColor}03)`, // Very faint tint
                boxShadow: isHovered || selected ? `0 12px 40px -12px ${effectiveColor}25` : undefined
            } : {}}
        >
            {/* Invisible Top Drag Handle - High Z-Index to ensure catch */}
            <div className="absolute inset-x-0 top-0 h-12 z-30 cursor-grab active:cursor-grabbing" />

            {/* Draggable Handle Gradient (Assistant Only) */}
            <div className={cn(
                'absolute inset-x-0 top-0 h-14 rounded-t-2xl transition-all duration-300 z-0',
                isAssistant && 'bg-gradient-to-b from-muted-foreground/5 via-muted/5 to-transparent'
            )} />

            {/* Floating User/Bot Icon */}
            <div className="absolute top-2 left-2 z-40">
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <div
                                className={cn(
                                    "h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ring-1 ring-white/10 shrink-0 overflow-hidden",
                                    isAssistant && "bg-primary",
                                    // Override background for Numi Standard to be black to match the logo file
                                    isAssistant && !nodeData.selectedPersonaId && "bg-black"
                                )}
                                style={isUser && effectiveColor ? {
                                    backgroundColor: effectiveColor
                                } : {}}
                            >
                                {isAssistant ? (() => {
                                    const personaId = nodeData.selectedPersonaId || 'standard';

                                    // Special Case: Generated Image
                                    if (nodeData.isGenerated) {
                                        return <Palette className="h-4 w-4 text-white" />;
                                    }

                                    // Special Case for Standard: Numi Logo
                                    if (personaId === 'standard') {
                                        return (
                                            <img
                                                src="/assets/logo/logo-black-bg.png"
                                                alt="Numi"
                                                className="h-full w-full object-cover"
                                            />
                                        );
                                    }

                                    const persona = PERSONAS.find(p => p.id === personaId);
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
                                    return <IconComponent className="h-3.5 w-3.5" />;
                                })() : (
                                    <span className="leading-none">
                                        {(nodeData.authorName || 'Guest').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10} className="bg-zinc-950 text-white border-0 text-[10px] font-bold px-3 py-1.5 rounded-md shadow-xl tracking-wide">
                            {isUser ? (
                                nodeData.authorName || 'Guest'
                            ) : (
                                nodeData.selectedPersonaId === 'custom'
                                    ? nodeData.customPersona?.name || 'Custom Agent'
                                    : (nodeData.selectedPersonaId
                                        ? (PERSONAS.find(p => p.id === nodeData.selectedPersonaId)?.shortLabel === 'Standard AI' ? 'Answer' : PERSONAS.find(p => p.id === nodeData.selectedPersonaId)?.shortLabel || 'Answer')
                                        : 'Answer')
                            )}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {
                nodeData.isGenerating && (
                    <div className="absolute top-3 right-3 z-20">
                        <Sparkles className="h-4 w-4 text-yellow-500 animate-spin" />
                    </div>
                )
            }

            {
                nodeData.branchContext && (
                    <div className="mt-10 px-6 py-3 bg-blue-500/5 border-b border-blue-500/10 flex items-center gap-4 group transition-colors hover:bg-blue-500/10 relative z-10">
                        <GitBranch className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <p className="text-[13px] text-foreground/80 leading-relaxed font-medium">
                            {nodeData.branchContext}
                        </p>
                    </div>
                )
            }

            <div className="p-0 relative nodrag cursor-auto">
                {isEditing || (selected && !isAssistant) ? (
                    <textarea
                        ref={(el) => {
                            // @ts-ignore
                            textareaRef.current = el;
                            if (el && isEditing) {
                                // Smart cursor positioning: end of text
                                el.setSelectionRange(el.value.length, el.value.length);
                                el.focus();
                            }
                        }}
                        autoFocus
                        defaultValue={nodeData.content}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "w-full min-h-[100px] bg-transparent border-none outline-none resize-none text-[15px] leading-[1.65] px-6 pb-14 placeholder:italic placeholder:text-muted-foreground/70",
                            nodeData.branchContext ? "pt-5" : "pt-12" // Add top padding if no branch context to clear icon
                        )}
                        placeholder={!nodeData.parentId ? "Plant your idea ..." : "Type your message here..."}
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
                            'prose-notion select-text cursor-text nopan nodrag nowheel',
                            // Padding Logic: Collapsed = minimal padding / Expanded = standard padding
                            (!selected && !isHovered && nodeData.hasChildren && !nodeData.fileUrl)
                                ? "px-6 py-4 line-clamp-1 min-h-0 h-auto"
                                : cn("px-6 pb-14 min-h-[100px]", nodeData.branchContext ? "pt-5" : "pt-12"),

                            !nodeData.content && !nodeData.fileUrl && 'text-muted-foreground/70 italic'
                        )}
                        style={{}}
                    >
                        {
                            nodeData.content ? (
                                <MarkdownContent
                                    content={nodeData.content}
                                    branchedTexts={(nodeData as any).branchedTexts || []}
                                />
                            ) : (
                                isUser ? (!nodeData.parentId ? "Plant your idea ..." : "Click to type...") : 'Generating...'
                            )
                        }
                        {!selected && !isHovered && nodeData.hasChildren && (
                            <div className="absolute bottom-1 left-0 right-0 flex justify-center pb-1 pointer-events-none">
                                <div className="h-1.5 w-8 rounded-full bg-muted-foreground/30 animate-pulse" />
                            </div>
                        )}
                    </div>
                )}

                {/* Generate Button for User Nodes */}
                {isUser && (isEditing || nodeData.content.trim().length > 0 || selected) && (
                    <div
                        className="absolute bottom-2 right-2 flex items-center gap-1 justify-end z-10 transition-opacity"
                        onPointerDown={(e) => {
                            // Prevent blur when clicking buttons in this toolbar
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
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
                            <SelectTrigger className="h-7 w-auto min-w-[60px] max-w-[120px] gap-0.5 px-2 text-[10px] font-bold bg-transparent border-none shadow-none text-muted-foreground hover:text-foreground transition-colors justify-start">
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
                            onClick={handleGenerate}
                            className="bg-primary text-primary-foreground p-2 rounded-lg shadow-md hover:bg-primary/90 transition-all flex items-center justify-center h-8 w-8 ml-1"
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
                            className="bg-accent text-accent-foreground p-2 rounded-lg shadow-md hover:bg-accent/90 transition-all flex items-center justify-center h-8 w-8 border border-border"
                            title="Reply"
                        >
                            <Reply className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-1 z-50">
                {isAssistant && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setReadingNodeId(id);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/60 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-foreground transition-all p-0 leading-none"
                        title="Reader Mode"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Confirm delete? Or just delete? "Serene" usually implies undoable, but let's just delete for now.
                        // Store has undo (zundo), so accidental delete is fine.
                        deleteNode(id);
                    }}
                    className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/60 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-500 transition-all p-0 leading-none"
                    title="Delete Node"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>


            {/* Handles - Global Visibility on Connect & Border Straddling */}
            <NodeHandles id={id} />

            {/* Custom Agent Editor Dialog - Lazy Rendered */}
            {isEditingPersona && (
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
            )}
        </div>
    );
}

const ConversationNode = memo(ConversationNodeComponent);
ConversationNode.displayName = 'ConversationNode';

export default ConversationNode;
