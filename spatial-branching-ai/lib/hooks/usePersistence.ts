import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';
import { supabase } from '@/lib/supabase/client';
import { ConversationNode } from '@/lib/stores/canvas-store';
import { Edge } from '@xyflow/react';

const DEBOUNCE_DELAY = 1000; // 1 second auto-save

interface DbNode {
    id: string;
    tree_id: string;
    parent_id: string | null;
    position_x: number;
    position_y: number;
    content_type: 'text' | 'image' | 'video';
    data: {
        role: 'user' | 'assistant' | 'system';
        content: string;
        branchContext?: string;
    };
    model_config: {
        model?: string;
        temperature?: number;
    };
    created_at: string;
    updated_at: string;
}

interface DbEdge {
    id?: string;
    tree_id: string;
    source_id: string;
    target_id: string;
    created_at: string;
}

export function usePersistence() {
    const {
        nodes,
        edges,
        treeId,
        treeName,
        setTreeId,
        setTreeName,
        setSyncStatus,
        setNodes,
        setEdges,
        loadGraph,
        syncStatus,
        updateNode,
    } = useCanvasStore();

    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastSavedRef = useRef<string>('');
    const isSavingRef = useRef<boolean>(false);

    // Serialize current state to detect changes
    const serializeState = (nodes: ConversationNode[], edges: Edge[]) => {
        return JSON.stringify({
            nodes: nodes.map(n => ({
                id: n.id,
                position: n.position,
                data: n.data
            })),
            edges: edges.map(e => ({
                source: e.source,
                target: e.target
            }))
        });
    };

    const saveTree = useCallback(async () => {
        if (!supabase) {
            setSyncStatus('error');
            return;
        }

        // Prevent parallel executions
        if (isSavingRef.current) {
            return;
        }

        setSyncStatus('saving');
        isSavingRef.current = true;

        try {
            const currentState = serializeState(nodes, edges);
            // If nothing changed since last save (and we aren't creating a new tree), skip
            if (treeId && currentState === lastSavedRef.current) {
                setSyncStatus('synced');
                isSavingRef.current = false;
                return;
            }

            // 1. Ensure Tree Exists
            let currentTreeId = treeId;
            if (!currentTreeId) {
                const { data: tree, error: treeError } = await supabase
                    .from('trees')
                    .insert({ name: treeName || 'Untitled Conversation' })
                    .select()
                    .single();

                if (treeError) throw treeError;
                if (!tree) throw new Error('Failed to create tree');

                currentTreeId = tree.id;
                setTreeId(currentTreeId);
            } else {
                // Update name and touch updated_at
                await supabase
                    .from('trees')
                    .update({
                        name: treeName,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentTreeId);
            }

            // 2. Upsert Nodes
            const dbNodes: DbNode[] = nodes.map(node => ({
                id: node.id,
                tree_id: currentTreeId!,
                parent_id: null,
                position_x: node.position.x,
                position_y: node.position.y,
                content_type: 'text',
                data: {
                    role: node.data.role,
                    content: node.data.content,
                    branchContext: node.data.branchContext
                },
                model_config: node.data.modelConfig || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));

            if (dbNodes.length > 0) {
                const { error: nodesError } = await supabase
                    .from('nodes')
                    .upsert(dbNodes);

                if (nodesError) throw nodesError;
            }

            // Clean up deleted nodes
            const activeNodeIds = nodes.map(n => n.id);
            if (activeNodeIds.length > 0) {
                try {
                    await supabase
                        .from('nodes')
                        .delete()
                        .eq('tree_id', currentTreeId)
                        .filter('id', 'not.in', `(${activeNodeIds.join(',')})`);
                } catch (e) {
                    // Ignore cleanup errors to prevent sync verification loop
                    console.error('Cleanup deleted nodes failed (non-fatal):', e);
                }
            }

            // 3. Upsert Edges
            // Strategy: Delete all edges for this tree and re-insert active ones and let DB generate IDs
            const { error: deleteEdgesError } = await supabase
                .from('edges')
                .delete()
                .eq('tree_id', currentTreeId);

            if (deleteEdgesError) throw deleteEdgesError;

            // Deduplicate edges based on source/target to prevent unique constraint violations
            const uniqueEdgesMap = new Map<string, any>();
            edges.forEach(edge => {
                const key = `${edge.source}-${edge.target}`;
                if (!uniqueEdgesMap.has(key)) {
                    uniqueEdgesMap.set(key, {
                        tree_id: currentTreeId,
                        source_id: edge.source,
                        target_id: edge.target
                    });
                }
            });
            const edgesToInsert = Array.from(uniqueEdgesMap.values());

            if (edgesToInsert.length > 0) {
                const { error: edgesError } = await supabase
                    .from('edges')
                    .upsert(edgesToInsert, { onConflict: 'source_id, target_id' });
                if (edgesError) throw edgesError;
            }

            lastSavedRef.current = currentState;
            setSyncStatus('synced');
        } catch (error: any) {
            console.error('Save failed:', error.message || error);
            if (error.details) console.error('Error details:', error.details);
            setSyncStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [nodes, edges, treeId, treeName, setTreeId, setSyncStatus]);

    const loadTree = useCallback(async (id: string) => {
        if (!supabase) return;

        try {
            // 1. Fetch Tree Metadata
            const { data: tree, error: treeError } = await supabase
                .from('trees')
                .select('*')
                .eq('id', id)
                .single();
            if (treeError) throw treeError;

            // 2. Fetch Nodes
            const { data: dbNodes, error: nodesError } = await supabase
                .from('nodes')
                .select('*')
                .eq('tree_id', id);
            if (nodesError) throw nodesError;

            // 3. Fetch Edges
            const { data: dbEdges, error: edgesError } = await supabase
                .from('edges')
                .select('*')
                .eq('tree_id', id);
            if (edgesError) throw edgesError;

            // 4. Transform
            const flowNodes: ConversationNode[] = (dbNodes || []).map((node: any) => ({
                id: node.id,
                type: 'conversation',
                position: { x: node.position_x, y: node.position_y },
                data: {
                    role: node.data.role,
                    content: node.data.content,
                    branchContext: node.data.branchContext,
                    modelConfig: node.model_config
                }
            }));

            const flowEdges: Edge[] = (dbEdges || []).map((edge: any) => ({
                id: edge.id || `edge-${edge.source_id}-${edge.target_id}`,
                source: edge.source_id,
                target: edge.target_id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2 }, // slate-400
            }));

            // 5. Load into Store
            loadGraph(flowNodes, flowEdges, tree.id, tree.name);

        } catch (error) {
            console.error('Failed to load tree:', error);
            setSyncStatus('error');
        }
    }, [loadGraph, setSyncStatus]);

    // Debounced Auto-save
    useEffect(() => {
        if (nodes.length === 0) return; // Don't save empty state immediately

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Only update to 'unsaved' if we aren't already in a non-synced state
        // This prevents 60fps re-renders during dragging
        if (syncStatus === 'synced') {
            setSyncStatus('unsaved');
        }

        timeoutRef.current = setTimeout(() => {
            saveTree();
        }, DEBOUNCE_DELAY);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [nodes, edges, treeName, saveTree, setSyncStatus, syncStatus]);

    // Initial load from URL and Realtime Subscriptions
    useEffect(() => {
        const client = supabase;
        if (!client) return;

        const params = new URLSearchParams(window.location.search);
        const urlTreeId = params.get('treeId');

        if (urlTreeId && urlTreeId !== treeId) {
            loadTree(urlTreeId);
        }

        if (!treeId) return;

        // 1. Subscribe to Nodes
        const nodesChannel = client
            .channel(`nodes:${treeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'nodes',
                    filter: `tree_id=eq.${treeId}`,
                },
                (payload) => {
                    if (isSavingRef.current) return;

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const node = payload.new as DbNode;
                        const flowNode: ConversationNode = {
                            id: node.id,
                            type: 'conversation',
                            position: { x: node.position_x, y: node.position_y },
                            data: {
                                role: node.data.role,
                                content: node.data.content,
                                branchContext: node.data.branchContext,
                                modelConfig: node.model_config,
                            },
                        };

                        const currentNodes = useCanvasStore.getState().nodes;
                        const existingNodeIndex = currentNodes.findIndex(n => n.id === node.id);

                        if (existingNodeIndex !== -1) {
                            const updatedNodes = [...currentNodes];
                            updatedNodes[existingNodeIndex] = flowNode;
                            setNodes(updatedNodes);
                        } else {
                            setNodes([...currentNodes, flowNode]);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setNodes(useCanvasStore.getState().nodes.filter(n => n.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // 2. Subscribe to Edges
        const edgesChannel = client
            .channel(`edges:${treeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'edges',
                    filter: `tree_id=eq.${treeId}`,
                },
                (payload) => {
                    if (isSavingRef.current) return;

                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const edge = payload.new as DbEdge;
                        const flowEdge: Edge = {
                            id: edge.id || `edge-${edge.source_id}-${edge.target_id}`,
                            source: edge.source_id,
                            target: edge.target_id,
                            type: 'smoothstep',
                            animated: true,
                            style: { stroke: '#94a3b8', strokeWidth: 2 },
                        };

                        const currentEdges = useCanvasStore.getState().edges;
                        if (!currentEdges.find(e => e.id === flowEdge.id)) {
                            setEdges([...currentEdges, flowEdge]);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setEdges(useCanvasStore.getState().edges.filter(e => e.id !== payload.old.id && (e.source !== payload.old.source_id || e.target !== payload.old.target_id)));
                    }
                }
            )
            .subscribe();

        // 3. Subscribe to Tree Meta (Name)
        const treeChannel = client
            .channel(`tree:${treeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'trees',
                    filter: `id=eq.${treeId}`,
                },
                (payload) => {
                    if (isSavingRef.current) return;
                    if (payload.new.name !== treeName) {
                        setTreeName(payload.new.name);
                    }
                }
            )
            .subscribe();

        return () => {
            client.removeChannel(nodesChannel);
            client.removeChannel(edgesChannel);
            client.removeChannel(treeChannel);
        };
    }, [treeId, loadTree, setNodes, setEdges, setTreeName, treeName]);

    // Update URL when treeId changes
    useEffect(() => {
        if (treeId) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('treeId') !== treeId) {
                params.set('treeId', treeId);
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }
        }
    }, [treeId]);


    return {
        saveTree,
        loadTree,
        syncStatus
    };
}
