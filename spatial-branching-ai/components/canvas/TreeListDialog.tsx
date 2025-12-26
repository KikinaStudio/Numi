import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { usePersistence } from '@/lib/hooks/usePersistence';
import { FileText, Calendar, Loader2, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === trees.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(trees.map(t => t.id)));
        }
    };

    const handleDelete = async () => {
        if (!supabase || selectedIds.size === 0) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase
                .from('trees')
                .delete()
                .in('id', Array.from(selectedIds));

            if (error) throw error;

            // Clear selection and refresh
            setSelectedIds(new Set());
            fetchTrees();
            setShowDeleteAlert(false);
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete trees');
        } finally {
            setIsDeleting(false);
        }
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
                    <div className="flex items-center justify-between">
                        <DialogTitle>Saved Trees</DialogTitle>
                        {selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setShowDeleteAlert(true)}
                                className="h-7 text-xs"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-2 mt-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : trees.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8">
                            No saved trees found.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                                <Checkbox
                                    checked={selectedIds.size === trees.length && trees.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                                <span>Select All</span>
                            </div>
                            {trees.map((tree) => (
                                <div
                                    key={tree.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                                >
                                    <Checkbox
                                        checked={selectedIds.has(tree.id)}
                                        onCheckedChange={() => toggleSelection(tree.id)}
                                    />
                                    <button
                                        onClick={() => handleLoad(tree.id)}
                                        className="flex items-start gap-4 flex-1 text-left"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
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
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete {selectedIds.size} tree{selectedIds.size > 1 ? 's' : ''} and all associated data.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
