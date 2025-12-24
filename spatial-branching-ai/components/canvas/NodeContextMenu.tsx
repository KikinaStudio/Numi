'use client';

import { memo, useEffect, useRef } from 'react';
import { GitBranch, Trash2, RefreshCw, Copy, Scissors } from 'lucide-react';

interface NodeContextMenuProps {
    x: number;
    y: number;
    nodeId: string;
    hasTextSelection: boolean;
    selectedText?: string;
    onCreateBranch: () => void;
    onClose: () => void;
}

const NodeContextMenu = memo(({
    x,
    y,
    nodeId,
    hasTextSelection,
    selectedText,
    onCreateBranch,
    onClose,
}: NodeContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to stay within viewport
    const adjustedX = Math.min(x, window.innerWidth - 220);
    const adjustedY = Math.min(y, window.innerHeight - 200);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
            style={{
                left: adjustedX,
                top: adjustedY,
            }}
        >
            <div className="p-1">
                {/* Branch options */}
                <button
                    onClick={onCreateBranch}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                    <GitBranch className="h-4 w-4 text-emerald-500" />
                    <div className="flex-1">
                        <span className="font-medium">Create Branch</span>
                        {hasTextSelection && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                From: &quot;{selectedText?.substring(0, 30)}...&quot;
                            </p>
                        )}
                    </div>
                </button>

                {hasTextSelection && (
                    <button
                        onClick={onCreateBranch}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                    >
                        <Scissors className="h-4 w-4 text-blue-500" />
                        <span>Branch from Selection</span>
                    </button>
                )}

                <div className="h-px bg-border my-1" />

                {/* Other actions */}
                <button
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                    onClick={() => {
                        // TODO: Implement regenerate
                        onClose();
                    }}
                >
                    <RefreshCw className="h-4 w-4 text-yellow-500" />
                    <span>Regenerate Response</span>
                </button>

                <button
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                    onClick={() => {
                        // TODO: Copy node content
                        onClose();
                    }}
                >
                    <Copy className="h-4 w-4" />
                    <span>Copy Content</span>
                </button>

                <div className="h-px bg-border my-1" />

                <button
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
                    onClick={() => {
                        // TODO: Implement delete
                        onClose();
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Node</span>
                </button>
            </div>
        </div>
    );
});

NodeContextMenu.displayName = 'NodeContextMenu';

export default NodeContextMenu;
