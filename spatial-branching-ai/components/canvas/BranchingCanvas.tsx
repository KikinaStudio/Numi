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
} from '@xyflow/react';
import { useCanvasStore, useNodes, useEdges, ConversationNodeData, useTemporalStore } from '@/lib/stores/canvas-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import ConversationNode from './ConversationNode';
import NodeContextMenu from './NodeContextMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Cloud, Check, Loader2, AlertCircle, FolderOpen, FilePlus, Home, Settings, Share2, Users } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import { usePersistence } from '@/lib/hooks/usePersistence';
import { TreeListDialog } from './TreeListDialog';
import { SettingsDialog } from '@/components/ui/settings-dialog';

// Define custom node types
const nodeTypes: NodeTypes = {
    conversation: ConversationNode,
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
    } = useCanvasStore();

    // Compute hasChildren for nodes to enable compact view
    const nodesWithChildStatus = useMemo(() => {
        const parentIds = new Set(edges.map(e => e.source));
        return nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                hasChildren: parentIds.has(n.id)
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
    usePersistence();

    const [showTreeList, setShowTreeList] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // AI Chat hook for generating responses
    const { generate } = useChat();

    // Generate random identity for collaboration
    useEffect(() => {
        const guestId = Math.random().toString(36).substring(7);
        const names = ['Artiste', 'Explorateur', 'Architecte', 'Penseur', 'Visionnaire', 'Guide'];
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const me = {
            id: guestId,
            name: `${randomName} (You)`,
            color: randomColor,
            lastActive: Date.now()
        };
        useCanvasStore.getState().setMe(me);
        useCanvasStore.getState().updateCollaborator(guestId, me);
    }, []);

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
        if (!treeId) return;
        const url = `${window.location.origin}${window.location.pathname}?treeId=${treeId}`;
        navigator.clipboard.writeText(url);
        // Simple visual feedback could be improved with a toast
        alert('Share link copied to clipboard!');
    }, [treeId]);

    // Default edge options for consistent styling  
    const defaultEdgeOptions = useMemo(() => ({
        type: 'smoothstep' as const,
        animated: true,
        style: {
            stroke: theme === 'dark' ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)',
            strokeWidth: 2,
        },
    }), [theme]);

    return (
        <div ref={reactFlowWrapper} className="w-full h-full">
            <ReactFlow
                nodes={nodesWithChildStatus}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                onDoubleClick={onPaneDoubleClick}
                onNodeContextMenu={onNodeContextMenu}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                snapToGrid
                snapGrid={[20, 20]}
                minZoom={0.1}
                maxZoom={2}
                panOnScroll
                zoomOnScroll={false}
                zoomOnPinch
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
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
                        return data?.role === 'user'
                            ? 'hsl(217.2 91.2% 59.8%)' // blue
                            : 'hsl(160.1 84.1% 39.4%)'; // emerald
                    }}
                    maskColor={theme === 'dark' ? "hsl(var(--background) / 0.7)" : "hsl(var(--background) / 0.4)"}
                    pannable
                    zoomable
                />

                {/* Tree Name Panel */}
                <Panel position="top-left" className="m-4">
                    <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm p-2 rounded-lg border border-border shadow-sm">
                        <div className="flex items-center gap-2 pr-3 border-r border-border">
                            <img src="/numi-tree-logo.png" alt="Numi" className="h-6 w-auto" />
                        </div>
                        <Input
                            value={treeName}
                            onChange={(e) => setTreeName(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            className="h-8 w-[200px] bg-transparent border-none focus-visible:ring-0 text-sm font-medium"
                            placeholder="Conversation Title"
                        />
                        <div className="flex items-center gap-2 pl-2 border-l border-border">
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

                {/* Sync Status Panel */}
                <Panel position="top-right" className="mt-4 mr-4 flex flex-col items-end gap-2">
                    <div className="flex items-center justify-center w-9 h-9 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-sm">
                        {syncStatus === 'saving' && <Cloud className="h-4 w-4 animate-bounce text-primary" />}
                        {syncStatus === 'synced' && <Cloud className="h-4 w-4 text-emerald-500" />}
                        {syncStatus === 'error' && (
                            <div title={syncError || 'Sync Error'}>
                                <AlertCircle className="h-4 w-4 text-destructive cursor-help" />
                            </div>
                        )}
                    </div>

                    {/* Collaborators List */}
                    {Object.keys(collaborators).length > 0 && (
                        <div className="mt-2 flex items-center -space-x-2 overflow-hidden">
                            {Object.values(collaborators).map((c) => (
                                <div
                                    key={c.id}
                                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-background text-[10px] font-bold text-white shadow-sm"
                                    style={{ backgroundColor: c.color }}
                                    title={c.name}
                                >
                                    <span className="leading-none">{c.name.charAt(0).toUpperCase()}</span>
                                </div>
                            ))}
                            <div className="flex items-center ml-2 px-2 h-8 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-sm text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                <Users className="h-3 w-3 mr-1" />
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
                            className="gap-2"
                            onClick={() => {
                                clearCanvas();
                                // Remove treeId from URL to prevent auto-reloading the old tree
                                const url = new URL(window.location.href);
                                url.searchParams.delete('treeId');
                                window.history.pushState({}, '', url);
                            }}
                            title="Start a new conversation"
                        >
                            <FilePlus className="h-4 w-4" />
                            New
                        </Button>
                        <div className="w-px h-6 bg-border" />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
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
                            onClick={() => setShowTreeList(true)}
                        >
                            <FolderOpen className="h-4 w-4" />
                            Open
                        </Button>
                        <div className="w-px h-6 bg-border" />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={handleShare}
                            disabled={!treeId}
                            title="Share this conversation"
                        >
                            <Share2 className="h-4 w-4" />
                            Share
                        </Button>
                        <div className="w-px h-6 bg-border" />
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                                // Position in upper third (approximate coordinates)
                                createRootNode({ x: 200, y: 100 });
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            New Root
                        </Button>
                    </div>
                </Panel>
            </ReactFlow>

            {/* Context Menu */}
            {contextMenu && (
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
            )}

            <TreeListDialog open={showTreeList} onOpenChange={setShowTreeList} />
            <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
        </div>
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
