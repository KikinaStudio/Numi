import { useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/lib/stores/canvas-store';
import { supabase } from '@/lib/supabase/client';
import { ConversationNode } from '@/lib/stores/canvas-store';
import { Edge } from '@xyflow/react';

// UUID validation helper
const isUUID = (id: string | null | undefined): id is string => {
    if (!id) return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
};

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
        authorName?: string;
        selectedPersonaId?: string;
        customPersona?: {
            name: string;
            systemPrompt: string;
            description: string;
        };
        fileUrl?: string;
        fileName?: string;
        mimeType?: string;
        isGenerated?: boolean;
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
    // Only grab stable things and the minimum reactive ones
    const treeId = useCanvasStore(state => state.treeId);
    const treeName = useCanvasStore(state => state.treeName);
    const syncStatus = useCanvasStore(state => state.syncStatus);
    const setSyncStatus = useCanvasStore(state => state.setSyncStatus);
    const setTreeId = useCanvasStore(state => state.setTreeId);
    const setNodes = useCanvasStore(state => state.setNodes);
    const setEdges = useCanvasStore(state => state.setEdges);
    const setIsLoading = useCanvasStore(state => state.setIsLoading);
    const isLoading = useCanvasStore(state => state.isLoading);
    const me = useCanvasStore(state => state.me);

    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastSavedRef = useRef<string>('');
    const isSavingRef = useRef<boolean>(false);
    const dbChannelRef = useRef<any>(null);
    const presenceChannelRef = useRef<any>(null);
    const activeSubIdRef = useRef<number>(0);

    // Serialize current state to detect changes
    const serializeState = useCallback((nodes: ConversationNode[], edges: Edge[], name: string) => {
        return JSON.stringify({
            name,
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
    }, []);

    const saveTree = useCallback(async () => {
        if (!supabase) {
            console.error('Supabase client not initialized - Missing Env Vars?');
            setSyncStatus('error', 'Missing Supabase Configuration (NEXT_PUBLIC_SUPABASE_URL)');
            return;
        }

        const state = useCanvasStore.getState();
        // Prevent parallel executions or saving during initial load
        if (isSavingRef.current || state.isLoading) {
            return;
        }

        setSyncStatus('saving');
        isSavingRef.current = true;

        try {
            const currentNodes = state.nodes;
            const currentEdges = state.edges;
            let currentName = state.treeName;
            let currentTreeId = state.treeId;

            const currentState = serializeState(currentNodes, currentEdges, currentName);
            // If nothing changed since last save (and we aren't creating a new tree), skip
            if (currentTreeId && currentState === lastSavedRef.current) {
                setSyncStatus('synced');
                isSavingRef.current = false;
                return;
            }

            // 1. Ensure Tree Exists
            if (!currentTreeId) {
                // Generate default name if empty
                if (!currentName.trim() && me?.id) {
                    const { count } = await supabase
                        .from('trees')
                        .select('*', { count: 'exact', head: true })
                        .ilike('name', 'Untitled Tree%')
                        .eq('owner_id', me.id);

                    const nextNum = (count || 0) + 1;
                    const newName = `Untitled Tree ${nextNum}`;
                    currentName = newName;
                    useCanvasStore.getState().setTreeName(newName); // Update local state
                }

                const { data: tree, error: treeError } = await supabase
                    .from('trees')
                    .insert({
                        name: currentName || 'Untitled Tree', // Fallback if count fails
                        owner_id: me?.id
                    })
                    .select()
                    .single();

                if (treeError) throw treeError;
                if (!tree) throw new Error('Failed to create tree');

                currentTreeId = tree.id;
                setTreeId(currentTreeId);

                // Add creator to tree_members
                if (currentTreeId && isUUID(me?.id)) {
                    await supabase.from('tree_members').insert({
                        tree_id: currentTreeId,
                        user_id: me!.id,
                        last_accessed_at: new Date().toISOString()
                    });
                }
            } else if (currentTreeId && isUUID(currentTreeId)) {
                // Update name and touch updated_at
                await supabase
                    .from('trees')
                    .update({
                        name: currentName || 'Untitled Tree', // Prevent empty name saving if edited to empty
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentTreeId);
            } else if (currentTreeId && !isUUID(currentTreeId)) {
                console.warn('[Persistence] Skipping tree update: ID is not a valid UUID.', currentTreeId);
                isSavingRef.current = false;
                setSyncStatus('synced');
                return;
            }

            // 2. Upsert Nodes
            const validNodes = currentNodes.filter(node => {
                if (!isUUID(node.id)) {
                    console.warn(`[Persistence] Skipping node with invalid UUID: ${node.id}`);
                    return false;
                }
                return true;
            });

            const dbNodes: DbNode[] = validNodes.map(node => ({
                id: node.id,
                tree_id: currentTreeId!,
                parent_id: null,
                position_x: node.position.x,
                position_y: node.position.y,
                content_type: (node.data.fileUrl && node.data.mimeType?.startsWith('image/')) ? 'image' : 'text',
                data: {
                    role: node.data.role,
                    content: node.data.content,
                    branchContext: node.data.branchContext,
                    authorName: node.data.authorName,
                    selectedPersonaId: node.data.selectedPersonaId,
                    customPersona: node.data.customPersona,
                    fileUrl: node.data.fileUrl,
                    fileName: node.data.fileName,
                    mimeType: node.data.mimeType,
                    isGenerated: node.data.isGenerated
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
            const activeNodeIds = currentNodes.map(n => n.id).filter(id => isUUID(id));
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
            // AND ensure both source and target nodes exist in the current set to avoid FK violations
            const activeNodeIdSet = new Set(activeNodeIds);
            const uniqueEdgesMap = new Map<string, any>();

            currentEdges.forEach(edge => {
                // strict check: source and target must be in the active nodes list
                if (!activeNodeIdSet.has(edge.source) || !activeNodeIdSet.has(edge.target)) {
                    console.warn(`[Persistence] Skipping edge ${edge.id} because source/target node missing.`);
                    return;
                }

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
            setSyncStatus('error', error.message || 'Unknown save error');
        } finally {
            isSavingRef.current = false;
        }
    }, [setSyncStatus, setTreeId, serializeState]);

    const loadTree = useCallback(async (id: string) => {
        if (!supabase) return;
        setIsLoading(true);
        console.log('📖 [Persistence] Loading tree:', id);
        try {
            // 1. Fetch Tree Metadata
            const { data: tree, error: treeError } = await supabase
                .from('trees')
                .select('*')
                .eq('id', id)
                .single();
            if (treeError) throw treeError;

            // 1.5. Track Visit (Join Tree)
            if (useCanvasStore.getState().me?.id) {
                await supabase.from('tree_members').upsert({
                    tree_id: id,
                    user_id: useCanvasStore.getState().me!.id,
                    last_accessed_at: new Date().toISOString()
                });
            }

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
                    authorName: node.data.authorName,
                    selectedPersonaId: node.data.selectedPersonaId,
                    customPersona: node.data.customPersona,
                    fileUrl: node.data.fileUrl,
                    fileName: node.data.fileName,
                    mimeType: node.data.mimeType,
                    modelConfig: node.model_config
                }
            }));

            const flowEdges: Edge[] = (dbEdges || []).map((edge: any) => ({
                id: edge.id || `edge-${edge.source_id}-${edge.target_id}`,
                source: edge.source_id,
                target: edge.target_id,
                type: 'floating',
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2 }, // slate-400
            }));

            // 5. Load into Store
            useCanvasStore.getState().loadGraph(flowNodes, flowEdges, tree.id, tree.name, tree.owner_id);

            // 6. Update URL immediately to prevent the existence effect from reloading the previous tree
            const url = new URL(window.location.href);
            if (url.searchParams.get('treeId') !== tree.id) {
                url.searchParams.set('treeId', tree.id);
                window.history.pushState({}, '', url.toString());
            }

            // 7. Update lastSavedRef to prevent immediate auto-save after loading
            lastSavedRef.current = serializeState(flowNodes, flowEdges, tree.name);

        } catch (error) {
            console.error('Error loading tree:', error);
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, serializeState]);

    // Debounced Auto-save
    useEffect(() => {
        const currentNodes = useCanvasStore.getState().nodes;
        if (currentNodes.length === 0) return; // Don't save empty state immediately

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
    }, [useCanvasStore.getState().nodes, useCanvasStore.getState().edges, useCanvasStore.getState().treeName, saveTree, setSyncStatus, syncStatus]);

    // 1. INITIAL LOAD FROM URL - Run once on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlTreeId = params.get('treeId');
        if (urlTreeId && urlTreeId !== treeId) {
            loadTree(urlTreeId);
        }
    }, []); // Empty dependency array for stability

    // 2. REALTIME SUBSCRIPTION - Stable Singleton Pattern
    useEffect(() => {
        if (!treeId || !supabase) return;

        const subId = ++activeSubIdRef.current;
        console.log(`⚡️ [Realtime] Starting sub #${subId} for tree:`, treeId);

        // Random suffix to bypass any server-side binding caching
        const suffix = Math.random().toString(36).slice(2, 7);
        let dbChannel: any = null;
        let presenceChannel: any = null;

        const setupChannels = async () => {
            if (!supabase) return;
            // Wait slightly for previous channels to clear backend sockets
            await new Promise(resolve => setTimeout(resolve, 500));

            // If another subscription started during our delay, abort
            if (subId !== activeSubIdRef.current) {
                console.log(`🔌 [Realtime] Aborting sub #${subId} (superseded)`);
                return;
            }

            const state = useCanvasStore.getState();
            state.setRealtimeStatus('CONNECTING');

            // --- CHANNEL 1: DATABASE (Unique Name) ---
            dbChannel = supabase.channel(`db-sync-${treeId}-${suffix}`);
            dbChannelRef.current = dbChannel;

            dbChannel
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'nodes' },
                    (payload: any) => {
                        if (!supabase) return;
                        const data = (payload.new || payload.old) as any;
                        if (data?.tree_id !== treeId) return;

                        useCanvasStore.getState().setRealtimeStatus('SUBSCRIBED', `Node ${payload.eventType}`);
                        if (isSavingRef.current) return;

                        const currentState = useCanvasStore.getState();
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const node = payload.new as DbNode;
                            const flowNode: ConversationNode = {
                                id: node.id,
                                type: 'conversation',
                                position: { x: node.position_x, y: node.position_y },
                                data: {
                                    role: node.data?.role || 'assistant',
                                    content: node.data?.content || '',
                                    branchContext: node.data?.branchContext,
                                    authorName: node.data?.authorName,
                                    selectedPersonaId: node.data?.selectedPersonaId,
                                    customPersona: node.data?.customPersona,
                                    fileUrl: node.data?.fileUrl,
                                    fileName: node.data?.fileName,
                                    mimeType: node.data?.mimeType,
                                    isGenerated: node.data?.isGenerated,
                                    modelConfig: node.model_config,
                                },
                            };

                            const currentNodes = currentState.nodes;
                            const existingIndex = currentNodes.findIndex(n => n.id === node.id);
                            if (existingIndex !== -1) {
                                const existing = currentNodes[existingIndex];
                                if (existing.data.content !== flowNode.data.content ||
                                    Math.abs(existing.position.x - flowNode.position.x) > 1 ||
                                    Math.abs(existing.position.y - flowNode.position.y) > 1) {
                                    const nextNodes = [...currentNodes];
                                    nextNodes[existingIndex] = flowNode;
                                    setNodes(nextNodes);
                                }
                            } else {
                                setNodes([...currentNodes, flowNode]);
                            }
                        } else if (payload.eventType === 'DELETE') {
                            setNodes(currentState.nodes.filter(n => n.id !== payload.old.id));
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'edges' },
                    (payload: any) => {
                        const data = (payload.new || payload.old) as any;
                        if (data?.tree_id !== treeId) return;

                        useCanvasStore.getState().setRealtimeStatus('SUBSCRIBED', `Edge ${payload.eventType}`);
                        if (isSavingRef.current) return;

                        const currentState = useCanvasStore.getState();
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const edge = payload.new as DbEdge;
                            if (!currentState.edges.find(e => e.id === edge.id)) {
                                const flowEdge: Edge = {
                                    id: edge.id!,
                                    source: edge.source_id,
                                    target: edge.target_id,
                                    type: 'floating',
                                    animated: true,
                                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                                };
                                setEdges([...currentState.edges, flowEdge]);
                            }
                        } else if (payload.eventType === 'DELETE') {
                            setEdges(currentState.edges.filter(e => e.id !== payload.old.id));
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'trees',
                    },
                    (payload: any) => {
                        if (payload.new?.id !== treeId) return;
                        if (isSavingRef.current) return;
                        const state = useCanvasStore.getState();
                        if (payload.new.name !== state.treeName) {
                            state.setTreeName(payload.new.name);
                        }
                    }
                )
                .subscribe((status: string, err?: any) => {
                    if (subId !== activeSubIdRef.current) return;

                    console.log(`🔗 [DB] sub #${subId}: ${status}`);
                    if (err) {
                        console.error(`❌ [DB] sub #${subId} Error:`, err);
                        useCanvasStore.getState().setRealtimeStatus('ERROR', err.message);
                    } else if (status === 'SUBSCRIBED') {
                        useCanvasStore.getState().setRealtimeStatus('SUBSCRIBED');
                    }
                });

            // --- CHANNEL 2: PRESENCE (Global for this Tree) ---
            presenceChannel = supabase.channel(`presence-${treeId}`, {
                config: { presence: { key: me?.id || 'anon' } }
            });
            presenceChannelRef.current = presenceChannel;

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    if (subId !== activeSubIdRef.current) return;
                    const newState = presenceChannel.presenceState();
                    const flattened: Record<string, any> = {};
                    Object.values(newState).forEach((presences: any) => {
                        presences.forEach((p: any) => { if (p.id) flattened[p.id] = p; });
                    });
                    useCanvasStore.getState().setCollaborators(flattened);
                })
                .subscribe(async (status: string) => {
                    if (subId !== activeSubIdRef.current) return;
                    console.log(`👥 [Presence] sub #${subId}: ${status}`);
                    if (status === 'SUBSCRIBED' && me) {
                        console.log('📡 [Presence] Initial tracking for:', me.name);
                        await presenceChannel.track(me);
                    }
                });
        };

        setupChannels();

        return () => {
            console.log(`🔌 [Realtime] Cleaning up sub #${subId}...`);
            // Increment ID immediately to invalidate any async callbacks from this sub
            if (activeSubIdRef.current === subId) {
                activeSubIdRef.current++;
            }

            if (dbChannel && supabase) {
                supabase.removeChannel(dbChannel);
                dbChannelRef.current = null;
            }
            if (presenceChannel && supabase) {
                supabase.removeChannel(presenceChannel);
                presenceChannelRef.current = null;
            }
        };
    }, [treeId, setNodes, setEdges, me?.id]); // Restart if treeId OR core user identity changes

    // 3. REACTIVE PRESENCE TRACKING - Update metadata/position without restarting channel
    useEffect(() => {
        const channel = presenceChannelRef.current;
        if (!channel || !me || !supabase) return;

        // Only track if the channel is actually joined
        if (channel.state === 'joined') {
            console.log('📡 [Presence] Reactive tracking update:', me.name);
            channel.track(me);
        }
    }, [me?.name, me?.color, me?.id]); // Track metadata changes

    // 4. MOUSE POSITION TRACKING - Interval-based Throttle (10Hz)
    // We use a ref to hold the latest state, and an interval to send updates.
    // This prevents the "debounce" effect of the previous implementation where
    // updates were only sent after the user STOPPED moving.
    const latestMeRef = useRef(me);
    const lastTrackedMeRef = useRef<any>(null);

    // Keep latestMeRef up to date
    useEffect(() => {
        latestMeRef.current = me;
    }, [me]);

    useEffect(() => {
        const channel = presenceChannelRef.current;
        if (!supabase) return;

        // processing loop
        const intervalId = setInterval(() => {
            if (channel && channel.state === 'joined' && latestMeRef.current) {
                const latest = latestMeRef.current;
                const last = lastTrackedMeRef.current;

                // Check if mouse position changed
                const hasMoved = !last ||
                    (latest.mousePos?.x !== last.mousePos?.x) ||
                    (latest.mousePos?.y !== last.mousePos?.y);

                if (hasMoved) {
                    channel.track(latest);
                    lastTrackedMeRef.current = latest;
                }
            }
        }, 100); // 100ms = 10 updates/sec

        return () => clearInterval(intervalId);
    }, []); // Run once on mount (refs handle state access)

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
