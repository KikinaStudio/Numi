import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';
import { supabase, isSupabaseConfigured, DbNode, DbEdge } from '@/lib/supabase/client';
import { ConversationNode } from '@/lib/stores/canvas-store';
import { Edge } from '@xyflow/react';

const DEBOUNCE_DELAY = 1000; // 1 second auto-save

// Helper to check if a string is a valid UUID
const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function usePersistence() {
    const {
        nodes,
        edges,
        treeId,
        treeName,
        setTreeId,
        setSyncStatus,
        loadGraph,
    } = useCanvasStore();

    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastSavedRef = useRef<string>('');

    // Serialize current state to detect changes
    const serializeState = (nodes: ConversationNode[], edges: Edge[]) => {
        return JSON.stringify({
            nodes: nodes.map(n => ({
                id: n.id,
                position: n.position,
                data: n.data
            })),
            edges: edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target
            }))
        });
    };

    const saveTree = useCallback(async () => {
        if (!isSupabaseConfigured() || !supabase) return;

        try {
            const currentState = serializeState(nodes, edges);
            // If nothing changed since last save (and we aren't creating a new tree), skip
            if (treeId && currentState === lastSavedRef.current) {
                setSyncStatus('synced');
                return;
            }

            setSyncStatus('saving');

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
            // Identify parent_id for each node from the edges array
            const dbNodes: DbNode[] = nodes.map(node => {
                const parentEdge = edges.find(e => e.target === node.id);
                return {
                    id: node.id,
                    tree_id: currentTreeId!,
                    parent_id: parentEdge ? (isUUID(parentEdge.source) ? parentEdge.source : null) : null,
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
                };
            });

            if (dbNodes.length > 0) {
                const { error: nodesError } = await supabase
                    .from('nodes')
                    .upsert(dbNodes);
                if (nodesError) throw nodesError;

                // Cleanup deleted nodes (those not in current nodes list)
                const activeNodeIds = nodes.map(n => n.id).filter(id => isUUID(id));
                if (activeNodeIds.length > 0) {
                    await supabase
                        .from('nodes')
                        .delete()
                        .eq('tree_id', currentTreeId)
                        .not('id', 'in', activeNodeIds);
                }
            }

            // 3. Save Edges
            // First clear existing edges for this tree (simpler than syncing individual edge IDs)
            const { error: deleteEdgesError } = await supabase
                .from('edges')
                .delete()
                .eq('tree_id', currentTreeId);

            if (deleteEdgesError) throw deleteEdgesError;

            // Only insert edges if both ends are valid UUIDs (Supabase requirement)
            const edgesToInsert = edges
                .filter(edge => isUUID(edge.source) && isUUID(edge.target))
                .map(edge => ({
                    tree_id: currentTreeId!,
                    source_id: edge.source,
                    target_id: edge.target
                }));

            if (edgesToInsert.length > 0) {
                const { error: edgesError } = await supabase
                    .from('edges')
                    .insert(edgesToInsert);
                if (edgesError) throw edgesError;
            }

            lastSavedRef.current = currentState;
            setSyncStatus('synced');
        } catch (error: any) {
            console.error('Save failed:', error.message || error);
            if (error.details) console.error('Details:', error.details);
            if (error.hint) console.error('Hint:', error.hint);
            setSyncStatus('error');
        }
    }, [nodes, edges, treeId, treeName, setTreeId, setSyncStatus]);

    // Debounced Auto-save loop
    useEffect(() => {
        if (nodes.length === 0) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        const timeout = setTimeout(() => {
            saveTree();
        }, DEBOUNCE_DELAY);

        timeoutRef.current = timeout;

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [saveTree, nodes, edges]);

    const loadTree = useCallback(async (id: string) => {
        if (!isSupabaseConfigured() || !supabase) return;

        try {
            setSyncStatus('saving'); // Indicate loading

            // Fetch tree info
            const { data: tree, error: treeError } = await supabase
                .from('trees')
                .select('*')
                .eq('id', id)
                .single();

            if (treeError) throw treeError;

            // Fetch nodes
            const { data: dbNodes, error: nodesError } = await supabase
                .from('nodes')
                .select('*')
                .eq('tree_id', id);

            if (nodesError) throw nodesError;

            // Fetch edges
            const { data: dbEdges, error: edgesError } = await supabase
                .from('edges')
                .select('*')
                .eq('tree_id', id);

            if (edgesError) throw edgesError;

            // Transform to React Flow format
            const flowNodes: ConversationNode[] = (dbNodes || []).map(node => ({
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

            const flowEdges: Edge[] = (dbEdges || []).map(edge => ({
                id: edge.id,
                source: edge.source_id,
                target: edge.target_id,
                type: 'smoothstep',
                animated: true
            }));

            loadGraph(flowNodes, flowEdges, id, tree.name);
            lastSavedRef.current = serializeState(flowNodes, flowEdges);
            setSyncStatus('synced');

        } catch (error: any) {
            console.error('Load failed:', error.message || error);
            setSyncStatus('error');
        }
    }, [loadGraph, setSyncStatus]);

    return { saveTree, loadTree };
}
