'use client';

import { useCallback, useRef, useMemo, useState, useEffect, memo } from 'react';
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
import { useCanvasStore, useNodes, useEdges, ConversationNodeData, useTemporalStore, USER_COLORS } from '@/lib/stores/canvas-store';
import { useShallow } from 'zustand/react/shallow';
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

// --- MEMOIZED COLLABORATORS ---
const CollaboratorsCursors = memo(() => {
    const { collaborators, meId } = useCanvasStore(useShallow(state => ({
        collaborators: state.collaborators,
        meId: state.me?.id
    })));

    return (
        <>
            {Object.values(collaborators)
                .filter(c => c.id !== meId && c.mousePos)
                .map(c => (
                    <CollaboratorCursor
                        key={c.id}
                        x={c.mousePos!.x}
                        y={c.mousePos!.y}
                        name={c.name}
                        color={c.color}
                    />
                ))}
        </>
    );
});
CollaboratorsCursors.displayName = 'CollaboratorsCursors';

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
        treeId,
        ownerId,
        isLoading,
        isConnecting
    } = useCanvasStore(useShallow((state) => ({
        onNodesChange: state.onNodesChange,
        onEdgesChange: state.onEdgesChange,
        onConnect: state.onConnect,
        createRootNode: state.createRootNode,
        createChildNode: state.createChildNode,
        selectNode: state.selectNode,
        deleteNode: state.deleteNode,
        clearCanvas: state.clearCanvas,
        treeName: state.treeName,
        setTreeName: state.setTreeName,
        textSelection: state.textSelection,
        setTextSelection: state.setTextSelection,
        contextMenu: state.contextMenu,
        setContextMenu: state.setContextMenu,
        syncStatus: state.syncStatus,
        syncError: state.syncError,
        treeId: state.treeId,
        ownerId: state.ownerId,
        isLoading: state.isLoading,
        isConnecting: state.isConnecting
    })));

    // Compute hasChildren and branchedTexts for nodes to enable compact view and highlighting
    const nodesWithMetadata = useMemo(() => {
        // Optimized metadata calculation
        const parentIds = new Set<string>();
        const branchContextsMap = new Map<string, string[]>();

        for (const edge of edges) {
            parentIds.add(edge.source);
            const childNode = nodes.find(n => n.id === edge.target);
            if (childNode?.data?.branchContext) {
                const contexts = branchContextsMap.get(edge.source) || [];
                contexts.push(childNode.data.branchContext);
                branchContextsMap.set(edge.source, contexts);
            }
        }

        return nodes.map(n => {
            const hasChildren = parentIds.has(n.id);
            const branchedTexts = branchContextsMap.get(n.id) || [];

            // Only update data object if metadata actually changed to prevent downstream re-renders
            if (n.data.hasChildren === hasChildren &&
                JSON.stringify((n.data as any).branchedTexts) === JSON.stringify(branchedTexts)) {
                return n;
            }

            return {
                ...n,
                data: {
                    ...n.data,
                    hasChildren,
                    branchedTexts
                }
            };
        });
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

        const colors = USER_COLORS;
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
        } else {
            // If known user and empty canvas (should be true on first load if no treeId), create root node
            // Need to check if we are loading a tree? If treeId is present in URL, we wait for load.
            // But here we are in the initial mount effect.
            // Let's defer this check slightly or check URL params.
            const urlParams = new URLSearchParams(window.location.search);
            const hasTreeId = urlParams.get('treeId');

            if (!hasTreeId && useCanvasStore.getState().nodes.length === 0) {
                // Clean start
                setTimeout(() => {
                    useCanvasStore.getState().createRootNode({ x: 100, y: 300 });
                }, 100);
            }
        }
    }, []);

    // Sync 'me' name when userName changes in settings
    const userName = useSettingsStore(s => s.userName);
    const { setMe, updateCollaborator, me } = useCanvasStore(useShallow(s => ({
        setMe: s.setMe,
        updateCollaborator: s.updateCollaborator,
        me: s.me
    })));
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

    // Unified File Upload Handler
    const handleFileUpload = useCallback(async (file: File, position: { x: number, y: number }) => {
        if (!supabase) {
            alert('Supabase client not initialized. Check your environment variables.');
            return;
        }

        try {
            // Check file type
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';

            if (!isImage && !isPdf) {
                if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    alert('Only images and PDFs are supported.');
                    return;
                }
            }

            // ----------------------------------------------------------------------
            // STORAGE QUOTA CHECK (10MB Limit)
            // ----------------------------------------------------------------------
            const MAX_TREE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

            // Calculate current total size of files in the tree
            const currentTotalSize = useCanvasStore.getState().nodes.reduce((acc, node) => {
                return acc + (node.data.fileSize || 0);
            }, 0);

            if (currentTotalSize + file.size > MAX_TREE_SIZE) {
                const currentMB = (currentTotalSize / (1024 * 1024)).toFixed(2);
                alert(`Storage limit exceeded (10MB per tree).\nCurrent usage: ${currentMB}MB.\nFile size: ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
                return;
            }

            // Handle PDF
            if (isPdf) {
                // 1. Convert PDF to images
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
                    fileSize: file.size, // Store file size
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
                fileSize: file.size, // Store file size
                mimeType: file.type,
                role: 'user' // Files are user inputs
            });

        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
        }
    }, [treeId]);

    // Drag & Drop Handler
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDrop = useCallback(async (event: React.DragEvent) => {
        event.preventDefault();

        const file = event.dataTransfer.files[0];
        if (!file) return;

        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        await handleFileUpload(file, position);
    }, [screenToFlowPosition, handleFileUpload]);

    // File Input Handler
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Place in center of current view
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const position = screenToFlowPosition({
            x: centerX,
            y: centerY,
        });

        await handleFileUpload(file, position);

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [handleFileUpload, screenToFlowPosition]);

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
                    className={cn(isConnecting && 'is-connecting')}
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



                    {/* Live Cursors Overlay - Memoized to prevent Canvas re-renders */}
                    <CollaboratorsCursors />


                    {/* Tree Name Panel */}
                    <Panel position="top-left" className="m-4">
                        <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm p-2 rounded-lg border border-border shadow-sm">
                            <div className="flex items-center gap-2 pr-2 border-r border-border">
                                <img
                                    src={theme === 'dark' ? "/assets/logo/logo-white-bg.png" : "/assets/logo/logo-black-bg.png"}
                                    alt="Numi"
                                    className="h-7 w-auto rounded-md shadow-sm"
                                />
                            </div>
                            <div className="relative group">
                                <Input
                                    value={treeName.startsWith('Untitled Tree') ? '' : treeName}
                                    onChange={(e) => setTreeName(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    className="h-8 w-[200px] bg-transparent border-none focus-visible:ring-0 text-sm font-medium cursor-text"
                                    placeholder="Name your Tree"
                                />
                            </div>
                        </div>
                    </Panel>
                    <Panel position="top-right" className="mt-4 mr-4 flex flex-col items-end gap-2">
                        {/* Collaborators List (Including Me) - Selective Selector */}
                        {(() => {
                            const collaborators = useCanvasStore(state => state.collaborators);
                            const meId = useCanvasStore(state => state.me?.id);
                            const count = Object.keys(collaborators).length;

                            if (count === 0) return null;

                            return (
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
                                                        <p>{c.name} {c.id === meId ? '(You)' : ''}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center px-4 h-10 bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-md border border-white/10 rounded-full shadow-lg text-[12px] font-bold text-white whitespace-nowrap">
                                        <Users className="h-3.5 w-3.5 mr-2 opacity-70" />
                                        {count}
                                    </div>
                                </div>
                            );
                        })()}
                    </Panel>



                    <Panel position="bottom-center" className="mb-4">
                        <div className="flex items-center gap-2 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => {
                                    clearCanvas();
                                    setTreeName('');
                                    const url = new URL(window.location.href);
                                    url.searchParams.delete('treeId');
                                    window.history.pushState({}, '', url.toString());
                                }}
                                title="New Conversation"
                            >
                                <Plus className="h-4 w-4" />
                                New
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => fileInputRef.current?.click()}
                                title="Add Image or PDF"
                            >
                                <FilePlus className="h-4 w-4" />
                                Add
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => setShowTreeList(true)}
                                title="Open Saved"
                            >
                                <FolderOpen className="h-4 w-4" />
                                Open
                            </Button>
                            <div className="w-px h-6 bg-border" />
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
                {
                    showShareToast && (
                        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 font-bold text-sm border border-primary-foreground/10 backdrop-blur-md">
                                <Check className="h-4 w-4" />
                                Lien copié dans le presse-papiers !
                            </div>
                        </div>
                    )
                }

                {/* Initial Loading Overlay */}
                {
                    isLoading && (
                        <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-sm font-bold text-muted-foreground animate-pulse">Chargement de l'arbre...</p>
                            </div>
                        </div>
                    )
                }

                <TreeListDialog open={showTreeList} onOpenChange={setShowTreeList} />
                <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
                <UserOnboardingModal
                    open={showOnboarding}
                    onOpenChange={setShowOnboarding}
                    onComplete={() => {
                        useCanvasStore.getState().createRootNode({ x: 100, y: 300 });
                    }}
                />

                {/* Hidden File Input for "Add" button */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={onFileInputChange}
                />
            </div >
        </TooltipProvider >
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
