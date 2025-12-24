'use client';

import { useCallback, useRef, useMemo, useState } from 'react';
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
import { useCanvasStore, useNodes, useEdges, ConversationNodeData } from '@/lib/stores/canvas-store';
import ConversationNode from './ConversationNode';
import NodeContextMenu from './NodeContextMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Cloud, Check, Loader2, AlertCircle, FolderOpen, FilePlus, Home, Settings } from 'lucide-react';
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
    } = useCanvasStore();

    // Persistence hook for auto-saving
    usePersistence();

    const [showTreeList, setShowTreeList] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // AI Chat hook for generating responses
    const { generate } = useChat();

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
    }, [contextMenu, deleteNode]);

    // Default edge options for consistent styling  
    const defaultEdgeOptions = useMemo(() => ({
        type: 'smoothstep' as const,
        animated: true,
        style: {
            stroke: 'hsl(var(--primary))',
            strokeWidth: 2,
        },
    }), []);

    return (
        <div ref={reactFlowWrapper} className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                onDoubleClick={onPaneDoubleClick}
                onNodeContextMenu={onNodeContextMenu}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
                snapToGrid
                snapGrid={[20, 20]}
                minZoom={0.1}
                maxZoom={2}
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="hsl(var(--muted-foreground) / 0.3)"
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
                    maskColor="hsl(var(--background) / 0.7)"
                    pannable
                    zoomable
                />

                {/* Tree Name Panel */}
                <Panel position="top-left" className="mt-4 ml-4">
                    <div className="flex items-center gap-2 p-1 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                        <div className="p-2 bg-primary/10 rounded-md">
                            <Home className="h-4 w-4 text-primary" />
                        </div>
                        <Input
                            value={treeName}
                            onChange={(e) => setTreeName(e.target.value)}
                            className="h-8 w-[200px] bg-transparent border-none focus-visible:ring-0 text-sm font-medium"
                            placeholder="Conversation Title"
                        />
                    </div>
                </Panel>

                {/* Sync Status Panel */}
                <Panel position="top-right" className="mt-4 mr-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-sm">
                        {syncStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {syncStatus === 'synced' && <Cloud className="h-4 w-4 text-emerald-500" />}
                        {syncStatus === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        <span className="text-xs font-medium text-muted-foreground">
                            {syncStatus === 'saving' && 'Saving...'}
                            {syncStatus === 'synced' && 'Saved'}
                            {syncStatus === 'error' && 'Error'}
                            {syncStatus === 'unsaved' && 'Unsaved'}
                        </span>
                    </div>
                </Panel>

                {/* Instructions Panel */}
                <Panel position="top-center" className="mt-4">
                    <div className="px-4 py-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                        <p className="text-sm text-muted-foreground">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Double-click</kbd> canvas to create •
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-2">Double-click</kbd> node to edit •
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-2">Right-click</kbd> to branch
                        </p>
                    </div>
                </Panel>

                {/* Quick actions panel */}
                <Panel position="bottom-center" className="mb-4">
                    <div className="flex items-center gap-2 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            onClick={() => clearCanvas()}
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
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                                // Calculate position in the top third of the viewport
                                const viewport = reactFlowWrapper.current?.getBoundingClientRect();
                                if (viewport) {
                                    // Get the flow position for the horizontal center and vertical top-third
                                    const position = screenToFlowPosition({
                                        x: viewport.left + viewport.width / 2,
                                        y: viewport.top + viewport.height / 4, // 1/4th down for 'higher third' feel
                                    });
                                    // Adjust for node width/height roughly (assuming ~300x150)
                                    createRootNode({
                                        x: position.x - 150,
                                        y: position.y - 75
                                    });
                                } else {
                                    createRootNode({ x: 0, y: 0 });
                                }
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
