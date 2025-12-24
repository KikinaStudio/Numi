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
        loadGraph,
        syncStatus
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

        setSyncStatus('saving');

        try {
            const currentState = serializeState(nodes, edges);
            // If nothing changed since last save (and we aren't creating a new tree), skip
            if (treeId && currentState === lastSavedRef.current) {
                setSyncStatus('synced');
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
                await supabase
                    .from('nodes')
                    .delete()
                    .eq('tree_id', currentTreeId)
                    .not('id', 'in', activeNodeIds);
            }

            // 3. Upsert Edges
            // Strategy: Delete all edges for this tree and re-insert active ones and let DB generate IDs
            const { error: deleteEdgesError } = await supabase
                .from('edges')
                .delete()
                .eq('tree_id', currentTreeId);

            if (deleteEdgesError) throw deleteEdgesError;

            const edgesToInsert = edges.map(edge => ({
                tree_id: currentTreeId,
                source_id: edge.source,
                target_id: edge.target
            }));

            if (edgesToInsert.length > 0) {
                const { error: edgesError } = await supabase
                    .from('edges')
                    .insert(edgesToInsert as any); // using any to bypass strict type check on missing id
                if (edgesError) throw edgesError;
            }

            lastSavedRef.current = currentState;
            setSyncStatus('synced');
        } catch (error: any) {
            console.error('Save failed:', error.message || error);
            if (error.details) console.error('Error details:', error.details);
            setSyncStatus('error');
        }
    }, [nodes, edges, treeId, treeName, setTreeId, setSyncStatus]);

    // Debounced Auto-save
    useEffect(() => {
        if (nodes.length === 0) return; // Don't save empty state immediately

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setSyncStatus('unsaved');
        timeoutRef.current = setTimeout(() => {
            saveTree();
        }, DEBOUNCE_DELAY);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [nodes, edges, treeName, saveTree, setSyncStatus]);

    // Initial Loading is handled by components calling loadTree/loadGraph
}
