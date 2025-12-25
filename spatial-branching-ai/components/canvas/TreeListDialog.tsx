import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { usePersistence } from '@/lib/hooks/usePersistence';
import { FileText, Calendar, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/lib/stores/settings-store';

interface TreeListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface TreeSummary {
    id: string;
    name: string;
    updated_at: string;
}

export function TreeListDialog({ open, onOpenChange }: TreeListDialogProps) {
    const [trees, setTrees] = useState<TreeSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const { loadTree } = usePersistence();

    useEffect(() => {
        if (open) {
            fetchTrees();
        }
    }, [open]);

    const fetchTrees = async () => {
        if (!supabase) return;
        setLoading(true);
        const { userId } = useSettingsStore.getState();
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            // Join tree_members with trees to get metadata for only accessible trees
            const { data, error } = await supabase
                .from('tree_members')
                .select(`
                    last_accessed_at,
                    tree:trees (
                        id,
                        name,
                        updated_at
                    )
                `)
                .eq('user_id', userId)
                .order('last_accessed_at', { ascending: false });

            if (error) throw error;

            // Transform to flat TreeSummary structure
            const formattedTrees = (data || [])
                .filter((item: any) => item.tree) // Filter out any null joins
                .map((item: any) => ({
                    id: item.tree.id,
                    name: item.tree.name,
                    updated_at: item.last_accessed_at // Sort by access time, not creation
                }));

            setTrees(formattedTrees);
        } catch (error) {
            console.error('Failed to fetch trees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoad = async (id: string) => {
        await loadTree(id);
        onOpenChange(false);
    };

    // Simple date formatter since I'm not sure if date-fns is avail
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
        } catch (e) {
            return dateString;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Saved Conversations</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-2 mt-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : trees.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8">
                            No saved conversations found.
                        </div>
                    ) : (
                        trees.map((tree) => (
                            <button
                                key={tree.id}
                                onClick={() => handleLoad(tree.id)}
                                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                            >
                                <div className="p-2 bg-primary/10 rounded-md">
                                    <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-medium text-sm truncate">{tree.name}</h4>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(tree.updated_at)}</span>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
