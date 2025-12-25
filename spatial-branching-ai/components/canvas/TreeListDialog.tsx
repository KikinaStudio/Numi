import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { usePersistence } from '@/lib/hooks/usePersistence';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { FileText, Calendar, Loader2, Share2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface TreeSummary {
    id: string;
    name: string;
    updated_at: string;
    owner_id: string | null;
}

export function TreeListDialog({ open, onOpenChange }: TreeListDialogProps) {
    const [trees, setTrees] = useState<TreeSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const { loadTree } = usePersistence();
    const userId = useSettingsStore(state => state.userId);

    useEffect(() => {
        if (open && userId) {
            fetchTrees();
        }
    }, [open, userId]);

    const fetchTrees = async () => {
        if (!supabase || !userId) return;
        setLoading(true);
        try {
            // Fetch trees that the user has accessed
            const { data: accessData, error: accessError } = await supabase
                .from('tree_access')
                .select(`
                    tree_id,
                    trees (
                        id,
                        name,
                        updated_at,
                        owner_id
                    )
                `)
                .eq('user_id', userId)
                .order('last_accessed_at', { ascending: false });

            if (accessError) throw accessError;

            // Flatten results and filter out any missing trees (if deleted)
            const flattened = (accessData || [])
                .map((row: any) => row.trees)
                .filter(t => !!t) as TreeSummary[];

            setTrees(flattened);
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

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
        } catch (e) {
            return dateString;
        }
    };

    const myTrees = trees.filter(t => t.owner_id === userId);
    const sharedTrees = trees.filter(t => t.owner_id !== userId);

    const TreeItem = ({ tree }: { tree: TreeSummary }) => (
        <button
            onClick={() => handleLoad(tree.id)}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-all text-left group"
        >
            <div className={cn(
                "p-2 rounded-md transition-colors",
                tree.owner_id === userId ? "bg-primary/10 group-hover:bg-primary/20" : "bg-muted group-hover:bg-muted/80"
            )}>
                {tree.owner_id === userId ? (
                    <User className="h-4 w-4 text-primary" />
                ) : (
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                )}
            </div>
            <div className="flex-1 overflow-hidden">
                <h4 className="font-semibold text-sm truncate">{tree.name}</h4>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(tree.updated_at)}</span>
                </div>
            </div>
        </button>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-zinc-800 bg-zinc-950">
                <DialogHeader className="p-6 border-b border-zinc-900 bg-zinc-900/30 backdrop-blur-sm">
                    <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        YOUR WORKSPACES
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                            <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Syncing with cloud...</p>
                        </div>
                    ) : trees.length === 0 ? (
                        <div className="text-center py-12 px-6 border-2 border-dashed border-zinc-900 rounded-xl">
                            <p className="text-sm font-bold text-muted-foreground/50 uppercase tracking-widest">No workspaces found</p>
                        </div>
                    ) : (
                        <>
                            {myTrees.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                        <div className="h-1 w-1 bg-primary rounded-full" />
                                        My Thinking
                                    </h3>
                                    <div className="grid gap-2">
                                        {myTrees.map(tree => <TreeItem key={tree.id} tree={tree} />)}
                                    </div>
                                </div>
                            )}

                            {sharedTrees.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 border-t border-zinc-900 pt-6">
                                        <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                                        Collaborations
                                    </h3>
                                    <div className="grid gap-2">
                                        {sharedTrees.map(tree => <TreeItem key={tree.id} tree={tree} />)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
