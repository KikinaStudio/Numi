'use client';

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    BackgroundVariant,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    NodeTypes,
    PanOnScrollMode,
} from '@xyflow/react';
import { useCanvasStore, useNodes, useEdges, ConversationNodeData, useTemporalStore } from '@/lib/stores/canvas-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import ConversationNode from './ConversationNode';
import NodeContextMenu from './NodeContextMenu';
import SimpleFloatingEdge from './SimpleFloatingEdge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Cloud, Check, Loader2, AlertCircle, FolderOpen, FilePlus, Home, Settings, Share2, Users, MousePointerClick, Lock, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/lib/hooks/useChat';
import { usePersistence } from '@/lib/hooks/usePersistence';
import { supabase } from '@/lib/supabase/client';
import { TreeListDialog } from './TreeListDialog';
import { SettingsDialog } from '@/components/ui/settings-dialog';
import { UserOnboardingModal } from './UserOnboardingModal';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { CollaboratorCursor } from './CollaboratorCursor';
import { convertPdfToImages } from '@/lib/utils/pdf-processor';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Define custom node types
const nodeTypes: NodeTypes = {
    conversation: ConversationNode,
};
const edgeTypes = {
    floating: SimpleFloatingEdge,
};

// Context menu state type
interface ContextMenuState {
    x: number;
    y: number;
    nodeId: string;
}

function Canvas() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { theme } = useSettingsStore();
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useNodes();
    const edges = useEdges();
    const {
        onNodesChange,
        onEdgesChange,
        onConnect,
        createRootNode,
        createChildNode,
        selectNode,
        deleteNode,
        clearCanvas,
        treeName,
        setTreeName,
        textSelection,
        setTextSelection,
        contextMenu,
        setContextMenu,
        syncStatus,
        syncError,
        collaborators,
        treeId,
        ownerId,
    } = useCanvasStore();

    // Compute hasChildren and branchedTexts for nodes to enable compact view and highlighting
    const nodesWithMetadata = useMemo(() => {
        const parentIds = new Set(edges.map(e => e.source));

        // Group branchContexts by parentId
        const branchContextsMap = new Map<string, string[]>();
        edges.forEach(edge => {
            const childNode = nodes.find(n => n.id === edge.target);
            if (childNode?.data?.branchContext) {
                const contexts = branchContextsMap.get(edge.source) || [];
                contexts.push(childNode.data.branchContext);
                branchContextsMap.set(edge.source, contexts);
            }
        });

        return nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                hasChildren: parentIds.has(n.id),
                branchedTexts: branchContextsMap.get(n.id) || []
            }
        }));
    }, [nodes, edges]);

    // Keyboard Shortcuts (Undo)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                // Access temporal store directly
                const temporal = useCanvasStore.temporal;
                if (temporal) {
                    temporal.getState().undo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    // Persistence hook for auto-saving
    const { saveTree } = usePersistence();
    const isLoading = useCanvasStore(s => s.isLoading);

    const [showTreeList, setShowTreeList] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showShareToast, setShowShareToast] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // AI Chat hook for generating responses
    const { generate } = useChat();

    // Generate or load persistent identity for collaboration
    useEffect(() => {
        const settings = useSettingsStore.getState();
        const storedId = settings.userId;
        const storedColor = settings.userColor;
        const storedName = settings.userName;

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const names = ['Artiste', 'Explorateur', 'Architecte', 'Penseur', 'Visionnaire', 'Guide'];

        const finalId = storedId || Math.random().toString(36).substring(7);
        const finalColor = storedColor || colors[Math.floor(Math.random() * colors.length)];
        const finalName = storedName || names[Math.floor(Math.random() * names.length)];

        // Persist if new
        if (!storedId || !storedColor) {
            settings.setUserDetails({ id: finalId, color: finalColor });
        }

        const meObject = {
            id: finalId,
            name: finalName,
            color: finalColor,
            mousePos: null,
            lastActive: Date.now()
        };

        useCanvasStore.getState().setMe(meObject);
        useCanvasStore.getState().updateCollaborator(finalId, meObject);

        // Explicitly show onboarding if name was never set by user
        if (!storedName) {
            setShowOnboarding(true);
        }
    }, []);

    // Sync 'me' name when userName changes in settings
    const userName = useSettingsStore(s => s.userName);
    const setMe = useCanvasStore(s => s.setMe);
    const updateCollaborator = useCanvasStore(s => s.updateCollaborator);
    const me = useCanvasStore(s => s.me);
    const isOwner = useMemo(() => {
        if (!treeId || !ownerId) return true; // Newly created tree or legacy tree without owner
        return me?.id === ownerId;
    }, [treeId, ownerId, me?.id]);

    useEffect(() => {
        if (me && userName && me.name !== userName) {
            const updatedMe = { ...me, name: userName };
            setMe(updatedMe);
            updateCollaborator(me.id, updatedMe);
        }
    }, [userName, me, setMe, updateCollaborator]);

    // Handle cursor movement
    const lastMousePosUpdate = useRef<number>(0);
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!me) return;
        const now = Date.now();
        // Increased update rate to ~30fps (33ms) for smoother feel
        if (now - lastMousePosUpdate.current < 30) return;

        // Important: We send "Flow" coordinates (world space), not screen space
        // This allows cursors to stay fixed relative to the content when panning
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

        const updatedMe = { ...me, mousePos: pos };
        setMe(updatedMe);
        updateCollaborator(me.id, updatedMe);
        lastMousePosUpdate.current = now;
    }, [me, setMe, updateCollaborator, screenToFlowPosition]);
    // Handle pane click - create root node or clear selection
    const onPaneClick = useCallback(() => {
        selectNode(null);
        setTextSelection(null);
        setContextMenu(null);
    }, [selectNode, setTextSelection]);

    // Handle double click on pane - create root node
    const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });
        createRootNode(position);
    }, [screenToFlowPosition, createRootNode]);

    // Handle context menu on nodes
    const onNodeContextMenu = useCallback((event: React.MouseEvent, node: { id: string }) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            nodeId: node.id,
        });
    }, []);

    // Handle context menu actions
    const handleCreateBranch = useCallback(async () => {
        if (!contextMenu) return;

        const parentNode = nodes.find((n) => n.id === contextMenu.nodeId);
        if (!parentNode) return;

        // Position child node below and slightly to the right
        const position = {
            x: parentNode.position.x + 50,
            y: parentNode.position.y + 200,
        };

        // Use text selection as branch context if available
        const branchContext = textSelection?.nodeId === contextMenu.nodeId
            ? textSelection.text
            : undefined;

        const childNodeId = createChildNode(contextMenu.nodeId, position, branchContext);
        setContextMenu(null);
        setTextSelection(null);

        // If parent is a user node, automatically generate AI response
        if (parentNode.data.role === 'user' && parentNode.data.content.trim()) {
            try {
                await generate(childNodeId);
            } catch (error) {
                console.error('Failed to generate response:', error);
            }
        }
    }, [contextMenu, nodes, createChildNode, textSelection, setTextSelection, generate]);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleRegenerate = useCallback(async () => {
        if (!contextMenu) return;
        setContextMenu(null);
        try {
            await generate(contextMenu.nodeId);
        } catch (error) {
            console.error('Failed to regenerate response:', error);
        }
    }, [contextMenu, generate]);

    const handleCopy = useCallback(() => {
        if (!contextMenu) return;
        const node = nodes.find(n => n.id === contextMenu.nodeId);
        if (node?.data?.content) {
            navigator.clipboard.writeText(node.data.content);
        }
        setContextMenu(null);
    }, [contextMenu, nodes]);

    const handleDelete = useCallback(() => {
        if (!contextMenu) return;
        deleteNode(contextMenu.nodeId);
        setContextMenu(null);
    }, [contextMenu, deleteNode, setContextMenu]);

    const handleShare = useCallback(() => {
        if (!treeId) {
            // Trigger a save to generate a tree ID immediately
            saveTree();
            return;
        }
        const url = `${window.location.origin}${window.location.pathname}?treeId=${treeId}`;
        navigator.clipboard.writeText(url);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
    }, [treeId, saveTree]);

    // Default edge options for consistent styling  
    const defaultEdgeOptions = useMemo(() => ({
        type: 'floating',
        animated: false,
        style: {
            stroke: theme === 'dark' ? 'hsl(var(--muted-foreground) / 0.4)' : 'hsl(var(--muted-foreground) / 0.2)',
            strokeWidth: 1.5,
        },
    }), [theme]);

    // Drag & Drop Handler
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDrop = useCallback(async (event: React.DragEvent) => {
        event.preventDefault();

        const file = event.dataTransfer.files[0];
        if (!file) return;

        if (!supabase) {
            alert('Supabase client not initialized. Check your environment variables.');
            return;
        }

        try {
            // Check file type
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';

            if (!isImage && !isPdf) {
                // If it's not a recognized MIME type, strict fail, 
                // but checking "file.name" extension as fallback might be safer if browser issues occur
                if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    alert('Only images and PDFs are supported.');
                    return;
                }
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Handle PDF
            if (isPdf) {
                // 1. Convert PDF to images
                // Note: We might need to handle loading state here as PDF conversion takes time
                const pageImages = await convertPdfToImages(file);
                if (pageImages.length === 0) throw new Error("Could not extract pages from PDF");

                // 2. Upload Original PDF
                const pdfName = `pdfs/${Math.random().toString(36).substring(7)}_${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
                const { error: pdfUploadError } = await supabase.storage
                    .from('files')
                    .upload(pdfName, file);

                if (pdfUploadError) throw pdfUploadError;

                const { data: { publicUrl: pdfUrl } } = supabase.storage
                    .from('files')
                    .getPublicUrl(pdfName);

                // 3. Upload Page Images
                const pageUrls: string[] = [];
                for (let i = 0; i < pageImages.length; i++) {
                    const pageImg = pageImages[i];
                    const pageName = `pages/${Math.random().toString(36).substring(7)}_${Date.now()}_p${i + 1}.jpg`;

                    const { error: pageUploadError } = await supabase.storage
                        .from('files')
                        .upload(pageName, pageImg.blob);

                    if (pageUploadError) throw pageUploadError;

                    const { data: { publicUrl: pageUrl } } = supabase.storage
                        .from('files')
                        .getPublicUrl(pageName);

                    pageUrls.push(pageUrl);
                }

                // 4. Create Node (Previewing Page 1)
                const nodeId = useCanvasStore.getState().createRootNode(position, '');
                useCanvasStore.getState().updateNode(nodeId, {
                    fileUrl: pageUrls[0], // Show first page as preview
                    fileName: file.name,
                    mimeType: file.type,
                    role: 'user',
                    // Store extra metadata for PDF
                    // @ts-ignore - We'll add this to the type definition later
                    pdfUrl: pdfUrl,
                    pdfPages: pageUrls
                });

                return;
            }

            // Handle Image
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
            const filePath = `${treeId || 'temp'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('files')
                .getPublicUrl(filePath);

            // Create Node
            const nodeId = useCanvasStore.getState().createRootNode(position, '');
            useCanvasStore.getState().updateNode(nodeId, {
                fileUrl: publicUrl,
                fileName: file.name,
                mimeType: file.type,
                role: 'user' // Files are user inputs
            });

        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
        }
    }, [screenToFlowPosition, treeId]);

    return (
        <TooltipProvider>
            <div
                ref={reactFlowWrapper}
                className="w-full h-full"
                onDragOver={onDragOver}
                onDrop={onDrop}
            >
                <ReactFlow
                    nodes={nodesWithMetadata}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={(_, params) => {
                        useCanvasStore.getState().setIsConnecting(true);
                        useCanvasStore.getState().setActiveConnection(params);
                    }}
                    onConnectEnd={() => {
                        useCanvasStore.getState().setIsConnecting(false);
                        useCanvasStore.getState().setActiveConnection(null);
                    }}
                    onPointerMove={handlePointerMove}
                    onPaneClick={onPaneClick}
                    onDoubleClick={onPaneDoubleClick}
                    onNodeContextMenu={onNodeContextMenu}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    // Performance & Mobile Optimizations
                    onlyRenderVisibleElements={true}
                    minZoom={0.1}
                    maxZoom={2}
                    proOptions={{ hideAttribution: true }}

                    // Interaction Settings
                    snapToGrid
                    snapGrid={[20, 20]}
                    panOnScroll
                    panOnDrag
                    selectionOnDrag={false}
                    zoomOnScroll={false}
                    zoomOnDoubleClick={false}
                    zoomOnPinch
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={20}
                        size={1}
                        color={theme === 'dark' ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--muted-foreground) / 0.15)"}
                    />
                    <Controls
                        className="!bg-card !border !border-border !rounded-lg !shadow-lg"
                        showInteractive={false}
                    />
                    <MiniMap
                        className="!bg-card/80 !border !border-border !rounded-lg !shadow-lg backdrop-blur-sm"
                        nodeColor={(node) => {
                            const data = node.data as ConversationNodeData;
                            if (data.fileUrl) return 'hsl(240 3.8% 46.1%)'; // Zinc-500 for files (Nice Gray)
                            return data?.role === 'user'
                                ? 'hsl(217.2 91.2% 59.8%)' // blue
                                : 'hsl(160.1 84.1% 39.4%)'; // emerald
                        }}
                        maskColor={theme === 'dark' ? "hsl(var(--background) / 0.7)" : "hsl(var(--background) / 0.4)"}
                        pannable
                        zoomable
                    />

                    {/* Empty State Prompt */}
                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
                                <div className="bg-primary/10 p-4 rounded-full mb-4 ring-1 ring-primary/20 shadow-lg backdrop-blur-sm">
                                    <MousePointerClick className="h-8 w-8 text-primary animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 mb-2">
                                    Start Thinking
                                </h3>
                                <p className="text-muted-foreground text-sm max-w-[200px]">
                                    Double-click anywhere on the canvas to begin a new conversation tree.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Live Cursors Overlay */}
                    {/* We render check for collaborators directly using the store values */}
                    {Object.values(collaborators)
                        .filter(c => c.id !== me?.id && c.mousePos) // Don't show my own cursor
                        .map(c => (
                            <CollaboratorCursor
                                key={c.id}
                                x={c.mousePos!.x}
                                y={c.mousePos!.y}
                                name={c.name}
                                color={c.color}
                            />
                        ))}


                    {/* Tree Name Panel */}
                    <Panel position="top-left" className="m-4">
                        <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm p-2 rounded-lg border border-border shadow-sm">
                            <div className="flex items-center gap-2 pr-3 border-r border-border">
                                <img src="/numi-tree-logo.png" alt="Numi" className="h-6 w-auto" />
                            </div>
                            <div className="relative group">
                                <Input
                                    value={treeName}
                                    onChange={(e) => setTreeName(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    className="h-8 w-[200px] bg-transparent border-none focus-visible:ring-0 text-sm font-medium cursor-text"
                                    placeholder="Conversation Title"
                                />
                            </div>
                            <div className="flex items-center gap-2 pl-2 border-l border-border">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => {
                                        clearCanvas();
                                        setTreeName('New Conversation');
                                        // Clear URL to prevent re-loading the previous tree
                                        const url = new URL(window.location.href);
                                        url.searchParams.delete('treeId');
                                        window.history.pushState({}, '', url.toString());
                                    }}
                                    title="New Conversation"
                                >
                                    <FilePlus className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setShowTreeList(true)}
                                    title="Open saved conversations"
                                >
                                    <FolderOpen className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </Panel>

                    {/* Top Right Controls: Collaborators & Profile */}
                    <Panel position="top-right" className="mt-4 mr-4 flex flex-col items-end gap-2">
                        {/* Collaborators List (Including Me) */}
                        {Object.keys(collaborators).length > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center -space-x-3">
                                    {Object.values(collaborators).map((c) => {
                                        const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                                        return (
                                            <Tooltip key={c.id}>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-background text-[11px] font-extrabold text-white shadow-lg hover:translate-y-[-2px] hover:z-20 transition-all cursor-pointer duration-200"
                                                        style={{ backgroundColor: c.color }}
                                                    >
                                                        <span className="leading-none drop-shadow-sm">{initials || '?'}</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" sideOffset={10} className="font-bold">
                                                    <p>{c.name} {c.id === me?.id ? '(You)' : ''}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center px-4 h-10 bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-md border border-white/10 rounded-full shadow-lg text-[12px] font-bold text-white whitespace-nowrap">
                                    <Users className="h-3.5 w-3.5 mr-2 opacity-70" />
                                    {Object.keys(collaborators).length}
                                </div>
                            </div>
                        )}
                    </Panel>



                    <Panel position="bottom-center" className="mb-4">
                        <div className="flex items-center gap-2 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0"
                                onClick={() => setShowSettings(true)}
                                title="Settings (API Keys & Models)"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                            <div className="w-px h-6 bg-border" />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={handleShare}
                                title="Share Link"
                            >
                                <UserPlus className="h-4 w-4" />
                                Share
                            </Button>
                        </div>
                    </Panel>


                    {/* Diagnostics Panel for Realtime Debugging */}
                    <DiagnosticsPanel />
                </ReactFlow >

                {/* Context Menu */}
                {
                    contextMenu && (
                        <NodeContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            nodeId={contextMenu.nodeId}
                            nodeRole={nodes.find(n => n.id === contextMenu.nodeId)?.data.role as string}
                            hasTextSelection={textSelection?.nodeId === contextMenu.nodeId}
                            selectedText={textSelection?.text}
                            onCreateBranch={handleCreateBranch}
                            onRegenerate={handleRegenerate}
                            onCopy={handleCopy}
                            onDelete={handleDelete}
                            onClose={handleCloseContextMenu}
                        />
                    )
                }

                {/* Share Confirmation Toast */}
                {showShareToast && (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 font-bold text-sm border border-primary-foreground/10 backdrop-blur-md">
                            <Check className="h-4 w-4" />
                            Lien copié dans le presse-papiers !
                        </div>
                    </div>
                )}

                {/* Initial Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm font-bold text-muted-foreground animate-pulse">Chargement de l'arbre...</p>
                        </div>
                    </div>
                )}

                <TreeListDialog open={showTreeList} onOpenChange={setShowTreeList} />
                <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
                <UserOnboardingModal open={showOnboarding} onOpenChange={setShowOnboarding} />
            </div>
        </TooltipProvider>
    );
}

// Export with provider wrapper
export default function BranchingCanvas() {
    return (
        <ReactFlowProvider>
            <Canvas />
        </ReactFlowProvider>
    );
}
