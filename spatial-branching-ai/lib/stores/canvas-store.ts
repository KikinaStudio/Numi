import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import {
    Node,
    Edge,
    XYPosition,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Connection,
    addEdge,
} from '@xyflow/react';

// Custom node data interface for conversation nodes
export interface ConversationNodeData extends Record<string, unknown> {
    role: 'user' | 'assistant' | 'system';
    content: string;
    branchContext?: string; // Selected text that triggered this branch
    isGenerating?: boolean;
    fileUrl?: string; // For images/files
    fileName?: string;
    mimeType?: string;
    pdfUrl?: string; // Original PDF URL
    pdfPages?: string[]; // Array of image URLs for each page
    modelConfig?: {
        model?: string;
        temperature?: number;
    };
    selectedPersonaId?: string;
    customPersona?: {
        name: string;
        systemPrompt: string;
        description: string;
    };
    authorName?: string;
    hasChildren?: boolean;
}

// Extended node type for our conversation nodes
export type ConversationNode = Node<ConversationNodeData, 'conversation'>;

// Text selection state for deep branching
export interface TextSelection {
    nodeId: string;
    text: string;
    range: [number, number];
}

export interface Collaborator {
    id: string;
    name: string;
    color: string;
    position?: XYPosition;
    mousePos?: XYPosition | null;
    lastActive: number;
}

// Store interface
interface CanvasState {
    // State
    nodes: ConversationNode[];
    edges: Edge[];
    selectedNodeId: string | null;
    textSelection: TextSelection | null;
    isConnecting: boolean; // Global connection drag state
    activeConnection: { nodeId: string | null; handleId: string | null; handleType: string | null } | null;
    contextMenu: { x: number; y: number; nodeId: string } | null;
    collaborators: Record<string, Collaborator>;
    me: Collaborator | null;

    // Persistence
    treeId: string | null;
    ownerId: string | null;
    treeName: string;
    syncStatus: 'synced' | 'saving' | 'error' | 'unsaved';
    syncError: string | null;
    realtimeStatus: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR';
    lastRealtimeEvent: string | null;
    isLoading: boolean;

    // Actions
    setNodes: (nodes: ConversationNode[]) => void;
    setEdges: (edges: Edge[]) => void;
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;

    // Node operations
    addNode: (node: ConversationNode) => void;
    updateNode: (id: string, data: Partial<ConversationNodeData>) => void;
    updateNodePosition: (id: string, position: XYPosition) => void;
    deleteNode: (id: string) => void;
    clearCanvas: () => void;

    // Selection & UI
    selectNode: (id: string | null) => void;
    setIsConnecting: (isConnecting: boolean) => void;
    setActiveConnection: (connection: { nodeId: string | null; handleId: string | null; handleType: string | null } | null) => void;
    setTextSelection: (selection: TextSelection | null) => void;
    setContextMenu: (menu: { x: number; y: number; nodeId: string } | null) => void;
    setCollaborators: (collaborators: Record<string, Collaborator>) => void;
    updateCollaborator: (id: string, data: Partial<Collaborator>) => void;
    setMe: (me: Collaborator) => void;

    // Persistence Actions
    setTreeId: (id: string | null) => void;
    setTreeName: (name: string) => void;
    setSyncStatus: (status: CanvasState['syncStatus'], error?: string | null) => void;
    setRealtimeStatus: (status: 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR', event?: string) => void;
    setIsLoading: (loading: boolean) => void;
    loadGraph: (nodes: ConversationNode[], edges: Edge[], treeId: string, treeName?: string, ownerId?: string | null) => void;

    // Branching
    createRootNode: (position: XYPosition, content?: string) => string;
    createChildNode: (parentId: string, position: XYPosition, branchContext?: string) => string;

    // Utilities
    getAncestorNodes: (nodeId: string) => ConversationNode[];
    getConversationContext: (nodeId: string) => Array<{ role: string; content: string }>;
}

// Generate unique IDs (Using standard UUID for Supabase compatibility)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts or older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const useCanvasStore = create<CanvasState>()(
    temporal(
        immer((set, get) => ({
            // Initial state
            nodes: [],
            edges: [],
            selectedNodeId: null,
            textSelection: null,
            contextMenu: null,
            isConnecting: false,
            activeConnection: null,
            treeId: null,
            ownerId: null,
            treeName: 'Untitled Conversation',
            syncStatus: 'synced',
            syncError: null,
            realtimeStatus: 'DISCONNECTED',
            lastRealtimeEvent: null,
            isLoading: false,
            collaborators: {},
            me: null,

            // Setters
            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),

            // Persistence Actions
            setTreeId: (id) => set({ treeId: id }),
            setTreeName: (name) => set({ treeName: name }),
            setSyncStatus: (status, error = null) => set({ syncStatus: status, syncError: error }),
            setRealtimeStatus: (status, event) => set(state => ({
                realtimeStatus: status,
                lastRealtimeEvent: event !== undefined ? event : state.lastRealtimeEvent
            })),
            setIsLoading: (loading) => set({ isLoading: loading }),
            loadGraph: (nodes, edges, treeId, treeName, ownerId) => set({
                nodes,
                edges,
                treeId,
                ownerId: ownerId || null,
                treeName: treeName || 'Untitled Conversation',
                syncStatus: 'synced',
                syncError: null
            }),

            // React Flow change handlers (optimized)
            onNodesChange: (changes) => {
                set((state) => {
                    state.nodes = applyNodeChanges(changes, state.nodes) as ConversationNode[];
                });
            },

            onEdgesChange: (changes) => {
                set((state) => {
                    state.edges = applyEdgeChanges(changes, state.edges);
                });
            },

            onConnect: (connection) => {
                set((state) => {
                    state.edges = addEdge(
                        {
                            ...connection,
                            id: `edge-${connection.source}-${connection.target}`,
                            type: 'floating',
                            animated: true,
                        },
                        state.edges
                    );
                });
            },

            // Node operations
            addNode: (node) => {
                set((state) => {
                    state.nodes.push(node);
                });
            },

            updateNode: (id, data) => {
                set((state) => {
                    const node = state.nodes.find((n) => n.id === id);
                    if (node) {
                        node.data = { ...node.data, ...data };
                    }
                });
            },

            updateNodePosition: (id, position) => {
                set((state) => {
                    const node = state.nodes.find((n) => n.id === id);
                    if (node) {
                        node.position = position;
                    }
                });
            },

            deleteNode: (id) => {
                set((state) => {
                    state.nodes = state.nodes.filter((n) => n.id !== id);
                    state.edges = state.edges.filter((e) => e.source !== id && e.target !== id);
                });
            },

            clearCanvas: () => {
                set({
                    nodes: [],
                    edges: [],
                    treeId: null,
                    ownerId: null,
                    treeName: 'Untitled Conversation',
                    selectedNodeId: null,
                    textSelection: null,
                    syncStatus: 'synced',
                });
            },

            // Selection & UI
            selectNode: (id) => set({ selectedNodeId: id }),
            setIsConnecting: (isConnecting: boolean) => set({ isConnecting }),
            setActiveConnection: (activeConnection) => set({ activeConnection }),
            setTextSelection: (selection) => set({ textSelection: selection }),
            setContextMenu: (menu) => set({ contextMenu: menu }),
            setCollaborators: (collaborators) => set({ collaborators }),
            updateCollaborator: (id, data) => set((state) => {
                if (state.collaborators[id]) {
                    state.collaborators[id] = { ...state.collaborators[id], ...data };
                } else if (data.name && data.color) {
                    state.collaborators[id] = {
                        id,
                        name: data.name,
                        color: data.color,
                        lastActive: Date.now(),
                        ...data
                    };
                }
            }),
            setMe: (me) => set({ me }),

            // Branching operations
            createRootNode: (position, content = '') => {
                const id = generateId();
                const newNode: ConversationNode = {
                    id,
                    type: 'conversation',
                    position,
                    data: {
                        role: 'user',
                        content,
                        authorName: get().me?.name || 'User',
                    },
                };

                set((state) => {
                    state.nodes.push(newNode);
                });

                return id;
            },

            createChildNode: (parentId, position, branchContext) => { // position arg is now optional fallback
                const id = generateId();
                const parent = get().nodes.find((n) => n.id === parentId);
                const role: 'user' | 'assistant' = parent?.data.role === 'user' ? 'assistant' : 'user';

                // SMART PLACEMENT LOGIC
                let finalPosition = position;

                // Find all existing children of this parent
                const { edges, nodes } = get();
                const childEdges = edges.filter(e => e.source === parentId);
                const childNodes = childEdges
                    .map(e => nodes.find(n => n.id === e.target))
                    .filter((n): n is ConversationNode => !!n)
                    // Sort by X position to find the right-most child
                    .sort((a, b) => a.position.x - b.position.x);

                if (childNodes.length > 0) {
                    const lastChild = childNodes[childNodes.length - 1];
                    // Place to the right of the last child + padding
                    // Assuming a standard node width of approx 400px + some gap
                    finalPosition = {
                        x: lastChild.position.x + 450,
                        y: lastChild.position.y // Keep same Y level
                    };
                } else if (!finalPosition && parent) {
                    // First child: Place directly below parent
                    finalPosition = {
                        x: parent.position.x,
                        y: parent.position.y + 300 // Vertical gap
                    };
                }

                // Fallback if something fails
                if (!finalPosition) finalPosition = { x: 0, y: 0 };

                const newNode: ConversationNode = {
                    id,
                    type: 'conversation',
                    position: finalPosition,
                    data: {
                        role,
                        content: '', // Start empty
                        authorName: get().me?.name || (role === 'user' ? 'User' : 'Assistant'),
                        branchContext,
                        parentId, // Track parent for easier logic
                        isGenerating: role === 'assistant', // Assistant nodes start generating
                        // Restore Persona Inheritance
                        selectedPersonaId: parent?.data.selectedPersonaId,
                        customPersona: parent?.data.customPersona,
                    },
                };

                set((state) => {
                    // Update parent to show it has children
                    const p = state.nodes.find(n => n.id === parentId);
                    if (p) {
                        p.data = { ...p.data, hasChildren: true };
                    }

                    state.nodes.push(newNode);
                    state.edges.push({
                        id: `edge-${parentId}-${id}`,
                        source: parentId,
                        target: id,
                        type: 'floating',
                        animated: true,
                    });
                });

                return id;
            },

            // Get all ancestor nodes for building conversation context
            getAncestorNodes: (nodeId) => {
                const { nodes, edges } = get();
                const ancestors: ConversationNode[] = [];
                const visited = new Set<string>();
                const queue = [nodeId];

                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    const parentEdges = edges.filter((e) => e.target === currentId);

                    for (const edge of parentEdges) {
                        if (!visited.has(edge.source)) {
                            const parentNode = nodes.find((n) => n.id === edge.source);
                            if (parentNode) {
                                ancestors.unshift(parentNode); // Maintain a rough order
                                visited.add(edge.source);
                                queue.push(edge.source);
                            }
                        }
                    }
                }

                return ancestors;
            },

            // Build conversation context for LLM calls
            getConversationContext: (nodeId) => {
                const { nodes } = get();
                const ancestors = get().getAncestorNodes(nodeId);
                const currentNode = nodes.find((n) => n.id === nodeId);

                const allNodes = currentNode ? [...ancestors, currentNode] : ancestors;

                return allNodes.map((node) => ({
                    id: node.id,
                    role: node.data.role,
                    content: node.data.branchContext
                        ? `[Context: "${node.data.branchContext}"]\n${node.data.content}`
                        : node.data.content,
                    fileUrl: node.data.fileUrl,
                    fileName: node.data.fileName,
                    mimeType: node.data.mimeType
                }));
            },
        })),
        {
            limit: 5,
            partialize: (state) => ({
                nodes: state.nodes,
                edges: state.edges
            }),
        }
    )
);

export const useTemporalStore = () => useCanvasStore.temporal;

// Selector hooks for optimized re-renders
export const useNodes = () => useCanvasStore((state) => state.nodes);
export const useEdges = () => useCanvasStore((state) => state.edges);
export const useSelectedNodeId = () => useCanvasStore((state) => state.selectedNodeId);
export const useTextSelection = () => useCanvasStore((state) => state.textSelection);
